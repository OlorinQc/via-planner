-- ============================================================================
-- Palantir 2.0 - Session 2 fixes (write-path hardening)
-- Generated from palantir-2.0-session1-final.sql. APPLIED 2026-06-17 (migration pal_2_0_session2_hardening).
-- Apply order: helpers, then patched pal_apply_update, then hardening DDL.
--
-- Fixes:
--   1. Unguarded casts (ch->>'archived')::boolean and (ch->>'sortOrder')::float
--      threw on malformed input and rolled back the WHOLE package. Now routed
--      through pal_safe_bool / pal_safe_float: bad values are ignored + warned,
--      matching the existing "a bad id must not abort the whole package" rule.
--   2. search_path pinned on all functions (advisor 0011).
--   3. EXECUTE on the write surface revoked from anon/PUBLIC; migrate locked to
--      service_role. SECURITY INVOKER retained (see session2 report).
-- ============================================================================

CREATE OR REPLACE FUNCTION pal_safe_bool(t text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN RETURN NULL; END IF;
  RETURN btrim(lower(t))::boolean;
EXCEPTION WHEN others THEN RETURN NULL; END $$;

CREATE OR REPLACE FUNCTION pal_safe_float(t text) RETURNS double precision
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN RETURN NULL; END IF;
  RETURN btrim(t)::double precision;
EXCEPTION WHEN others THEN RETURN NULL; END $$;

CREATE OR REPLACE FUNCTION pal_apply_update(pkg jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  res jsonb := '[]'::jsonb;
  warns jsonb := '[]'::jsonb;
  it jsonb; ch jsonb;
  pid text; k text;
  v_id text; v_warn text; v_title text; v_status text;
  fid text; f_warn text;
  oid text; ow text;
  tgt text; t_warn text;
  v_ids text[]; v_missing text[];
  n1 int; n2 int; n3 int; n4 int;
BEGIN
  pid := pkg->>'packageId';
  IF pid IS NULL THEN RETURN jsonb_build_object('status','error','error','packageId is required'); END IF;
  IF EXISTS (SELECT 1 FROM pal_events WHERE package_id = pid AND kind = 'import') THEN
    RETURN jsonb_build_object('status','noop','reason','package already applied','packageId',pid);
  END IF;

  -- structural validation: unknown top-level keys are reported, never silently ignored
  FOR k IN SELECT jsonb_object_keys(pkg) LOOP
    IF k NOT IN ('packageId','summary','date','source',
                 'peopleToCreate','filesToCreate','filesToUpdate','filesToMerge',
                 'outputsToCreate','outputsToUpdate',
                 'tasksToComplete','tasksToCreate','tasksToUpdate','tasksToDelete',
                 'flagsToCreate','flagsToResolve','linksToCreate',
                 'memoryUpdates','logEntriesToCreate') THEN
      warns := warns || to_jsonb('unknown key ignored: '||k);
    END IF;
  END LOOP;

  PERFORM pal_snapshot('Before: '||coalesce(pkg->>'summary','update'), 'pre_import');

  -- ── peopleToCreate: [{name, title}] · duplicate-guarded on name ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'peopleToCreate','[]'::jsonb)) LOOP
    IF coalesce(it->>'name','') = '' THEN
      res := res || jsonb_build_object('op','person.create','ref',it,'result','skipped: name required'); CONTINUE;
    END IF;
    SELECT id INTO v_id FROM pal_people WHERE lower(name) = lower(it->>'name');
    IF v_id IS NOT NULL THEN
      res := res || jsonb_build_object('op','person.create','id',v_id,'result','skipped: already exists');
    ELSE
      INSERT INTO pal_people(name, title) VALUES (it->>'name', coalesce(it->>'title','')) RETURNING id INTO v_id;
      INSERT INTO pal_events(entity,entity_id,kind,summary,actor,package_id)
      VALUES ('person',v_id,'create',it->>'name','claude',pid);
      res := res || jsonb_build_object('op','person.create','id',v_id,'result','ok');
    END IF;
  END LOOP;

  -- ── filesToCreate: [{title, status, priority, sensitivity, lead, memory}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'filesToCreate','[]'::jsonb)) LOOP
    IF coalesce(it->>'title','') = '' THEN
      res := res || jsonb_build_object('op','file.create','ref',it,'result','skipped: title required'); CONTINUE;
    END IF;
    SELECT id INTO v_id FROM pal_files WHERE lower(title) = lower(it->>'title') AND NOT archived;
    IF v_id IS NOT NULL THEN
      res := res || jsonb_build_object('op','file.create','id',v_id,'result','skipped: file with same title exists');
      CONTINUE;
    END IF;
    v_warn := NULL;
    SELECT id INTO fid FROM pal_people WHERE lower(name) = lower(it->>'lead');
    IF it->>'lead' IS NOT NULL AND fid IS NULL THEN v_warn := 'lead not found: '||(it->>'lead'); END IF;
    INSERT INTO pal_files(title, status, priority, sensitivity, lead_id, memory)
    VALUES (it->>'title', coalesce(it->>'status','active'), coalesce(it->>'priority','medium'),
            coalesce(it->>'sensitivity','low'), fid, coalesce(it->>'memory',''))
    RETURNING id INTO v_id;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
    VALUES (v_id,'file',v_id,'create',it->>'title','claude',pid);
    res := res || jsonb_strip_nulls(jsonb_build_object('op','file.create','id',v_id,'result','ok','warn',v_warn));
  END LOOP;

  -- ── filesToUpdate: [{fileId|fileTitle, changes:{title|status|priority|sensitivity|lead|archived}}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'filesToUpdate','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'fileId', it->>'fileTitle');
    IF fid IS NULL THEN
      res := res || jsonb_build_object('op','file.update','ref',it,'result','skipped: file not found'); CONTINUE;
    END IF;
    ch := coalesce(it->'changes','{}'::jsonb);
    FOR k IN SELECT jsonb_object_keys(ch) LOOP
      IF k NOT IN ('title','status','priority','sensitivity','lead','archived') THEN
        warns := warns || to_jsonb('file.update '||fid||': unknown change ignored: '||k);
      END IF;
    END LOOP;
    SELECT title INTO v_title FROM pal_files WHERE id = fid;
    v_warn := NULL; v_id := NULL;
    IF ch ? 'lead' THEN
      SELECT id INTO v_id FROM pal_people WHERE lower(name) = lower(ch->>'lead');
      IF ch->>'lead' IS NOT NULL AND v_id IS NULL THEN v_warn := 'lead not found: '||(ch->>'lead'); END IF;
    END IF;
    IF ch ? 'archived' AND pal_safe_bool(ch->>'archived') IS NULL AND btrim(coalesce(ch->>'archived','')) <> '' THEN
      v_warn := concat_ws('; ', v_warn, 'invalid archived value ignored: '||(ch->>'archived')); ch := ch - 'archived';
    END IF;
    UPDATE pal_files SET
      title       = coalesce(ch->>'title', title),
      status      = coalesce(ch->>'status', status),
      priority    = coalesce(ch->>'priority', priority),
      sensitivity = coalesce(ch->>'sensitivity', sensitivity),
      lead_id     = CASE WHEN ch ? 'lead' THEN v_id ELSE lead_id END,
      archived    = CASE WHEN ch ? 'archived' THEN pal_safe_bool(ch->>'archived') ELSE archived END,
      archived_at = CASE WHEN ch ? 'archived' AND pal_safe_bool(ch->>'archived') THEN CURRENT_DATE
                         WHEN ch ? 'archived' THEN NULL ELSE archived_at END
    WHERE id = fid;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,package_id)
    VALUES (fid,'file',fid,'update',
            CASE WHEN ch ? 'title' THEN 'renamed from "'||v_title||'" to "'||(ch->>'title')||'"' ELSE 'fields updated' END,
            'claude',ch,pid);
    res := res || jsonb_strip_nulls(jsonb_build_object('op','file.update','id',fid,'result','ok','warn',
             nullif(concat_ws('; ', f_warn, v_warn),'')));
  END LOOP;

  -- ── outputsToCreate: [{fileId|fileTitle, title, type, status, owner, due, publication, approvalStatus, sharePointUrl, notes}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'outputsToCreate','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'fileId', it->>'fileTitle');
    IF fid IS NULL OR coalesce(it->>'title','') = '' THEN
      res := res || jsonb_build_object('op','output.create','ref',it->>'title','result',
               CASE WHEN fid IS NULL THEN 'skipped: file not found' ELSE 'skipped: title required' END);
      CONTINUE;
    END IF;
    v_warn := NULL; v_id := NULL;
    IF it ? 'owner' THEN
      SELECT id INTO v_id FROM pal_people WHERE lower(name) = lower(it->>'owner');
      IF it->>'owner' IS NOT NULL AND v_id IS NULL THEN v_warn := 'owner not found: '||(it->>'owner'); END IF;
    END IF;
    INSERT INTO pal_outputs(file_id, title, type, status, owner_id, due, publication,
                            approval_status, sharepoint_url, notes, sort_order)
    VALUES (fid, it->>'title', coalesce(it->>'type','other'), coalesce(it->>'status','not_started'),
            v_id, pal_norm_flexdate(it->'due'), pal_norm_flexdate(it->'publication'),
            coalesce(it->>'approvalStatus','not_required'), coalesce(it->>'sharePointUrl',''),
            coalesce(it->>'notes',''),
            (SELECT coalesce(max(sort_order),0)+1 FROM pal_outputs WHERE file_id = fid))
    RETURNING id INTO oid;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
    VALUES (fid,'output',oid,'create',it->>'title','claude',pid);
    res := res || jsonb_strip_nulls(jsonb_build_object('op','output.create','id',oid,'result','ok','warn',
             nullif(concat_ws('; ', f_warn, v_warn),'')));
  END LOOP;

  -- ── outputsToUpdate: [{outputId|outputTitle, changes:{title|type|status|owner|due|publication|approvalStatus|sharePointUrl|notes|sortOrder}}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'outputsToUpdate','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO oid, ow FROM pal_find_output(it->>'outputId', it->>'outputTitle', NULL);
    IF oid IS NULL THEN
      res := res || jsonb_strip_nulls(jsonb_build_object('op','output.update','ref',it,'result','skipped: output not found','warn',ow));
      CONTINUE;
    END IF;
    ch := coalesce(it->'changes','{}'::jsonb);
    FOR k IN SELECT jsonb_object_keys(ch) LOOP
      IF k NOT IN ('title','type','status','owner','due','publication','approvalStatus','sharePointUrl','notes','sortOrder') THEN
        warns := warns || to_jsonb('output.update '||oid||': unknown change ignored: '||k);
      END IF;
    END LOOP;
    v_warn := NULL; v_id := NULL;
    IF ch ? 'owner' THEN
      SELECT id INTO v_id FROM pal_people WHERE lower(name) = lower(ch->>'owner');
      IF ch->>'owner' IS NOT NULL AND v_id IS NULL THEN v_warn := 'owner not found: '||(ch->>'owner'); END IF;
    END IF;
    IF ch ? 'sortOrder' AND pal_safe_float(ch->>'sortOrder') IS NULL AND btrim(coalesce(ch->>'sortOrder','')) <> '' THEN
      v_warn := concat_ws('; ', v_warn, 'invalid sortOrder ignored: '||(ch->>'sortOrder'));
    END IF;
    UPDATE pal_outputs SET
      title           = coalesce(ch->>'title', title),
      type            = coalesce(ch->>'type', type),
      status          = coalesce(ch->>'status', status),
      owner_id        = CASE WHEN ch ? 'owner' THEN v_id ELSE owner_id END,
      due             = CASE WHEN ch ? 'due' THEN pal_norm_flexdate(ch->'due') ELSE due END,
      publication     = CASE WHEN ch ? 'publication' THEN pal_norm_flexdate(ch->'publication') ELSE publication END,
      approval_status = coalesce(ch->>'approvalStatus', approval_status),
      sharepoint_url  = coalesce(ch->>'sharePointUrl', sharepoint_url),
      notes           = coalesce(ch->>'notes', notes),
      sort_order      = coalesce(pal_safe_float(ch->>'sortOrder'), sort_order)
    WHERE id = oid;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,package_id)
      SELECT file_id,'output',oid,'update','fields updated','claude',ch,pid FROM pal_outputs WHERE id = oid;
    res := res || jsonb_strip_nulls(jsonb_build_object('op','output.update','id',oid,'result','ok','warn',
             nullif(concat_ws('; ', ow, v_warn),'')));
  END LOOP;

  -- ── tasksToCreate: [{fileId|fileTitle, outputId|outputTitle, title, status, assignees[], due, notes, gate}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'tasksToCreate','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'fileId', it->>'fileTitle');
    IF fid IS NULL OR coalesce(it->>'title','') = '' THEN
      res := res || jsonb_build_object('op','task.create','ref',it->>'title','result',
               CASE WHEN fid IS NULL THEN 'skipped: file not found' ELSE 'skipped: title required' END);
      CONTINUE;
    END IF;
    SELECT o_id, o_warn INTO oid, ow FROM pal_find_output(it->>'outputId', it->>'outputTitle', fid);
    SELECT ids, missing INTO v_ids, v_missing FROM pal_people_ids(it->'assignees');
    v_warn := concat_ws('; ',
      f_warn, ow,
      CASE WHEN array_length(v_missing,1) > 0 THEN 'assignees not found: '||array_to_string(v_missing,', ') END,
      (SELECT 'similar open task exists: '||id FROM pal_tasks
        WHERE file_id = fid AND lower(title) = lower(it->>'title') AND status <> 'completed' LIMIT 1));
    INSERT INTO pal_tasks(file_id, output_id, title, status, due, assignee_ids, notes, gate, source, sort_order)
    VALUES (fid, oid, it->>'title', coalesce(it->>'status','not_started'), pal_norm_flexdate(it->'due'),
            v_ids, coalesce(it->>'notes',''), coalesce(it->>'gate',''), 'claude_import',
            (SELECT coalesce(max(sort_order),0)+1 FROM pal_tasks WHERE file_id = fid))
    RETURNING id INTO v_id;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
    VALUES (fid,'task',v_id,'create',it->>'title','claude',pid);
    res := res || jsonb_strip_nulls(jsonb_build_object('op','task.create','id',v_id,'result','ok','warn',nullif(v_warn,'')));
  END LOOP;

  -- ── tasksToComplete: [{taskId|taskTitle}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'tasksToComplete','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO v_id, v_warn FROM pal_find_task(it->>'taskId', it->>'taskTitle');
    IF v_id IS NULL THEN
      res := res || jsonb_strip_nulls(jsonb_build_object('op','complete','ref',it,'result','skipped: no match','warn',v_warn));
      CONTINUE;
    END IF;
    SELECT status INTO v_status FROM pal_tasks WHERE id = v_id;
    IF v_status = 'completed' THEN
      v_warn := concat_ws('; ', v_warn, 'already completed');
    ELSE
      UPDATE pal_tasks SET status = 'completed', completed_at = CURRENT_DATE WHERE id = v_id;
      INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
        SELECT file_id,'task',v_id,'complete',title,'claude',pid FROM pal_tasks WHERE id = v_id;
    END IF;
    res := res || jsonb_strip_nulls(jsonb_build_object('op','complete','id',v_id,'result','ok','warn',nullif(v_warn,'')));
  END LOOP;

  -- ── tasksToUpdate: [{taskId|taskTitle, changes:{status|title|notes|gate|due|outputId|fileId|assignees|sortOrder}}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'tasksToUpdate','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO v_id, v_warn FROM pal_find_task(it->>'taskId', it->>'taskTitle');
    IF v_id IS NULL THEN
      res := res || jsonb_strip_nulls(jsonb_build_object('op','task.update','ref',it,'result','skipped: no match','warn',v_warn));
      CONTINUE;
    END IF;
    ch := coalesce(it->'changes','{}'::jsonb);
    FOR k IN SELECT jsonb_object_keys(ch) LOOP
      IF k NOT IN ('status','title','notes','gate','due','outputId','fileId','assignees','sortOrder') THEN
        warns := warns || to_jsonb('task.update '||v_id||': unknown change ignored: '||k);
      END IF;
    END LOOP;
    -- referential checks before write (a bad id must not abort the whole package)
    IF ch ? 'outputId' AND ch->>'outputId' IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pal_outputs WHERE id = ch->>'outputId') THEN
      v_warn := concat_ws('; ', v_warn, 'outputId not found, link unchanged: '||(ch->>'outputId'));
      ch := ch - 'outputId';
    END IF;
    IF ch ? 'fileId' AND ch->>'fileId' IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pal_files WHERE id = ch->>'fileId') THEN
      v_warn := concat_ws('; ', v_warn, 'fileId not found, link unchanged: '||(ch->>'fileId'));
      ch := ch - 'fileId';
    END IF;
    IF ch ? 'assignees' THEN
      SELECT ids, missing INTO v_ids, v_missing FROM pal_people_ids(ch->'assignees');
      IF array_length(v_missing,1) > 0 THEN
        v_warn := concat_ws('; ', v_warn, 'assignees not found: '||array_to_string(v_missing,', '));
      END IF;
    END IF;
    IF ch ? 'sortOrder' AND pal_safe_float(ch->>'sortOrder') IS NULL AND btrim(coalesce(ch->>'sortOrder','')) <> '' THEN
      v_warn := concat_ws('; ', v_warn, 'invalid sortOrder ignored: '||(ch->>'sortOrder'));
    END IF;
    UPDATE pal_tasks SET
      status       = coalesce(ch->>'status', status),
      title        = coalesce(ch->>'title', title),
      notes        = coalesce(ch->>'notes', notes),
      gate         = coalesce(ch->>'gate', gate),
      due          = CASE WHEN ch ? 'due' THEN pal_norm_flexdate(ch->'due') ELSE due END,
      output_id    = CASE WHEN ch ? 'outputId' THEN ch->>'outputId' ELSE output_id END,
      file_id      = CASE WHEN ch ? 'fileId' THEN ch->>'fileId' ELSE file_id END,
      assignee_ids = CASE WHEN ch ? 'assignees' THEN v_ids ELSE assignee_ids END,
      sort_order   = coalesce(pal_safe_float(ch->>'sortOrder'), sort_order),
      completed_at = CASE WHEN ch->>'status' = 'completed' THEN CURRENT_DATE
                          WHEN ch ? 'status' THEN NULL ELSE completed_at END
    WHERE id = v_id;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,package_id)
      SELECT file_id,'task',v_id,'update','fields updated','claude',ch,pid FROM pal_tasks WHERE id = v_id;
    res := res || jsonb_strip_nulls(jsonb_build_object('op','task.update','id',v_id,'result','ok','warn',nullif(v_warn,'')));
  END LOOP;

  -- ── tasksToDelete: [{taskId}] · deleted row archived in the event payload ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'tasksToDelete','[]'::jsonb)) LOOP
    v_id := NULL;
    SELECT id, file_id, title INTO v_id, fid, v_title FROM pal_tasks WHERE id = it->>'taskId';
    IF v_id IS NULL THEN
      res := res || jsonb_build_object('op','task.delete','ref',it->>'taskId','result','skipped: no match');
      CONTINUE;
    END IF;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,package_id)
      SELECT file_id,'task',v_id,'delete',v_title,'claude',to_jsonb(t) - 'created_at' - 'updated_at',pid
      FROM pal_tasks t WHERE id = v_id;
    DELETE FROM pal_tasks WHERE id = v_id;
    res := res || jsonb_build_object('op','task.delete','id',v_id,'result','ok');
  END LOOP;

  -- ── flagsToCreate: [{fileId|fileTitle, kind, text, detail, severity, owner}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'flagsToCreate','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'fileId', it->>'fileTitle');
    IF fid IS NULL OR coalesce(it->>'text','') = '' THEN
      res := res || jsonb_build_object('op','flag.create','ref',it,'result',
               CASE WHEN fid IS NULL THEN 'skipped: file not found' ELSE 'skipped: text required' END);
      CONTINUE;
    END IF;
    v_warn := f_warn; v_id := NULL;
    IF it ? 'owner' THEN
      SELECT id INTO v_id FROM pal_people WHERE lower(name) = lower(it->>'owner');
      IF it->>'owner' IS NOT NULL AND v_id IS NULL THEN
        v_warn := concat_ws('; ', v_warn, 'owner not found: '||(it->>'owner'));
      END IF;
    END IF;
    INSERT INTO pal_flags(file_id, kind, text, detail, severity, owner_id)
    VALUES (fid,
            CASE WHEN it->>'kind' IN ('question','risk','blocker') THEN it->>'kind' ELSE 'question' END,
            it->>'text', coalesce(it->>'detail',''), it->>'severity', v_id)
    RETURNING id INTO oid;
    IF it->>'kind' IS NOT NULL AND it->>'kind' NOT IN ('question','risk','blocker') THEN
      v_warn := concat_ws('; ', v_warn, 'unknown kind "'||(it->>'kind')||'", defaulted to question');
    END IF;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
    VALUES (fid,'flag',oid,'create',it->>'text','claude',pid);
    res := res || jsonb_strip_nulls(jsonb_build_object('op','flag.create','id',oid,'result','ok','warn',nullif(v_warn,'')));
  END LOOP;

  -- ── flagsToResolve: [{flagId | fileId/fileTitle + text, status, resolution}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'flagsToResolve','[]'::jsonb)) LOOP
    v_id := NULL; v_warn := NULL;
    IF it->>'flagId' IS NOT NULL THEN
      SELECT id INTO v_id FROM pal_flags WHERE id = it->>'flagId';
    END IF;
    IF v_id IS NULL AND coalesce(it->>'text','') <> '' THEN
      SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'fileId', it->>'fileTitle');
      SELECT count(*), min(id) INTO n1, v_id FROM pal_flags
        WHERE lower(text) = lower(it->>'text') AND status = 'open' AND (fid IS NULL OR file_id = fid);
      IF n1 > 1 THEN
        v_id := NULL; v_warn := 'ambiguous flag text ('||n1||' matches), skipped';
      ELSIF n1 = 1 THEN
        v_warn := concat_ws('; ', f_warn, 'matched flag by text');
      END IF;
    END IF;
    IF v_id IS NULL THEN
      res := res || jsonb_strip_nulls(jsonb_build_object('op','flag.resolve','ref',it,'result','skipped: no match','warn',v_warn));
      CONTINUE;
    END IF;
    UPDATE pal_flags SET
      status      = CASE WHEN coalesce(it->>'status','resolved') IN ('resolved','dropped','open') THEN coalesce(it->>'status','resolved') ELSE 'resolved' END,
      resolution  = coalesce(it->>'resolution', resolution),
      resolved_at = CASE WHEN coalesce(it->>'status','resolved') = 'open' THEN NULL ELSE CURRENT_DATE END
    WHERE id = v_id;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,package_id)
      SELECT file_id,'flag',v_id,'update',coalesce(it->>'status','resolved')||': '||text,'claude',
             jsonb_strip_nulls(jsonb_build_object('resolution',it->>'resolution')),pid
      FROM pal_flags WHERE id = v_id;
    res := res || jsonb_strip_nulls(jsonb_build_object('op','flag.resolve','id',v_id,'result','ok','warn',nullif(v_warn,'')));
  END LOOP;

  -- ── linksToCreate: [{fileId|fileTitle, label, url, type}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'linksToCreate','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'fileId', it->>'fileTitle');
    IF fid IS NULL OR coalesce(it->>'url','') = '' THEN
      res := res || jsonb_build_object('op','link.create','ref',it,'result',
               CASE WHEN fid IS NULL THEN 'skipped: file not found' ELSE 'skipped: url required' END);
      CONTINUE;
    END IF;
    INSERT INTO pal_links(file_id, label, url, type)
    VALUES (fid, coalesce(it->>'label',''), it->>'url', coalesce(it->>'type','folder'))
    RETURNING id INTO oid;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
    VALUES (fid,'link',oid,'create',coalesce(nullif(it->>'label',''), it->>'url'),'claude',pid);
    res := res || jsonb_strip_nulls(jsonb_build_object('op','link.create','id',oid,'result','ok','warn',f_warn));
  END LOOP;

  -- ── memoryUpdates: [{fileId|fileTitle, newMemory}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'memoryUpdates','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'fileId', it->>'fileTitle');
    IF fid IS NULL THEN
      res := res || jsonb_build_object('op','memory','ref',it,'result','skipped: no match');
      CONTINUE;
    END IF;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,package_id)
      SELECT fid,'file',fid,'update','memory updated','claude',
             jsonb_build_object('previousLength',length(memory),'newLength',length(it->>'newMemory')),pid
      FROM pal_files WHERE id = fid;
    UPDATE pal_files SET memory = it->>'newMemory' WHERE id = fid;
    res := res || jsonb_strip_nulls(jsonb_build_object('op','memory','id',fid,'result','ok','warn',f_warn));
  END LOOP;

  -- ── logEntriesToCreate: [{fileId|fileTitle, date, title, summary}] ──
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'logEntriesToCreate','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'fileId', it->>'fileTitle');
    IF fid IS NULL THEN
      res := res || jsonb_build_object('op','log','ref',it,'result','skipped: no match');
      CONTINUE;
    END IF;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,event_date,package_id)
    VALUES (fid,'file',fid,'log',coalesce(it->>'summary',''),'claude',
            jsonb_build_object('title',coalesce(it->>'title','Update')),
            coalesce(pal_safe_date(it->>'date'),CURRENT_DATE),pid);
    res := res || jsonb_strip_nulls(jsonb_build_object('op','log','id',fid,'result','ok','warn',f_warn));
  END LOOP;

  -- ── filesToMerge: [{sourceFileId|sourceTitle, targetFileId|targetTitle}] ──
  -- Reassigns tasks/outputs/flags/links to target, archives source, events on both.
  -- Historical events stay on the source (its archived dossier keeps its history).
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'filesToMerge','[]'::jsonb)) LOOP
    SELECT o_id, o_warn INTO fid, f_warn FROM pal_find_file(it->>'sourceFileId', it->>'sourceTitle');
    SELECT o_id, o_warn INTO tgt, t_warn FROM pal_find_file(it->>'targetFileId', it->>'targetTitle');
    IF fid IS NULL OR tgt IS NULL OR fid = tgt THEN
      res := res || jsonb_build_object('op','file.merge','ref',it,'result',
        CASE WHEN fid IS NULL THEN 'skipped: source not found'
             WHEN tgt IS NULL THEN 'skipped: target not found'
             ELSE 'skipped: source = target' END);
      CONTINUE;
    END IF;
    UPDATE pal_tasks   SET file_id = tgt WHERE file_id = fid; GET DIAGNOSTICS n1 = ROW_COUNT;
    UPDATE pal_outputs SET file_id = tgt WHERE file_id = fid; GET DIAGNOSTICS n2 = ROW_COUNT;
    UPDATE pal_flags   SET file_id = tgt WHERE file_id = fid; GET DIAGNOSTICS n3 = ROW_COUNT;
    UPDATE pal_links   SET file_id = tgt WHERE file_id = fid; GET DIAGNOSTICS n4 = ROW_COUNT;
    UPDATE pal_files SET archived = true, archived_at = CURRENT_DATE WHERE id = fid;
    INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,package_id) VALUES
      (fid,'file',fid,'merge','merged into '||(SELECT title FROM pal_files WHERE id = tgt),'claude',
       jsonb_build_object('targetId',tgt,'moved',jsonb_build_object('tasks',n1,'outputs',n2,'flags',n3,'links',n4)),pid),
      (tgt,'file',tgt,'merge','absorbed '||(SELECT title FROM pal_files WHERE id = fid),'claude',
       jsonb_build_object('sourceId',fid,'moved',jsonb_build_object('tasks',n1,'outputs',n2,'flags',n3,'links',n4)),pid);
    res := res || jsonb_strip_nulls(jsonb_build_object('op','file.merge','id',fid,'result','ok',
             'moved',jsonb_build_object('tasks',n1,'outputs',n2,'flags',n3,'links',n4),
             'warn',nullif(concat_ws('; ', f_warn, t_warn),'')));
  END LOOP;

  -- the import event seals idempotency (unique index on package_id where kind='import')
  INSERT INTO pal_events(entity,kind,summary,actor,payload,package_id)
  VALUES ('import','import',coalesce(pkg->>'summary','update'),'claude',pkg,pid);

  RETURN jsonb_build_object('status','applied','packageId',pid,'results',res,'warnings',warns);
END $$;

-- ── search_path pinning (clears advisor 0011 on all functions) ──
ALTER FUNCTION public.pal_norm_flexdate(jsonb)            SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_safe_date(text)                 SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_safe_ts(text)                   SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_safe_bool(text)                 SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_safe_float(text)                SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_people_ids(jsonb)               SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_find_file(text, text)           SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_find_task(text, text)           SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_find_output(text, text, text)   SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_export_state()                  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_snapshot(text, text)            SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_apply_update(jsonb)             SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_migrate_from_v1()               SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_touch()                         SET search_path = public, extensions, pg_temp;

-- ── least-privilege EXECUTE on the surface functions (keep INVOKER) ──
-- Reasoning: connector runs as postgres (rolbypassrls); app runs as authenticated.
-- anon must not reach the write path. authenticated keeps EXECUTE because
-- pal_apply_update is SECURITY INVOKER and calls pal_snapshot/pal_export_state in-chain.
REVOKE EXECUTE ON FUNCTION public.pal_apply_update(jsonb)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pal_apply_update(jsonb)  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pal_snapshot(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pal_snapshot(text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pal_export_state()       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pal_export_state()       TO authenticated, service_role;
-- destructive: re-migrate is service_role only
REVOKE EXECUTE ON FUNCTION public.pal_migrate_from_v1()    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.pal_migrate_from_v1()    TO service_role;

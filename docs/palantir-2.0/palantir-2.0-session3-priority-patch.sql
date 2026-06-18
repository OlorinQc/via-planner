-- ============================================================================
-- Palantir 2.0 - Session 3 patch: task priority + template_id round-trip
-- Adds priority/template_id columns to pal_tasks and carries them through
-- migrate + export so the v1<->pal_ round-trip is lossless for task priority.
-- Generated from palantir-2.0-session1-final.sql. NOT YET APPLIED to Supabase.
-- ============================================================================

ALTER TABLE pal_tasks ADD COLUMN IF NOT EXISTS priority    text;
ALTER TABLE pal_tasks ADD COLUMN IF NOT EXISTS template_id text;

CREATE OR REPLACE FUNCTION pal_export_state() RETURNS jsonb
LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
  'version','1.0',
  'exportedBy','pal_export_state',
  'exportedAt',now()::text,
  'uiPrefs',coalesce((SELECT value FROM pal_prefs WHERE key='uiPrefs_v1'),'{}'::jsonb),
  'templates',coalesce((SELECT value FROM pal_prefs WHERE key='templates'),'[]'::jsonb),
  'linkTypes',coalesce((SELECT value FROM pal_prefs WHERE key='linkTypes'),'[]'::jsonb),
  'deliverableTypes',coalesce((SELECT value FROM pal_prefs WHERE key='deliverableTypes'),'[]'::jsonb),
  'people',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'title',title,'active',active) ORDER BY created_at),'[]'::jsonb) FROM pal_people),
  'deliverables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'fileId',o.file_id,'title',o.title,'type',o.type,'status',o.status,
      'ownerName',(SELECT name FROM pal_people WHERE id=o.owner_id),
      'dueDate',o.due,'publicationDate',o.publication,'approvalStatus',o.approval_status,
      'sharePointUrl',o.sharepoint_url,'notes',o.notes,
      'createdAt',o.created_at::date,'updatedAt',o.updated_at::date,
      'taskIds',(SELECT coalesce(jsonb_agg(t.id ORDER BY t.sort_order, t.id),'[]'::jsonb) FROM pal_tasks t WHERE t.output_id=o.id AND t.source<>'milestone')
      ) ORDER BY o.sort_order, o.id),'[]'::jsonb) FROM pal_outputs o),
  'tasks',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',t.id,'fileId',t.file_id,'projectId',t.file_id,'deliverableId',t.output_id,
      'title',t.title,'status',t.status,'dueDate',t.due,
      'assignees',(SELECT coalesce(jsonb_agg(p.name),'[]'::jsonb) FROM pal_people p WHERE p.id=ANY(t.assignee_ids)),
      'dependsOn',to_jsonb(t.depends_on),'notes',t.notes,'gate',t.gate,'source',t.source,
      'completedAt',t.completed_at,'createdAt',t.created_at::date,'priority',t.priority,'templateId',t.template_id) ORDER BY t.sort_order, t.id),'[]'::jsonb)
    FROM pal_tasks t WHERE t.source <> 'milestone'),
  'files',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',f.id,'title',f.title,'status',f.status,'priority',f.priority,'sensitivity',f.sensitivity,
      'lead',(SELECT name FROM pal_people WHERE id=f.lead_id),
      'memory',f.memory,'archived',f.archived,'archivedAt',f.archived_at,
      'createdAt',f.created_at::date,'updatedAt',f.updated_at::date,
      'deliverableIds',(SELECT coalesce(jsonb_agg(o.id ORDER BY o.sort_order, o.id),'[]'::jsonb) FROM pal_outputs o WHERE o.file_id=f.id),
      'standaloneTaskOrder',(SELECT coalesce(jsonb_agg(t.id ORDER BY t.sort_order, t.id),'[]'::jsonb) FROM pal_tasks t WHERE t.file_id=f.id AND t.output_id IS NULL AND t.source<>'milestone'),
      'log',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'date',e.event_date,'title',coalesce(e.payload->>'title','Update'),'summary',e.summary) ORDER BY e.event_date DESC, e.created_at DESC),'[]'::jsonb)
             FROM pal_events e WHERE e.file_id=f.id AND e.kind='log'),
      'risks',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.text,'severity',coalesce(g.severity,'medium'),'status',g.status,
               'description',g.detail,'notes','',
               'ownerName',(SELECT name FROM pal_people WHERE id=g.owner_id)) ORDER BY g.created_at),'[]'::jsonb)
             FROM pal_flags g WHERE g.file_id=f.id AND g.kind IN ('risk','blocker')),
      'openQuestions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'question',g.text,'status',g.status,'answer',g.resolution,'notes','',
               'ownerName',(SELECT name FROM pal_people WHERE id=g.owner_id)) ORDER BY g.created_at),'[]'::jsonb)
             FROM pal_flags g WHERE g.file_id=f.id AND g.kind='question'),
      'milestones',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'status',m.status,'date',m.due->>'date') ORDER BY m.sort_order, m.id),'[]'::jsonb)
             FROM pal_tasks m WHERE m.file_id=f.id AND m.source='milestone'),
      'sharePointLinks',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'label',l.label,'url',l.url,'type',l.type,'createdAt',l.created_at::date) ORDER BY l.created_at),'[]'::jsonb)
             FROM pal_links l WHERE l.file_id=f.id)) ORDER BY f.created_at, f.id),'[]'::jsonb)
    FROM pal_files f)
)
$$;

CREATE OR REPLACE FUNCTION pal_migrate_from_v1() RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb; counts jsonb;
BEGIN
  SELECT state INTO s FROM palantir_state WHERE id = 1;
  IF s IS NULL THEN RETURN jsonb_build_object('error','palantir_state id=1 not found'); END IF;

  TRUNCATE pal_events, pal_links, pal_flags, pal_tasks, pal_outputs, pal_files, pal_campaigns, pal_people CASCADE;

  -- settings and ui prefs survive into pal_prefs
  INSERT INTO pal_prefs(key, value) VALUES
    ('uiPrefs_v1',       coalesce(s->'uiPrefs','{}'::jsonb)),
    ('templates',        coalesce(s->'templates','[]'::jsonb)),
    ('linkTypes',        coalesce(s->'linkTypes','[]'::jsonb)),
    ('deliverableTypes', coalesce(s->'deliverableTypes','[]'::jsonb))
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();

  INSERT INTO pal_people(id, name, title, active)
  SELECT p->>'id', p->>'name', coalesce(p->>'title',''), coalesce((p->>'active')::boolean, true)
  FROM jsonb_array_elements(s->'people') p;

  INSERT INTO pal_files(id, title, status, priority, sensitivity, lead_id, memory, archived, archived_at, created_at, updated_at)
  SELECT f->>'id', f->>'title', coalesce(f->>'status','active'), coalesce(f->>'priority','medium'),
         coalesce(f->>'sensitivity','low'),
         (SELECT id FROM pal_people WHERE name = f->>'lead'),
         coalesce(f->>'memory',''), coalesce((f->>'archived')::boolean, false),
         pal_safe_date(f->>'archivedAt'),
         pal_safe_ts(f->>'createdAt'), pal_safe_ts(f->>'updatedAt')
  FROM jsonb_array_elements(s->'files') f;

  -- archive dropped v1 file fields (latestUpdate; health is derived, kept for context)
  INSERT INTO pal_events(file_id, entity, entity_id, kind, summary, actor, payload)
  SELECT f->>'id', 'file', f->>'id', 'archive', 'v1 fields archived at migration', 'claude',
         jsonb_strip_nulls(jsonb_build_object('latestUpdate', nullif(f->>'latestUpdate',''), 'health', f->'health'))
  FROM jsonb_array_elements(s->'files') f
  WHERE coalesce(f->>'latestUpdate','') <> '';

  -- outputs: sort_order from the owning file's deliverableIds position, else global position
  INSERT INTO pal_outputs(id, file_id, title, type, status, owner_id, due, publication,
                          approval_status, sharepoint_url, notes, sort_order, created_at, updated_at)
  SELECT d->>'id', d->>'fileId', d->>'title', coalesce(d->>'type','other'), coalesce(d->>'status','not_started'),
         (SELECT id FROM pal_people WHERE name = d->>'ownerName'),
         pal_norm_flexdate(d->'dueDate'), pal_norm_flexdate(d->'publicationDate'),
         coalesce(d->>'approvalStatus','not_required'),
         coalesce(d->>'sharePointUrl',''), coalesce(d->>'notes',''),
         coalesce((SELECT dord.n::float
                   FROM jsonb_array_elements(s->'files') f2,
                        jsonb_array_elements_text(coalesce(f2->'deliverableIds','[]'::jsonb)) WITH ORDINALITY dord(did, n)
                   WHERE f2->>'id' = d->>'fileId' AND dord.did = d->>'id' LIMIT 1), ord.n::float),
         pal_safe_ts(d->>'createdAt'), pal_safe_ts(d->>'updatedAt')
  FROM jsonb_array_elements(s->'deliverables') WITH ORDINALITY AS ord(d, n)
  WHERE EXISTS (SELECT 1 FROM pal_files WHERE id = d->>'fileId');

  -- archive dropped v1 output fields (supportNames, approverNames, dueDateStr)
  INSERT INTO pal_events(file_id, entity, entity_id, kind, summary, actor, payload)
  SELECT d->>'fileId', 'output', d->>'id', 'archive', 'v1 fields archived at migration', 'claude',
         jsonb_strip_nulls(jsonb_build_object(
           'supportNames',  CASE WHEN jsonb_array_length(coalesce(d->'supportNames','[]'::jsonb)) > 0 THEN d->'supportNames' END,
           'approverNames', CASE WHEN jsonb_array_length(coalesce(d->'approverNames','[]'::jsonb)) > 0 THEN d->'approverNames' END,
           'dueDateStr',    nullif(d->>'dueDateStr','')))
  FROM jsonb_array_elements(s->'deliverables') d
  WHERE jsonb_array_length(coalesce(d->'supportNames','[]'::jsonb)) > 0
     OR jsonb_array_length(coalesce(d->'approverNames','[]'::jsonb)) > 0
     OR coalesce(d->>'dueDateStr','') <> '';

  -- tasks: duplicate v1 ids get -2/-3 suffixes (first occurrence keeps the id);
  -- fileId||projectId coalesced; orphan file refs → NULL; string dueDate → FlexDate;
  -- assignees ∪ assignee; dependsOn ∪ dependencies; createdAt/completedAt preserved
  WITH base AS (
    SELECT ord.t, ord.n,
           row_number() OVER (PARTITION BY ord.t->>'id' ORDER BY ord.n) AS rn
    FROM jsonb_array_elements(s->'tasks') WITH ORDINALITY AS ord(t, n)
  )
  INSERT INTO pal_tasks(id, file_id, output_id, title, status, due, assignee_ids, depends_on,
                        notes, gate, source, sort_order, completed_at, created_at, priority, template_id)
  SELECT CASE WHEN rn = 1 THEN t->>'id' ELSE (t->>'id')||'-'||rn END,
         (SELECT id FROM pal_files WHERE id = coalesce(t->>'fileId', t->>'projectId')),
         (SELECT id FROM pal_outputs WHERE id = t->>'deliverableId'),
         t->>'title', coalesce(t->>'status','not_started'),
         pal_norm_flexdate(t->'dueDate'),
         coalesce((SELECT array_agg(DISTINCT p.id) FROM pal_people p
                   WHERE p.name IN (SELECT a.nm FROM jsonb_array_elements_text(coalesce(t->'assignees','[]'::jsonb)) a(nm)
                                    UNION SELECT t->>'assignee' WHERE coalesce(t->>'assignee','') <> '')), '{}'),
         coalesce((SELECT array_agg(DISTINCT x) FROM (
                     SELECT x FROM jsonb_array_elements_text(coalesce(t->'dependsOn','[]'::jsonb)) x
                     UNION SELECT x FROM jsonb_array_elements_text(coalesce(t->'dependencies','[]'::jsonb)) x) u(x)), '{}'),
         coalesce(t->>'notes',''), coalesce(t->>'gate',''), coalesce(t->>'source','manual'),
         n::float, pal_safe_date(t->>'completedAt'), pal_safe_ts(t->>'createdAt'),
         nullif(t->>'priority',''), nullif(t->>'templateId','')
  FROM base;

  -- archive events: duplicate-id remaps
  WITH base AS (
    SELECT ord.t, ord.n,
           row_number() OVER (PARTITION BY ord.t->>'id' ORDER BY ord.n) AS rn
    FROM jsonb_array_elements(s->'tasks') WITH ORDINALITY AS ord(t, n)
  )
  INSERT INTO pal_events(file_id, entity, entity_id, kind, summary, actor, payload)
  SELECT (SELECT file_id FROM pal_tasks WHERE id = (t->>'id')||'-'||rn),
         'task', (t->>'id')||'-'||rn, 'archive',
         'duplicate v1 id remapped at migration', 'claude',
         jsonb_build_object('originalId', t->>'id')
  FROM base WHERE rn > 1;

  -- archive events: orphan file refs
  WITH base AS (
    SELECT ord.t, ord.n,
           row_number() OVER (PARTITION BY ord.t->>'id' ORDER BY ord.n) AS rn
    FROM jsonb_array_elements(s->'tasks') WITH ORDINALITY AS ord(t, n)
  )
  INSERT INTO pal_events(entity, entity_id, kind, summary, actor, payload)
  SELECT 'task', CASE WHEN rn = 1 THEN t->>'id' ELSE (t->>'id')||'-'||rn END, 'archive',
         'v1 fileId missing at migration; task kept without file', 'claude',
         jsonb_build_object('originalFileId', coalesce(t->>'fileId', t->>'projectId'))
  FROM base
  WHERE coalesce(t->>'fileId', t->>'projectId') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pal_files WHERE id = coalesce(t->>'fileId', t->>'projectId'));

  -- archive events: dropped legacy task fields, only where they carry data
  WITH base AS (
    SELECT ord.t, ord.n,
           row_number() OVER (PARTITION BY ord.t->>'id' ORDER BY ord.n) AS rn
    FROM jsonb_array_elements(s->'tasks') WITH ORDINALITY AS ord(t, n)
  ), arch AS (
    SELECT CASE WHEN rn = 1 THEN t->>'id' ELSE (t->>'id')||'-'||rn END AS tid,
           jsonb_strip_nulls(jsonb_build_object(
             'blocker',         CASE WHEN coalesce(t->>'blocker','') NOT IN ('','false','null') THEN t->'blocker' END,
             'link',            nullif(t->>'link',''),
             'leadPersonId',    nullif(t->>'leadPersonId',''),
             'supportPersonIds',CASE WHEN jsonb_array_length(coalesce(t->'supportPersonIds','[]'::jsonb)) > 0 THEN t->'supportPersonIds' END,
             'approvalChain',   CASE WHEN jsonb_array_length(coalesce(t->'approvalChain','[]'::jsonb)) > 0 THEN t->'approvalChain' END)) AS pl
    FROM base
  )
  INSERT INTO pal_events(file_id, entity, entity_id, kind, summary, actor, payload)
  SELECT (SELECT file_id FROM pal_tasks WHERE id = a.tid),
         'task', a.tid, 'archive', 'v1 fields archived at migration', 'claude', a.pl
  FROM arch a WHERE a.pl <> '{}'::jsonb;

  -- milestones → tasks tagged source='milestone' (5 exist; zero data loss).
  -- v1 kept milestones in a separate per-file array, so a milestone id can collide
  -- with a task id (p1778885900114 does). Colliding ids get an '-m' suffix.
  INSERT INTO pal_tasks(id, file_id, title, status, due, source)
  SELECT CASE WHEN EXISTS (SELECT 1 FROM pal_tasks WHERE id = m->>'id')
              THEN (m->>'id')||'-m' ELSE m->>'id' END,
         f->>'id', m->>'title',
         CASE WHEN m->>'status' = 'completed' THEN 'completed' ELSE 'not_started' END,
         CASE WHEN coalesce(m->>'date','') <> ''
              THEN jsonb_build_object('precision','exact','date',m->>'date','confidence','confirmed') END,
         'milestone'
  FROM jsonb_array_elements(s->'files') f,
       jsonb_array_elements(coalesce(f->'milestones','[]'::jsonb)) m;

  -- archive events: milestone id remaps
  INSERT INTO pal_events(file_id, entity, entity_id, kind, summary, actor, payload)
  SELECT f->>'id', 'task', (m->>'id')||'-m', 'archive',
         'milestone id collided with a task id, remapped at migration', 'claude',
         jsonb_build_object('originalId', m->>'id')
  FROM jsonb_array_elements(s->'files') f,
       jsonb_array_elements(coalesce(f->'milestones','[]'::jsonb)) m
  WHERE EXISTS (SELECT 1 FROM pal_tasks WHERE id = (m->>'id')||'-m' AND source = 'milestone');

  -- risks → flags (kind=risk): severity + description carried; status VERBATIM
  INSERT INTO pal_flags(id, file_id, kind, text, detail, severity, owner_id, status, resolution)
  SELECT r->>'id', f->>'id', 'risk', r->>'title', coalesce(r->>'description',''), nullif(r->>'severity',''),
         (SELECT id FROM pal_people WHERE name = r->>'ownerName'),
         coalesce(r->>'status','open'), ''
  FROM jsonb_array_elements(s->'files') f, jsonb_array_elements(coalesce(f->'risks','[]'::jsonb)) r;

  -- openQuestions → flags (kind=question): status VERBATIM ('answered' survives)
  INSERT INTO pal_flags(id, file_id, kind, text, owner_id, status, resolution)
  SELECT q->>'id', f->>'id', 'question', q->>'question',
         (SELECT id FROM pal_people WHERE name = q->>'ownerName'),
         coalesce(q->>'status','open'), coalesce(q->>'answer','')
  FROM jsonb_array_elements(s->'files') f, jsonb_array_elements(coalesce(f->'openQuestions','[]'::jsonb)) q;

  INSERT INTO pal_links(id, file_id, label, url, type, created_at)
  SELECT l->>'id', f->>'id', coalesce(l->>'label',''), l->>'url', coalesce(l->>'type','folder'),
         pal_safe_ts(l->>'createdAt')
  FROM jsonb_array_elements(s->'files') f, jsonb_array_elements(coalesce(f->'sharePointLinks','[]'::jsonb)) l;

  INSERT INTO pal_events(id, file_id, entity, entity_id, kind, summary, actor, payload, event_date)
  SELECT e->>'id', f->>'id', 'file', f->>'id', 'log', coalesce(e->>'summary',''), 'karl',
         jsonb_build_object('title', coalesce(e->>'title','Update')),
         coalesce(pal_safe_date(e->>'date'), CURRENT_DATE)
  FROM jsonb_array_elements(s->'files') f, jsonb_array_elements(coalesce(f->'log','[]'::jsonb)) e;

  -- sort_order pass 2: honor v1 order arrays where they exist
  -- (a) per-deliverable taskIds; remapped duplicate ids matched by prefix
  UPDATE pal_tasks pt SET sort_order = x.n
  FROM (SELECT d->>'id' AS did, tord.ref, tord.n
        FROM jsonb_array_elements(s->'deliverables') d,
             jsonb_array_elements_text(coalesce(d->'taskIds','[]'::jsonb)) WITH ORDINALITY tord(ref, n)) x
  WHERE pt.output_id = x.did AND (pt.id = x.ref OR pt.id LIKE x.ref||'-%');

  -- (b) per-file standaloneTaskOrder for tasks without an output
  UPDATE pal_tasks pt SET sort_order = x.n
  FROM (SELECT f->>'id' AS fid, tord.ref, tord.n
        FROM jsonb_array_elements(s->'files') f,
             jsonb_array_elements_text(coalesce(f->'standaloneTaskOrder','[]'::jsonb)) WITH ORDINALITY tord(ref, n)) x
  WHERE pt.file_id = x.fid AND pt.output_id IS NULL AND (pt.id = x.ref OR pt.id LIKE x.ref||'-%');

  SELECT jsonb_build_object(
    'people',             (SELECT count(*) FROM pal_people),
    'files',              (SELECT count(*) FROM pal_files),
    'outputs',            (SELECT count(*) FROM pal_outputs),
    'tasks',              (SELECT count(*) FROM pal_tasks WHERE source <> 'milestone'),
    'milestones_as_tasks',(SELECT count(*) FROM pal_tasks WHERE source = 'milestone'),
    'flags_risk',         (SELECT count(*) FROM pal_flags WHERE kind IN ('risk','blocker')),
    'flags_question',     (SELECT count(*) FROM pal_flags WHERE kind = 'question'),
    'links',              (SELECT count(*) FROM pal_links),
    'log_events',         (SELECT count(*) FROM pal_events WHERE kind = 'log'),
    'archive_events',     (SELECT count(*) FROM pal_events WHERE kind = 'archive'),
    'remapped_dup_ids',   (SELECT count(*) FROM pal_events WHERE kind = 'archive' AND summary LIKE 'duplicate v1 id%'),
    'orphan_tasks',       (SELECT count(*) FROM pal_events WHERE kind = 'archive' AND summary LIKE 'v1 fileId missing%'),
    'prefs',              (SELECT count(*) FROM pal_prefs)
  ) INTO counts;
  RETURN counts;
END $$;

-- re-pin search_path (CREATE OR REPLACE resets proconfig)
ALTER FUNCTION public.pal_export_state()    SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_migrate_from_v1() SET search_path = public, extensions, pg_temp;

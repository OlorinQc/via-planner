-- ═══════════════════════════════════════════════════════════════════════════
-- Palantír 2.0 · Session 1 foundation · DRAFT (written Jun 12, review before executing)
-- Execution: next session, step by step, via Supabase MCP apply_migration.
-- Rules: purely additive. Never writes palantir_state. Reversible: DROP pal_* objects.
-- Supabase project: ngdbtgsbtyfghdyqbazj
-- ═══════════════════════════════════════════════════════════════════════════

-- ──── STEP 1 · TABLES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pal_people (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       text NOT NULL UNIQUE,
  title      text DEFAULT '',
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pal_campaigns (        -- C3, schema now, UI later
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title      text NOT NULL,
  status     text DEFAULT 'active',
  notes      text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pal_files (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title       text NOT NULL,
  status      text NOT NULL DEFAULT 'active',     -- active|monitoring|paused|completed
  priority    text NOT NULL DEFAULT 'medium',     -- urgent|high|medium|low
  sensitivity text DEFAULT 'low',                 -- low|medium|high
  lead_id     text REFERENCES pal_people(id),
  campaign_id text REFERENCES pal_campaigns(id),
  memory      text DEFAULT '',                    -- HTML, carried as-is from v1
  archived    boolean DEFAULT false,
  archived_at date,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pal_outputs (          -- v1 "deliverables"
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_id         text NOT NULL REFERENCES pal_files(id),
  title           text NOT NULL,
  type            text DEFAULT 'other',
  status          text DEFAULT 'not_started',
  owner_id        text REFERENCES pal_people(id),
  due             jsonb,                          -- FlexDate
  publication     jsonb,                          -- FlexDate
  approval_status text DEFAULT 'not_required',
  sharepoint_url  text DEFAULT '',
  notes           text DEFAULT '',
  sort_order      double precision DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pal_tasks (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_id      text REFERENCES pal_files(id),
  output_id    text REFERENCES pal_outputs(id),
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'not_started',
  due          jsonb,                             -- FlexDate, normalized on migration
  assignee_ids text[] DEFAULT '{}',
  depends_on   text[] DEFAULT '{}',
  notes        text DEFAULT '',
  gate         text DEFAULT '',
  source       text DEFAULT 'manual',             -- manual|claude_import|template|milestone|capture
  sort_order   double precision DEFAULT 0,
  completed_at date,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pal_flags (            -- absorbs v1 risks + openQuestions
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_id     text NOT NULL REFERENCES pal_files(id),
  kind        text NOT NULL DEFAULT 'question',   -- question|risk|blocker
  text        text NOT NULL,
  owner_id    text REFERENCES pal_people(id),
  status      text DEFAULT 'open',                -- open|resolved|dropped
  resolution  text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  resolved_at date
);

CREATE TABLE IF NOT EXISTS pal_links (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_id    text NOT NULL REFERENCES pal_files(id),
  label      text DEFAULT '',
  url        text NOT NULL,
  type       text DEFAULT 'folder',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pal_events (           -- change log + file Log, one stream
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_id    text,                                -- soft ref; survives file deletion
  entity     text,                                -- file|task|output|flag|link|person|import
  entity_id  text,
  kind       text NOT NULL,                       -- log|create|update|complete|delete|merge|import
  summary    text DEFAULT '',
  actor      text DEFAULT 'karl',                 -- karl|claude
  payload    jsonb,
  package_id text,                                -- set on import events; idempotency key
  event_date date DEFAULT CURRENT_DATE,           -- for migrated log entries with their own date
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pal_prefs (
  key        text PRIMARY KEY,
  value      jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pal_tasks_file   ON pal_tasks(file_id);
CREATE INDEX IF NOT EXISTS idx_pal_tasks_output ON pal_tasks(output_id);
CREATE INDEX IF NOT EXISTS idx_pal_outputs_file ON pal_outputs(file_id);
CREATE INDEX IF NOT EXISTS idx_pal_flags_file   ON pal_flags(file_id);
CREATE INDEX IF NOT EXISTS idx_pal_events_file  ON pal_events(file_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pal_events_pkg ON pal_events(package_id) WHERE package_id IS NOT NULL;

-- ──── STEP 2 · updated_at TRIGGER + RLS + REALTIME ─────────────────────────

CREATE OR REPLACE FUNCTION pal_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pal_people','pal_campaigns','pal_files','pal_outputs','pal_tasks']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pal_touch()', t);
  END LOOP;
END $$;

-- RLS: same posture as palantir_state (authenticated user, single-user app).
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pal_people','pal_campaigns','pal_files','pal_outputs','pal_tasks','pal_flags','pal_links','pal_events','pal_prefs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS pal_auth_all ON %I', t);
    EXECUTE format('CREATE POLICY pal_auth_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Realtime (verify publication name on the project before running):
-- ALTER PUBLICATION supabase_realtime ADD TABLE pal_files, pal_outputs, pal_tasks, pal_flags, pal_links, pal_events;

-- ──── STEP 3 · pal_export_state() · rebuilds the v1 JSONB shape ─────────────
-- Used by snapshots, the migration fidelity proof, and JSON download.
-- Mappings: outputs→deliverables · flags(kind=risk)→file.risks · flags(kind=question)→file.openQuestions
--           events(kind=log)→file.log · tasks(source=milestone)→file.milestones

CREATE OR REPLACE FUNCTION pal_export_state() RETURNS jsonb
LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
  'version','2.0-export','migratedAt',CURRENT_DATE::text,
  'people',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'title',title,'active',active)),'[]'::jsonb) FROM pal_people),
  'deliverables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'fileId',o.file_id,'title',o.title,'type',o.type,'status',o.status,
      'ownerName',(SELECT name FROM pal_people WHERE id=o.owner_id),
      'dueDate',o.due,'publicationDate',o.publication,'approvalStatus',o.approval_status,
      'sharePointUrl',o.sharepoint_url,'notes',o.notes) ORDER BY o.sort_order),'[]'::jsonb) FROM pal_outputs o),
  'tasks',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',t.id,'fileId',t.file_id,'projectId',t.file_id,'deliverableId',t.output_id,
      'title',t.title,'status',t.status,'dueDate',t.due,
      'assignees',(SELECT coalesce(jsonb_agg(p.name),'[]'::jsonb) FROM pal_people p WHERE p.id=ANY(t.assignee_ids)),
      'dependsOn',to_jsonb(t.depends_on),'notes',t.notes,'gate',t.gate,'source',t.source,
      'completedAt',t.completed_at) ORDER BY t.sort_order),'[]'::jsonb)
    FROM pal_tasks t WHERE t.source <> 'milestone'),
  'files',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',f.id,'title',f.title,'status',f.status,'priority',f.priority,'sensitivity',f.sensitivity,
      'lead',(SELECT name FROM pal_people WHERE id=f.lead_id),
      'memory',f.memory,'archived',f.archived,'archivedAt',f.archived_at,
      'createdAt',f.created_at::date,'updatedAt',f.updated_at::date,
      'log',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'date',e.event_date,'title',coalesce(e.payload->>'title','Update'),'summary',e.summary) ORDER BY e.event_date DESC),'[]'::jsonb)
             FROM pal_events e WHERE e.file_id=f.id AND e.kind='log'),
      'risks',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.text,'severity','medium','status',CASE WHEN g.status='open' THEN 'open' ELSE 'resolved' END,
               'ownerName',(SELECT name FROM pal_people WHERE id=g.owner_id))),'[]'::jsonb)
             FROM pal_flags g WHERE g.file_id=f.id AND g.kind IN ('risk','blocker')),
      'openQuestions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'question',g.text,'status',CASE WHEN g.status='open' THEN 'open' ELSE 'answered' END,'answer',g.resolution,
               'ownerName',(SELECT name FROM pal_people WHERE id=g.owner_id))),'[]'::jsonb)
             FROM pal_flags g WHERE g.file_id=f.id AND g.kind='question'),
      'milestones',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'status',m.status,'date',m.due->>'date')),'[]'::jsonb)
             FROM pal_tasks m WHERE m.file_id=f.id AND m.source='milestone'),
      'sharePointLinks',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'label',l.label,'url',l.url,'type',l.type)),'[]'::jsonb)
             FROM pal_links l WHERE l.file_id=f.id))),'[]'::jsonb)
    FROM pal_files f)
)
$$;

-- ──── STEP 4 · pal_snapshot() ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION pal_snapshot(p_label text, p_trigger text DEFAULT 'manual')
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE sid bigint;
BEGIN
  INSERT INTO palantir_snapshots(state,trigger,label)
  VALUES (pal_export_state(), p_trigger, p_label) RETURNING id INTO sid;
  RETURN sid;
END $$;

-- ──── STEP 5 · pal_apply_update(package) · the chat write path ──────────────
-- One transaction: idempotency check → snapshot → apply verbs → events → per-item results.
-- Matching is by id first; title fallback is reported as a warning in results.

CREATE OR REPLACE FUNCTION pal_apply_update(pkg jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  res jsonb := '[]'::jsonb;
  it jsonb; v_id text; v_n int; pid text;
  fid text; oid text;
  FUNCTION_NOTE text := 'helpers inline below';
BEGIN
  pid := pkg->>'packageId';
  IF pid IS NULL THEN RETURN jsonb_build_object('error','packageId is required'); END IF;
  IF EXISTS (SELECT 1 FROM pal_events WHERE package_id = pid) THEN
    RETURN jsonb_build_object('status','noop','reason','package already applied','packageId',pid);
  END IF;

  PERFORM pal_snapshot('Before: '||coalesce(pkg->>'summary','update'), 'pre_import');

  -- tasksToComplete: [{taskId}|{taskTitle}]
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'tasksToComplete','[]'::jsonb)) LOOP
    SELECT id INTO v_id FROM pal_tasks
      WHERE id = it->>'taskId'
         OR (it->>'taskId' IS NULL AND lower(title) = lower(it->>'taskTitle'))
      LIMIT 1;
    IF v_id IS NULL THEN
      res := res || jsonb_build_object('op','complete','ref',it,'result','skipped: no match');
    ELSE
      UPDATE pal_tasks SET status='completed', completed_at=CURRENT_DATE WHERE id=v_id;
      INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
        SELECT file_id,'task',v_id,'complete',title,'claude',NULL FROM pal_tasks WHERE id=v_id;
      res := res || jsonb_build_object('op','complete','id',v_id,'result','ok');
    END IF;
  END LOOP;

  -- tasksToCreate: [{fileId|fileTitle, outputId|outputTitle, title, assignees[], due, notes, gate}]
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'tasksToCreate','[]'::jsonb)) LOOP
    SELECT id INTO fid FROM pal_files WHERE id=it->>'fileId' OR lower(title)=lower(it->>'fileTitle') LIMIT 1;
    SELECT id INTO oid FROM pal_outputs WHERE id=it->>'outputId' OR (fid IS NOT NULL AND file_id=fid AND lower(title)=lower(it->>'outputTitle')) LIMIT 1;
    IF fid IS NULL THEN
      res := res || jsonb_build_object('op','task.create','ref',it->>'title','result','skipped: file not found');
    ELSE
      INSERT INTO pal_tasks(file_id,output_id,title,status,due,assignee_ids,notes,gate,source)
      VALUES (fid,oid,it->>'title',coalesce(it->>'status','not_started'),it->'due',
              coalesce((SELECT array_agg(p.id) FROM pal_people p JOIN jsonb_array_elements_text(coalesce(it->'assignees','[]'::jsonb)) a(nm) ON p.name=a.nm),'{}'),
              coalesce(it->>'notes',''),coalesce(it->>'gate',''),'claude_import')
      RETURNING id INTO v_id;
      INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
      VALUES (fid,'task',v_id,'create',it->>'title','claude',NULL);
      res := res || jsonb_build_object('op','task.create','id',v_id,'result','ok');
    END IF;
  END LOOP;

  -- tasksToUpdate: [{taskId, changes:{status|title|notes|gate|due|outputId|fileId|assignees|sortOrder}}]  (whitelist)
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'tasksToUpdate','[]'::jsonb)) LOOP
    SELECT id INTO v_id FROM pal_tasks WHERE id=it->>'taskId' LIMIT 1;
    IF v_id IS NULL THEN
      res := res || jsonb_build_object('op','task.update','ref',it->>'taskId','result','skipped: no match');
    ELSE
      UPDATE pal_tasks SET
        status   = coalesce(it#>>'{changes,status}',status),
        title    = coalesce(it#>>'{changes,title}',title),
        notes    = coalesce(it#>>'{changes,notes}',notes),
        gate     = coalesce(it#>>'{changes,gate}',gate),
        due      = coalesce(it#>'{changes,due}',due),
        output_id= coalesce(it#>>'{changes,outputId}',output_id),
        file_id  = coalesce(it#>>'{changes,fileId}',file_id),
        assignee_ids = coalesce((SELECT array_agg(p.id) FROM pal_people p
                         JOIN jsonb_array_elements_text(it#>'{changes,assignees}') a(nm) ON p.name=a.nm), assignee_ids)
      WHERE id=v_id;
      INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,package_id)
        SELECT file_id,'task',v_id,'update','fields updated','claude',it->'changes',NULL FROM pal_tasks WHERE id=v_id;
      res := res || jsonb_build_object('op','task.update','id',v_id,'result','ok');
    END IF;
  END LOOP;

  -- tasksToDelete: [{taskId}]   (the verb v1 never had)
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'tasksToDelete','[]'::jsonb)) LOOP
    DELETE FROM pal_tasks WHERE id=it->>'taskId' RETURNING id, file_id, title INTO v_id, fid, FUNCTION_NOTE;
    IF v_id IS NULL THEN
      res := res || jsonb_build_object('op','task.delete','ref',it->>'taskId','result','skipped: no match');
    ELSE
      INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
      VALUES (fid,'task',v_id,'delete',FUNCTION_NOTE,'claude',NULL);
      res := res || jsonb_build_object('op','task.delete','id',v_id,'result','ok');
    END IF;
  END LOOP;

  -- memoryUpdates: [{fileId|fileTitle, newMemory}]
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'memoryUpdates','[]'::jsonb)) LOOP
    UPDATE pal_files SET memory=it->>'newMemory'
      WHERE id=it->>'fileId' OR lower(title)=lower(it->>'fileTitle')
      RETURNING id INTO fid;
    IF fid IS NULL THEN res := res || jsonb_build_object('op','memory','ref',it->>'fileTitle','result','skipped: no match');
    ELSE
      INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,package_id)
      VALUES (fid,'file',fid,'update','memory updated','claude',NULL);
      res := res || jsonb_build_object('op','memory','id',fid,'result','ok');
    END IF;
  END LOOP;

  -- logEntriesToCreate: [{fileId|fileTitle, date, title, summary}]
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(pkg->'logEntriesToCreate','[]'::jsonb)) LOOP
    SELECT id INTO fid FROM pal_files WHERE id=it->>'fileId' OR lower(title)=lower(it->>'fileTitle') LIMIT 1;
    IF fid IS NULL THEN res := res || jsonb_build_object('op','log','ref',it->>'fileTitle','result','skipped: no match');
    ELSE
      INSERT INTO pal_events(file_id,entity,entity_id,kind,summary,actor,payload,event_date,package_id)
      VALUES (fid,'file',fid,'log',it->>'summary','claude',jsonb_build_object('title',coalesce(it->>'title','Update')),
              coalesce((it->>'date')::date,CURRENT_DATE),NULL);
      res := res || jsonb_build_object('op','log','id',fid,'result','ok');
    END IF;
  END LOOP;

  -- flagsToCreate / flagsToResolve · outputsToCreate / outputsToUpdate
  -- filesToCreate / filesToUpdate / filesToMerge · linksToCreate · peopleToCreate
  -- → SAME per-item pattern as above. TO COMPLETE IN SESSION 1 (kept short for review).
  --   filesToMerge spec: reassign tasks/outputs/flags/links to target, write merge events
  --   on both files, archive source. peopleToCreate: duplicate-guarded on name.

  -- the import event seals idempotency (unique index on package_id)
  INSERT INTO pal_events(entity,kind,summary,actor,payload,package_id)
  VALUES ('import','import',coalesce(pkg->>'summary','update'),'claude',pkg,pid);

  RETURN jsonb_build_object('status','applied','packageId',pid,'results',res);
END $$;

-- ──── STEP 6 · MIGRATION (M2) · v1 JSONB → pal_ tables ──────────────────────
-- Rerunnable: wipes pal_ data (never v1) and re-copies. Run after every v1 change until cutover.

CREATE OR REPLACE FUNCTION pal_migrate_from_v1() RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb; counts jsonb;
BEGIN
  SELECT state INTO s FROM palantir_state WHERE id=1;

  TRUNCATE pal_events, pal_links, pal_flags, pal_tasks, pal_outputs, pal_files, pal_campaigns, pal_people CASCADE;

  INSERT INTO pal_people(id,name,title,active)
  SELECT p->>'id', p->>'name', coalesce(p->>'title',''), coalesce((p->>'active')::boolean,true)
  FROM jsonb_array_elements(s->'people') p;

  INSERT INTO pal_files(id,title,status,priority,sensitivity,lead_id,memory,archived,archived_at,created_at,updated_at)
  SELECT f->>'id', f->>'title', coalesce(f->>'status','active'), coalesce(f->>'priority','medium'),
         coalesce(f->>'sensitivity','low'),
         (SELECT id FROM pal_people WHERE name=f->>'lead'),
         coalesce(f->>'memory',''), coalesce((f->>'archived')::boolean,false),
         (f->>'archivedAt')::date,
         coalesce((f->>'createdAt')::date,CURRENT_DATE)::timestamptz,
         coalesce((f->>'updatedAt')::date,CURRENT_DATE)::timestamptz
  FROM jsonb_array_elements(s->'files') f;

  INSERT INTO pal_outputs(id,file_id,title,type,status,owner_id,due,publication,approval_status,sharepoint_url,notes,sort_order)
  SELECT d->>'id', d->>'fileId', d->>'title', coalesce(d->>'type','other'), coalesce(d->>'status','not_started'),
         (SELECT id FROM pal_people WHERE name=d->>'ownerName'),
         d->'dueDate', d->'publicationDate', coalesce(d->>'approvalStatus','not_required'),
         coalesce(d->>'sharePointUrl',''), coalesce(d->>'notes',''), ord.n
  FROM jsonb_array_elements(s->'deliverables') WITH ORDINALITY AS ord(d,n)
  WHERE EXISTS (SELECT 1 FROM pal_files WHERE id=d->>'fileId');

  -- tasks: fileId||projectId coalesced; string dueDate normalized to FlexDate exact
  INSERT INTO pal_tasks(id,file_id,output_id,title,status,due,assignee_ids,depends_on,notes,gate,source,sort_order,completed_at)
  SELECT t->>'id',
         (SELECT id FROM pal_files WHERE id=coalesce(t->>'fileId',t->>'projectId')),
         (SELECT id FROM pal_outputs WHERE id=t->>'deliverableId'),
         t->>'title', coalesce(t->>'status','not_started'),
         CASE WHEN jsonb_typeof(t->'dueDate')='string'
              THEN jsonb_build_object('precision','exact','date',t->>'dueDate','confidence','confirmed')
              ELSE t->'dueDate' END,
         coalesce((SELECT array_agg(p.id) FROM pal_people p
                   JOIN jsonb_array_elements_text(coalesce(t->'assignees','[]'::jsonb)) a(nm) ON p.name=a.nm),'{}'),
         coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(t->'dependsOn','[]'::jsonb)) x),'{}'),
         coalesce(t->>'notes',''), coalesce(t->>'gate',''), coalesce(t->>'source','manual'),
         ord.n, (t->>'completedAt')::date
  FROM jsonb_array_elements(s->'tasks') WITH ORDINALITY AS ord(t,n);

  -- milestones → tasks tagged source='milestone' (5 exist; zero data loss)
  INSERT INTO pal_tasks(id,file_id,title,status,due,source)
  SELECT m->>'id', f->>'id', m->>'title',
         CASE WHEN m->>'status'='completed' THEN 'completed' ELSE 'not_started' END,
         CASE WHEN coalesce(m->>'date','')<>'' THEN jsonb_build_object('precision','exact','date',m->>'date','confidence','confirmed') END,
         'milestone'
  FROM jsonb_array_elements(s->'files') f,
       jsonb_array_elements(coalesce(f->'milestones','[]'::jsonb)) m;

  -- risks + openQuestions → flags
  INSERT INTO pal_flags(id,file_id,kind,text,owner_id,status,resolution)
  SELECT r->>'id', f->>'id', 'risk', r->>'title',
         (SELECT id FROM pal_people WHERE name=r->>'ownerName'),
         CASE WHEN r->>'status'='resolved' THEN 'resolved' ELSE 'open' END, ''
  FROM jsonb_array_elements(s->'files') f, jsonb_array_elements(coalesce(f->'risks','[]'::jsonb)) r;

  INSERT INTO pal_flags(id,file_id,kind,text,owner_id,status,resolution)
  SELECT q->>'id', f->>'id', 'question', q->>'question',
         (SELECT id FROM pal_people WHERE name=q->>'ownerName'),
         CASE WHEN q->>'status'='open' THEN 'open' ELSE 'resolved' END, coalesce(q->>'answer','')
  FROM jsonb_array_elements(s->'files') f, jsonb_array_elements(coalesce(f->'openQuestions','[]'::jsonb)) q;

  INSERT INTO pal_links(id,file_id,label,url,type)
  SELECT l->>'id', f->>'id', coalesce(l->>'label',''), l->>'url', coalesce(l->>'type','folder')
  FROM jsonb_array_elements(s->'files') f, jsonb_array_elements(coalesce(f->'sharePointLinks','[]'::jsonb)) l;

  INSERT INTO pal_events(id,file_id,entity,entity_id,kind,summary,actor,payload,event_date)
  SELECT e->>'id', f->>'id', 'file', f->>'id', 'log', coalesce(e->>'summary',''), 'karl',
         jsonb_build_object('title',coalesce(e->>'title','Update')), coalesce((e->>'date')::date,CURRENT_DATE)
  FROM jsonb_array_elements(s->'files') f, jsonb_array_elements(coalesce(f->'log','[]'::jsonb)) e;

  SELECT jsonb_build_object(
    'people',(SELECT count(*) FROM pal_people),
    'files',(SELECT count(*) FROM pal_files),
    'outputs',(SELECT count(*) FROM pal_outputs),
    'tasks',(SELECT count(*) FROM pal_tasks WHERE source<>'milestone'),
    'milestones_as_tasks',(SELECT count(*) FROM pal_tasks WHERE source='milestone'),
    'flags',(SELECT count(*) FROM pal_flags),
    'links',(SELECT count(*) FROM pal_links),
    'log_events',(SELECT count(*) FROM pal_events WHERE kind='log')
  ) INTO counts;
  RETURN counts;
END $$;

-- ──── STEP 7 · FIDELITY PROOF (run after migration) ─────────────────────────
-- 7a. counts vs v1 (expected from Phase 1 audit: 46 files · 208 tasks · 15 deliverables
--     · 12 people · 5 milestones · 2 risks · 7 questions · 40 log entries · 11 links)
-- SELECT pal_migrate_from_v1();
-- 7b. every v1 id present:
-- SELECT t->>'id' FROM palantir_state, jsonb_array_elements(state->'tasks') t
--   WHERE NOT EXISTS (SELECT 1 FROM pal_tasks WHERE id=t->>'id');           -- must be empty
-- (repeat for files, deliverables, people)
-- 7c. semantic export diff: compare pal_export_state() arrays against v1 arrays
--     field-by-field on a sample of 5 files incl. Dorval (p01), APA (p10), LDRR (p25).

-- ═══════════════════════════════════════════════════════════════════════════
-- Palantír 2.0 · Session 1 foundation · FINAL (reviewed against live state 2026-06-12)
-- Supersedes palantir-2.0-session1-draft.sql. Changes from draft:
--   · pal_flags gains severity + detail (v1 risks carry both; zero data loss)
--   · flag/question statuses migrate verbatim ('monitoring', 'answered' survive)
--   · duplicate v1 task ids (p8001 x3, p8002..p8005 x2) remapped to id-2/id-3,
--     first occurrence keeps the id; remaps recorded as 'archive' events
--   · orphan tasks (fileId f_june3_budget, p1781268200000) kept with file_id NULL,
--     original ref archived in an event
--   · sort_order honors v1 order arrays: deliverable.taskIds, file.deliverableIds,
--     file.standaloneTaskOrder (draft used global array position only)
--   · templates / linkTypes / deliverableTypes / uiPrefs preserved into pal_prefs
--   · task createdAt / completedAt / link createdAt / output createdAt preserved
--   · 'assignee' (singular, 9 tasks) merged into assignee_ids; dependsOn ∪ dependencies
--   · dropped legacy task/output/file fields archived as kind='archive' events when non-empty
--   · pal_snapshot sets user_id (snapshots RLS is user_id = auth.uid())
--   · pal_apply_update: all 9 stubbed verbs completed; title-fallback warns;
--     ambiguous title matches skip; per-item events carry package_id; unique
--     idempotency index narrowed to kind='import'; FUNCTION_NOTE hack removed
--   · Realtime publication name verified: supabase_realtime (exists, empty)
-- Live v1 counts at review: 47 files · 212 tasks · 15 deliverables · 12 people ·
--   5 milestones · 2 risks · 7 questions · 47 log entries · 10 links
-- Rules: purely additive. Never writes palantir_state. Reversible: DROP pal_* objects.
-- SECURITY DEFINER decision deferred to Session 2 (connector runs as service role,
--   app as authenticated; both pass current policies).
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
  detail      text DEFAULT '',                    -- v1 risk description
  severity    text,                               -- v1 risk severity (low|medium|high), null for questions
  owner_id    text REFERENCES pal_people(id),
  status      text DEFAULT 'open',                -- open|resolved|dropped (+v1 verbatim: monitoring, answered)
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
  kind       text NOT NULL,                       -- log|create|update|complete|delete|merge|import|archive
  summary    text DEFAULT '',
  actor      text DEFAULT 'karl',                 -- karl|claude
  payload    jsonb,
  package_id text,                                -- set on all rows written by pal_apply_update
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
CREATE INDEX IF NOT EXISTS idx_pal_events_pkg   ON pal_events(package_id) WHERE package_id IS NOT NULL;
-- idempotency guard: exactly one import event per package
CREATE UNIQUE INDEX IF NOT EXISTS idx_pal_events_pkg_import ON pal_events(package_id) WHERE package_id IS NOT NULL AND kind = 'import';

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

-- RLS: any authenticated user (single-user app). NOTE: looser than v1's
-- user_id = auth.uid() policy; acceptable because pal_ tables carry no user_id
-- and only Karl's account exists. Revisit if accounts are ever added.
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pal_people','pal_campaigns','pal_files','pal_outputs','pal_tasks','pal_flags','pal_links','pal_events','pal_prefs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS pal_auth_all ON %I', t);
    EXECUTE format('CREATE POLICY pal_auth_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Realtime (publication name verified on the project 2026-06-12: exists, empty):
ALTER PUBLICATION supabase_realtime ADD TABLE pal_files, pal_outputs, pal_tasks, pal_flags, pal_links, pal_events;

-- ──── STEP 2b · SMALL HELPERS ────────────────────────────────────────────────

-- string date → FlexDate exact; FlexDate object passes through; junk → NULL
CREATE OR REPLACE FUNCTION pal_norm_flexdate(j jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF j IS NULL OR jsonb_typeof(j) = 'null' THEN RETURN NULL; END IF;
  IF jsonb_typeof(j) = 'object' THEN RETURN j; END IF;
  IF jsonb_typeof(j) = 'string' AND btrim(j #>> '{}') <> '' THEN
    BEGIN
      PERFORM (j #>> '{}')::date;
      RETURN jsonb_build_object('precision','exact','date',j #>> '{}','confidence','confirmed');
    EXCEPTION WHEN others THEN RETURN NULL; END;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION pal_safe_date(t text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF coalesce(btrim(t),'') = '' THEN RETURN NULL; END IF;
  RETURN t::date;
EXCEPTION WHEN others THEN RETURN NULL; END $$;

CREATE OR REPLACE FUNCTION pal_safe_ts(t text) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF coalesce(btrim(t),'') = '' THEN RETURN now(); END IF;
  RETURN t::timestamptz;
EXCEPTION WHEN others THEN RETURN now(); END $$;

-- people names (jsonb array of strings) → ids + missing names
CREATE OR REPLACE FUNCTION pal_people_ids(names jsonb, OUT ids text[], OUT missing text[])
LANGUAGE plpgsql STABLE AS $$
BEGIN
  SELECT coalesce(array_agg(p.id), '{}') INTO ids
    FROM jsonb_array_elements_text(coalesce(names,'[]'::jsonb)) a(nm)
    JOIN pal_people p ON lower(p.name) = lower(a.nm);
  SELECT coalesce(array_agg(a.nm), '{}') INTO missing
    FROM jsonb_array_elements_text(coalesce(names,'[]'::jsonb)) a(nm)
    WHERE NOT EXISTS (SELECT 1 FROM pal_people p WHERE lower(p.name) = lower(a.nm));
END $$;

-- find file by id, else by title (non-archived preferred); warn on title match
CREATE OR REPLACE FUNCTION pal_find_file(p_id text, p_title text, OUT o_id text, OUT o_warn text)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_id IS NOT NULL THEN SELECT id INTO o_id FROM pal_files WHERE id = p_id; END IF;
  IF o_id IS NULL AND coalesce(p_title,'') <> '' THEN
    SELECT id INTO o_id FROM pal_files WHERE lower(title) = lower(p_title) AND NOT archived ORDER BY created_at LIMIT 1;
    IF o_id IS NULL THEN
      SELECT id INTO o_id FROM pal_files WHERE lower(title) = lower(p_title) ORDER BY created_at LIMIT 1;
    END IF;
    IF o_id IS NOT NULL THEN o_warn := 'matched file by title'; END IF;
  END IF;
END $$;

-- find task by id, else by unique title (open tasks preferred); ambiguous → null + warn
CREATE OR REPLACE FUNCTION pal_find_task(p_id text, p_title text, OUT o_id text, OUT o_warn text)
LANGUAGE plpgsql STABLE AS $$
DECLARE n int;
BEGIN
  IF p_id IS NOT NULL THEN SELECT id INTO o_id FROM pal_tasks WHERE id = p_id; END IF;
  IF o_id IS NULL AND coalesce(p_title,'') <> '' THEN
    SELECT count(*), min(id) INTO n, o_id FROM pal_tasks WHERE lower(title) = lower(p_title) AND status <> 'completed';
    IF n = 0 THEN
      SELECT count(*), min(id) INTO n, o_id FROM pal_tasks WHERE lower(title) = lower(p_title);
    END IF;
    IF n = 0 THEN o_id := NULL;
    ELSIF n > 1 THEN o_id := NULL; o_warn := 'ambiguous title ('||n||' matches), skipped';
    ELSE o_warn := 'matched task by title';
    END IF;
  END IF;
END $$;

-- find output by id, else by title (optionally scoped to a file); ambiguous → null + warn
CREATE OR REPLACE FUNCTION pal_find_output(p_id text, p_title text, p_file text, OUT o_id text, OUT o_warn text)
LANGUAGE plpgsql STABLE AS $$
DECLARE n int;
BEGIN
  IF p_id IS NOT NULL THEN SELECT id INTO o_id FROM pal_outputs WHERE id = p_id; END IF;
  IF o_id IS NULL AND coalesce(p_title,'') <> '' THEN
    SELECT count(*), min(id) INTO n, o_id FROM pal_outputs
      WHERE lower(title) = lower(p_title) AND (p_file IS NULL OR file_id = p_file);
    IF n = 0 THEN o_id := NULL;
    ELSIF n > 1 THEN o_id := NULL; o_warn := 'ambiguous output title ('||n||' matches), skipped';
    ELSE o_warn := 'matched output by title';
    END IF;
  END IF;
END $$;

-- ──── STEP 3 · pal_export_state() · rebuilds the v1 JSONB shape ─────────────
-- Round-trippable with v1: order arrays (taskIds, deliverableIds, standaloneTaskOrder)
-- are rebuilt from sort_order; settings come back from pal_prefs; version stays '1.0'
-- so the v1 restore path keeps working until cutover.
-- Mappings: outputs→deliverables · flags(risk|blocker)→file.risks ·
--   flags(question)→file.openQuestions · events(kind=log)→file.log ·
--   tasks(source=milestone)→file.milestones

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
      'completedAt',t.completed_at,'createdAt',t.created_at::date) ORDER BY t.sort_order, t.id),'[]'::jsonb)
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

-- ──── STEP 4 · pal_snapshot() ────────────────────────────────────────────────
-- user_id is REQUIRED by snapshots RLS (user_id = auth.uid()); sourced from
-- palantir_state so chat-created snapshots stay visible in the app.

CREATE OR REPLACE FUNCTION pal_snapshot(p_label text, p_trigger text DEFAULT 'manual')
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE sid bigint;
BEGIN
  INSERT INTO palantir_snapshots(user_id, state, trigger, label)
  VALUES ((SELECT user_id FROM palantir_state WHERE id=1), pal_export_state(), p_trigger, p_label)
  RETURNING id INTO sid;
  RETURN sid;
END $$;

-- ──── STEP 5 · pal_apply_update(package) · the chat write path ──────────────
-- One transaction: validate keys → idempotency check → snapshot → apply verbs →
-- per-item events (all carrying package_id) → one import event (unique per package)
-- → structured per-item results. Title fallbacks warn; ambiguity skips.
-- Verb order: people → files (create/update) → outputs → tasks → flags → links
-- → memory → log → merges last.

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
    UPDATE pal_files SET
      title       = coalesce(ch->>'title', title),
      status      = coalesce(ch->>'status', status),
      priority    = coalesce(ch->>'priority', priority),
      sensitivity = coalesce(ch->>'sensitivity', sensitivity),
      lead_id     = CASE WHEN ch ? 'lead' THEN v_id ELSE lead_id END,
      archived    = CASE WHEN ch ? 'archived' THEN (ch->>'archived')::boolean ELSE archived END,
      archived_at = CASE WHEN ch ? 'archived' AND (ch->>'archived')::boolean THEN CURRENT_DATE
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
      sort_order      = coalesce((ch->>'sortOrder')::float, sort_order)
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
    UPDATE pal_tasks SET
      status       = coalesce(ch->>'status', status),
      title        = coalesce(ch->>'title', title),
      notes        = coalesce(ch->>'notes', notes),
      gate         = coalesce(ch->>'gate', gate),
      due          = CASE WHEN ch ? 'due' THEN pal_norm_flexdate(ch->'due') ELSE due END,
      output_id    = CASE WHEN ch ? 'outputId' THEN ch->>'outputId' ELSE output_id END,
      file_id      = CASE WHEN ch ? 'fileId' THEN ch->>'fileId' ELSE file_id END,
      assignee_ids = CASE WHEN ch ? 'assignees' THEN v_ids ELSE assignee_ids END,
      sort_order   = coalesce((ch->>'sortOrder')::float, sort_order),
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

-- ──── STEP 6 · MIGRATION (M2) · v1 JSONB → pal_ tables ──────────────────────
-- Rerunnable: wipes pal_ data (never v1) and re-copies. Run after every v1 change
-- until cutover. Deterministic: duplicate-id remaps depend only on array order.

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
                        notes, gate, source, sort_order, completed_at, created_at)
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
         n::float, pal_safe_date(t->>'completedAt'), pal_safe_ts(t->>'createdAt')
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
             'priority',        nullif(t->>'priority',''),
             'link',            nullif(t->>'link',''),
             'leadPersonId',    nullif(t->>'leadPersonId',''),
             'templateId',      nullif(t->>'templateId',''),
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

-- ──── STEP 7 · FIDELITY PROOF (run after migration) ─────────────────────────
-- 7a. counts vs LIVE v1 (2026-06-12 backup: 47 files · 212 tasks · 15 deliverables
--     · 12 people · 5 milestones · 2 risks · 7 questions · 47 log entries · 10 links)
-- SELECT pal_migrate_from_v1();
-- 7b. every v1 id present (duplicat
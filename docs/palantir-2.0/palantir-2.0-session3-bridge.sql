-- ============================================================================
-- Palantir 2.0 - Session 3 bridge: pal_apply_to_v1
-- Lets the chat update loop go live BEFORE the UI is rebuilt, by keeping
-- palantir_state (what the app reads) as the source of truth while using the
-- hardened pal_apply_update engine to apply the change.
--
-- Per call, in ONE transaction:
--   1. bridge-level idempotency check (pal_bridge_log)
--   2. optimistic concurrency guard on palantir_state.updated_at
--   3. snapshot live palantir_state (trigger=pre_bridge)
--   4. rebuild pal_ from current palantir_state (captures the app's latest edits)
--   5. apply the package via pal_apply_update (idempotency/dedupe/safe-casts/results)
--   6. write pal_export_state() back into palantir_state, guarded
--   7. record the packageId in pal_bridge_log
-- Retires when the UI cuts over to read pal_ directly.
-- Depends on: session1-final + session2 hardening + session3 priority patch.
-- NOT YET APPLIED to Supabase.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pal_bridge_log (
  package_id text PRIMARY KEY,
  summary    text,
  applied_at timestamptz DEFAULT now()
);
ALTER TABLE pal_bridge_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pal_bridge_log' AND policyname='pal_auth_all') THEN
    CREATE POLICY pal_auth_all ON pal_bridge_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pal_apply_to_v1(pkg jsonb, expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
DECLARE pid text; cur timestamptz; res jsonb; rows int;
BEGIN
  pid := pkg->>'packageId';
  IF pid IS NULL THEN RETURN jsonb_build_object('status','error','error','packageId is required'); END IF;

  SELECT updated_at INTO cur FROM palantir_state WHERE id = 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','error','palantir_state id=1 not found'); END IF;

  -- bridge idempotency: pal_ is rebuilt each call, so apply_update's own guard is moot
  IF EXISTS (SELECT 1 FROM pal_bridge_log WHERE package_id = pid) THEN
    RETURN jsonb_build_object('status','noop','reason','package already applied via bridge','packageId',pid);
  END IF;

  -- optimistic concurrency: caller passes the updated_at it last read from palantir_state
  IF expected_updated_at IS NOT NULL AND cur IS DISTINCT FROM expected_updated_at THEN
    RETURN jsonb_build_object('status','conflict','reason','palantir_state changed since you read it; re-read and retry',
                              'packageId',pid,'current_updated_at',cur,'expected',expected_updated_at);
  END IF;

  -- snapshot the live v1 state for rollback
  INSERT INTO palantir_snapshots(user_id, state, trigger, label)
    SELECT user_id, state, 'pre_bridge', 'Before bridge: '||coalesce(pkg->>'summary','update')
    FROM palantir_state WHERE id = 1;

  -- rebuild pal_ from the current live state, apply the package, export back
  PERFORM pal_migrate_from_v1();
  res := pal_apply_update(pkg);
  IF res->>'status' = 'error' THEN
    RETURN jsonb_build_object('status','error','error',res->>'error','packageId',pid);
  END IF;

  UPDATE palantir_state SET state = pal_export_state(), updated_at = now()
    WHERE id = 1 AND (expected_updated_at IS NULL OR updated_at = expected_updated_at);
  GET DIAGNOSTICS rows = ROW_COUNT;
  IF rows = 0 THEN
    RETURN jsonb_build_object('status','conflict','reason','palantir_state changed during apply; nothing written','packageId',pid);
  END IF;

  INSERT INTO pal_bridge_log(package_id, summary) VALUES (pid, pkg->>'summary');

  RETURN jsonb_build_object('status','applied','packageId',pid,
                            'results',res->'results','warnings',res->'warnings','syncedToV1',true);
END $$;

REVOKE EXECUTE ON FUNCTION public.pal_apply_to_v1(jsonb, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pal_apply_to_v1(jsonb, timestamptz) TO authenticated, service_role;

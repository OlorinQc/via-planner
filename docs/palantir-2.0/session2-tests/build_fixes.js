const fs = require('fs');
const BASE = "/sessions/gracious-elegant-cray/mnt/02.Claude Apps/Karl's Apps/kh-tools/docs/palantir-2.0";
const SQL_PATH = BASE + "/palantir-2.0-session1-final.sql";
const FIXES_OUT = BASE + "/palantir-2.0-session2-fixes.sql";
const FIXES_COPY = "/sessions/gracious-elegant-cray/mnt/outputs/pgtest/fixes.sql";

let s = fs.readFileSync(SQL_PATH, 'utf8');
function repl(from, to) {
  if (s.indexOf(from) === -1) throw new Error('ANCHOR NOT FOUND:\n' + from);
  s = s.replace(from, to);
}
// A: outputs sortOrder guarded
repl("      sort_order      = coalesce((ch->>'sortOrder')::float, sort_order)",
     "      sort_order      = coalesce(pal_safe_float(ch->>'sortOrder'), sort_order)");
// B: tasks sortOrder guarded
repl("      sort_order   = coalesce((ch->>'sortOrder')::float, sort_order),",
     "      sort_order   = coalesce(pal_safe_float(ch->>'sortOrder'), sort_order),");
// C: files archived guarded (two lines)
repl("      archived    = CASE WHEN ch ? 'archived' THEN (ch->>'archived')::boolean ELSE archived END,",
     "      archived    = CASE WHEN ch ? 'archived' THEN pal_safe_bool(ch->>'archived') ELSE archived END,");
repl("      archived_at = CASE WHEN ch ? 'archived' AND (ch->>'archived')::boolean THEN CURRENT_DATE",
     "      archived_at = CASE WHEN ch ? 'archived' AND pal_safe_bool(ch->>'archived') THEN CURRENT_DATE");
// D files: strip invalid archived before UPDATE (must strip; CASE keys on presence)
repl("    UPDATE pal_files SET\n      title       = coalesce(ch->>'title', title),",
     "    IF ch ? 'archived' AND pal_safe_bool(ch->>'archived') IS NULL AND btrim(coalesce(ch->>'archived','')) <> '' THEN\n" +
     "      v_warn := concat_ws('; ', v_warn, 'invalid archived value ignored: '||(ch->>'archived')); ch := ch - 'archived';\n" +
     "    END IF;\n" +
     "    UPDATE pal_files SET\n      title       = coalesce(ch->>'title', title),");
// D outputs: warn on invalid sortOrder (coalesce already protects the value)
repl("    UPDATE pal_outputs SET\n      title           = coalesce(ch->>'title', title),",
     "    IF ch ? 'sortOrder' AND pal_safe_float(ch->>'sortOrder') IS NULL AND btrim(coalesce(ch->>'sortOrder','')) <> '' THEN\n" +
     "      v_warn := concat_ws('; ', v_warn, 'invalid sortOrder ignored: '||(ch->>'sortOrder'));\n" +
     "    END IF;\n" +
     "    UPDATE pal_outputs SET\n      title           = coalesce(ch->>'title', title),");
// D tasks: warn on invalid sortOrder
repl("    UPDATE pal_tasks SET\n      status       = coalesce(ch->>'status', status),",
     "    IF ch ? 'sortOrder' AND pal_safe_float(ch->>'sortOrder') IS NULL AND btrim(coalesce(ch->>'sortOrder','')) <> '' THEN\n" +
     "      v_warn := concat_ws('; ', v_warn, 'invalid sortOrder ignored: '||(ch->>'sortOrder'));\n" +
     "    END IF;\n" +
     "    UPDATE pal_tasks SET\n      status       = coalesce(ch->>'status', status),");

// extract the patched function block
const startMarker = "CREATE OR REPLACE FUNCTION pal_apply_update(pkg jsonb)";
const startIdx = s.indexOf(startMarker);
const endIdx = s.indexOf("END $$;", startIdx) + "END $$;".length;
const patchedFn = s.substring(startIdx, endIdx);

const helpers =
`CREATE OR REPLACE FUNCTION pal_safe_bool(t text) RETURNS boolean
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
EXCEPTION WHEN others THEN RETURN NULL; END $$;`;

const hardening =
`-- ── search_path pinning (clears advisor 0011 on all functions) ──
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
GRANT  EXECUTE ON FUNCTION public.pal_migrate_from_v1()    TO service_role;`;

const header =
`-- ============================================================================
-- Palantir 2.0 - Session 2 fixes (write-path hardening)
-- Generated from palantir-2.0-session1-final.sql. NOT YET APPLIED to Supabase.
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

`;

const fixes = header + helpers + "\n\n" + patchedFn + "\n\n" + hardening + "\n";
fs.writeFileSync(FIXES_OUT, fixes);
fs.writeFileSync(FIXES_COPY, fixes);
console.log('WROTE fixes -> ' + FIXES_OUT);
console.log('bytes: ' + fixes.length + '  patchedFn bytes: ' + patchedFn.length);
console.log('sanity: helpers present=' + /pal_safe_bool/.test(fixes) + ' guarded_bool=' + /pal_safe_bool\(ch->>'archived'\)/.test(fixes) + ' guarded_float=' + (fixes.match(/pal_safe_float\(ch->>'sortOrder'\)/g)||[]).length + ' strip_archived=' + /invalid archived value ignored/.test(fixes));

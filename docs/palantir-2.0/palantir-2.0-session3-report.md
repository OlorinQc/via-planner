# Palantír 2.0 — Session 3 Report (priority patch + bridge, applied live)

Date: 2026-06-18 (Opus, Cowork). The Session 3 SQL was previously validated in PGlite (17/17).
This session applied it to production `ngdbtgsbtyfghdyqbazj`, verified it against the real live
state, and reverted the throwaway test so the app's data is byte-identical to before.

## 1. What was applied

Two additive migrations, in order:

1. `pal_2_0_session3_priority` (from `palantir-2.0-session3-priority-patch.sql`)
   `ALTER TABLE pal_tasks ADD COLUMN IF NOT EXISTS priority text, template_id text`; `CREATE OR
   REPLACE` of `pal_export_state` + `pal_migrate_from_v1` to carry priority/templateId through the
   round-trip; `search_path` re-pinned on both functions.
2. `pal_2_0_session3_bridge` (from `palantir-2.0-session3-bridge.sql`)
   `pal_bridge_log` table (RLS + `pal_auth_all` policy) and
   `pal_apply_to_v1(pkg jsonb, expected_updated_at timestamptz)` — SECURITY INVOKER, `search_path`
   pinned, EXECUTE granted to `authenticated`/`service_role`, revoked from `anon`/`PUBLIC`.

Neither migration touches `palantir_state` data; both are additive DDL.

## 2. Preconditions verified (before applying)

- Migrations present: Session 1 (`pal_2_0_step1..step4`) + `pal_2_0_session2_hardening`; no Session 3.
- 14 `pal_` functions live, all SECURITY INVOKER with `search_path` pinned (Session 2 hardening intact).
- `pal_tasks` had no priority/template_id; `pal_bridge_log` absent; `pal_campaigns` present.
- `palantir_state` has `user_id` + `updated_at`; `palantir_snapshots` shape supports the bridge insert.
- Live drift confirmed and expected: `palantir_state` = 215 tasks vs `pal_` = 212 (from the
  2026-06-13 migrate). The bridge rebuilds `pal_` from `palantir_state` each call, so drift is moot.

## 3. Master snapshot

`palantir_snapshots` #19, label "pre-session3-rollout 2026-06-18". Baseline: state md5
`017502db40e5b42ce826bf9658640753`, `updated_at` 2026-06-18T01:53:20.468Z, 215 tasks / 47 files.
Off-database backup also on disk: `backups/palantir-v1-2026-06-17.json`.

## 4. Throwaway live test (via `pal_apply_to_v1`, fully reverted)

All against the real current state, then restored to snapshot #19.

- **a. Empty-package round-trip** — `applied`, `syncedToV1: true`. Fidelity vs #19:
  counts preserved (files 47/47, tasks 215/215, deliverables 15/15, people 12/12); priorities
  identical (medium 50, urgent 10); templateId 4/4; zero entity ids missing. Only the intended
  normalizations: task fields dropped = `approvalChain, assignee, blocker, dependencies,
  leadPersonId, link, supportPersonIds`; file fields dropped = `health, latestUpdate, leadPersonId,
  supportPersonIds` (all archived into `pal_events`); nothing unexpectedly added. 6 duplicate v1
  task ids resolved to unique ids (`p8001-2/-3`, `p8002-2`..`p8005-2`) — latent-bug fix, no task lost.
- **b. Real create** — one `tasksToCreate`; returned `applied` (`op: task.create, ok`),
  `syncedToV1: true`; the task appeared in `palantir_state` (215 → 216) and was logged in `pal_bridge_log`.
- **c. Idempotency** — re-sending the same `packageId` returned `noop` ("package already applied
  via bridge"); no duplicate.
- **d. Concurrency** — a call with a stale `expected_updated_at` returned `conflict` and wrote nothing.
- **e. Restore** — `palantir_state` reset to #19: md5 back to `017502db…`, `updated_at` back to
  01:53:20.468Z, 215 tasks, canary gone, `pal_bridge_log` emptied, test `pre_bridge` snapshots
  removed. Verified byte-identical.

## 5. Advisors (security, post-DDL)

Only new item: `rls_policy_always_true` WARN on `pal_bridge_log` — the same `authenticated/true`
single-user pattern accepted by design on every `pal_` table. No new `function_search_path_mutable`
warnings (the bridge's pinned `search_path` held); `pal_apply_to_v1` adds no SECURITY DEFINER
surface. Pre-existing/out-of-scope items unchanged (`rls_auto_enable`, `planner_state` RLS,
leaked-password protection).

## 6. Known cutover behavior (by design)

The bridge keeps `palantir_state` canonical. The **first real bridge call permanently normalizes**
`palantir_state`: it drops the deprecated fields in 4a (archived to `pal_events`) and resolves the
6 duplicate task ids. The app stays compatible because `pal_export_state` emits the app's v1 field
names (`dueDate`, `deliverableId`, `assignees`, `dependsOn`, `sharePointLinks`, `openQuestions`, …);
the dropped fields are derived (`health`) or deprecated (`latestUpdate`, `blocker`, `leadPersonId`,
`supportPersonIds`, `approvalChain`) and recoverable from the archive events if ever needed.

## 7. Bridge ACL nuance (for any future app-direct cutover)

`pal_apply_to_v1` is SECURITY INVOKER and internally calls `pal_migrate_from_v1`, which Session 2
locked to `service_role` only. The daily loop calls the bridge through the work-chat Supabase
connector (executes as `postgres`, bypasses the ACL), so it works. If the app (`authenticated`) is
ever wired to call the bridge directly, either grant `pal_migrate_from_v1` to `authenticated` or
make the bridge SECURITY DEFINER with care.

## 8. Remaining to take the daily loop live

1. **Wire skill v2** (`docs/palantir-2.0/skill-v2/`) to call `pal_apply_to_v1(pkg,
   expected_updated_at)` instead of `pal_apply_update` directly: read state + `updated_at` from
   `palantir_state`, pass `updated_at` as the concurrency token, handle `applied`/`noop`/`conflict`/
   `error`, read back `palantir_state` to verify, run daily updates with the app closed, and flip
   the "NOT LIVE / DO NOT INSTALL" gate. (Best done on Sonnet — doc editing, not high-stakes.)
2. **Install skill v2** to replace the v1 `palantir` skill (Karl, via Settings > Capabilities;
   daily-update environment is the work laptop).
3. Optional: supply the verbatim "May 21 date-discipline rules" if a canonical version exists.

## 9. Git (Karl runs, from the kh-tools repo root)

```bash
cd "/c/Users/KarlH/Documents/02.Claude Apps/Karl's Apps/kh-tools" && git add docs/palantir-2.0/palantir-2.0-session3-report.md docs/palantir-2.0/palantir-2.0-session3-priority-patch.sql docs/palantir-2.0/palantir-2.0-session3-bridge.sql docs/palantir-2.0/session3-tests/ && git commit -m "Palantir 2.0 Session 3: applied priority patch + bridge live, verified, throwaway test reverted"
```

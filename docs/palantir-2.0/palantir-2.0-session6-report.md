# Palantír 2.0 — Session 6 Report (Today + Activity; cutover M4 held)

Date: 2026-06-19 (Opus, Cowork). Project `ngdbtgsbtyfghdyqbazj`. Two new surfaces on the v2 app
at `/palantir2`. v1 at `/palantir` untouched throughout (`App.jsx` byte-identical, 252,942 bytes,
md5 `c68a3fccc68602bb0d50e6d35cb509d1`). Per the approved plan, M4 (the cutover) is split off as
its own gated step; this session is the additive, reversible UI slice.

## 1. Scope delivered

- **Today surface** (default). Two-week drag strip (this week + next week); drag a task onto a
  day to set its date, day to day across both weeks. The cockpit: Overdue / Today / Next 3 days /
  No date, each grouped by file and ordered by file priority. Ghost capture reusing the chip
  composer, extended with a file-picker chip + a `Name:` grammar route since Today has no single
  file in context. Right rail: urgent files, open blocker flags, stale-file attention, recent
  activity. Selection + batch bar are global (already shipped). Visual rules held: status = dot,
  priority = bar, date = chip. A My-tasks / All-tasks toggle scopes the cockpit and strip.
- **Activity surface.** One event stream over `pal_events` (hand log + system events), filters
  All / Claude updates / My edits, applied-package cards (grouped by `package_id`, import event as
  header, expandable contents). Snapshots rail: list + lazy view (counts parsed from the snapshot
  state) and a v1 JSON export (via `pal_export_state`). This surface is **read-only** this session:
  snapshot **restore** and **manual snapshot** are write paths held for the gated phase (see §6).
- **Cutover (M4): not done this session.** Held as a gated, approval-required step. Full plan in §7.

## 2. Architecture / code

New files (sync cleanly): `components/TaskRow.jsx`, `views/Today.jsx`, `views/Activity.jsx`.
Changed (rewritten via bash heredoc per the desync rule): `data/derive.js`, `data/grammar.js`,
`data/client.js`, `data/store.jsx`, `components/HierarchyList.jsx`, `components/Composer.jsx`,
`App.jsx`. `main.jsx` is **unchanged** (the route swap is an M4 step).

- **Single renderer preserved.** `TaskRow` was extracted out of `HierarchyList.jsx` into its own
  module so Today and the dossier render the identical row (status dot, person/date chips, hover
  pill date/assign/relink, click-to-select, draggable task payload). `HierarchyList` now imports it.
  `TaskRow` gained an optional `showOutput` prop (prefixes the linked output title on Today, where
  rows are grouped by file rather than nested under outputs). No row logic was duplicated.
- **All grouping stays in `derive.js`** (blueprint 4.3). Added: `todayBuckets` (overdue/today/soon/
  nodate, each grouped by file, files ordered by priority then title; tasks > 3 days out are not in
  the cockpit by design), `weekStrip` (14 days from this Monday; open tasks whose FlexDate resolves
  to a concrete day land in that day), `todayRail` (urgent files, open blockers, 14d+ stale, recent
  events), `activityStream` + `activityItems` (chronological packages-and-events, newest first).
- **Capture file-routing.** `grammar.js` gained `findFile` + a leading `Name:` file token that only
  fires when `ctx.files` is supplied (Today) and resolves to a known file, so the dossier composers
  are unaffected. `Composer.jsx` gained `pickFile`: a removable file chip, a 📦 file picker popover,
  and outputs that follow the chosen file. A task with no resolved file does not submit.
- **Shell nav.** `App.jsx` switches Today / Files / Activity by internal state (Today default,
  persisted to localStorage), nav tabs clickable, Esc still clears selection. Real URL sub-routes
  remain a Session 8 item.
- **Snapshots read path.** `client.js` gained `fetchSnapshots` (metadata only, no `state` blob) and
  `fetchSnapshot(id)` (lazy, full state for viewing). `store.jsx` loads the snapshot list with the
  model and exposes it.

## 3. Write model (unchanged from 5a/5b)

Today's two new writes reuse the proven store actions: the strip drop calls `setDue` (an
`updateRow` to `pal_tasks.due`), and capture calls `addTask` (an `insertRow`, then append the
returned row, undo deletes by real id). Same transitional path: optimistic `pal_` row write,
debounced `pal_export_state()` → `palantir_state` upsert (updated_at-guarded), `selfWriteUntil`
suppresses the app's own realtime echo, undo over confirm, no `window.confirm`. At cutover the
`palantir_state` sync drops and these writes carry forward unchanged.

## 4. Verification

- **Build:** green `vite build` to a temp outDir, 107 modules (was 104 in 5b; +TaskRow, Today,
  Activity), v1 and v2 both bundled. Only warning is the pre-existing v1 `App.jsx` duplicate
  `position` key (out of scope, flagged since 5a).
- **Grammar:** 7/7 node assertions — `w/o` week-of, `m/o` month-of, `> output:` route, `RISK:` flag
  kind, non-month guard ("Plan 3" not a date), the new `Dorval:` file route with accented `@me` and
  `tbd`, and a plain title left untouched. No regression in existing tokens.
- **Reversible live round-trip** (file `p01`): inserted a throwaway captured task with an exact
  strip-set date (`2026-06-25`); `pal_export_state` serialized both the title and the date into the
  v1 blob (proving a Today capture survives a daily chat-bridge resync), then deleted it. `pal_`
  back to baseline 220 tasks / 15 outputs / 9 flags / 10 links / 51 events, zero residue;
  `palantir_state` byte-identical (md5 `8c0fe1e76c8feab7b874631c6044c404`, `updated_at`
  `2026-06-19 03:47:27.897+00`, never mutated).
- **v1 untouched:** `App.jsx` md5 `c68a3fccc68602bb0d50e6d35cb509d1`.
- In-browser behavior (strip DnD delivery, capture focus, popovers, realtime echo) is Karl's to
  exercise at `/palantir2`, as with 5a/5b.

## 5. Sandbox desync

All overwrites/edits to existing files were written via bash heredoc and confirmed with `wc -l` +
the build; new files synced normally. No truncation reached the build this time.

## 6. Deferred / caveats

- **Snapshot restore** and **manual snapshot** (the Activity write paths): held for the gated phase.
  Restore needs a new authenticated `pal_restore_snapshot(id)` RPC because rebuilding `pal_` from a
  snapshot's v1 blob is the `pal_migrate_from_v1` path (service_role only, not app-callable). Manual
  snapshot needs the verified `pal_snapshot` signature. Both are write paths best done with the live
  test, alongside M4.
- **Activity package cards** are coded but mostly empty today: live `pal_events` are 51 `log`/`karl`
  entries; the richer import/change events are transient pre-cutover (the bridge rebuilds `pal_`
  from `palantir_state` each update). They populate once `pal_apply_update` writes directly post-cutover.
- **Within-day strip reorder** and **Today group reorder**: not implemented. `sort_order` is per
  sibling group, not per day/bucket, so day-scoped ordering needs its own model; the high-value
  strip drags (task → day, day → day, all date-setting) are in. Flagged for a later pass.
- **Activity "by file" filter** and **real URL sub-routes**: deferred (Session 8 sweep).

## 7. M4 cutover plan (ready for the gated session, Opus, app closed)

1. **Snapshot** + final M2 resync: `SELECT pal_snapshot('pre-cutover', 'manual'); SELECT pal_migrate_from_v1();`
2. **Route swap** in `src/main.jsx`: `/palantir` → v2 `App`, `/palantir/legacy` → v1 (reads the now-
   frozen `palantir_state`). Keep `/palantir2` as an alias or drop it.
3. **Drop the `palantir_state` sync**: remove the `scheduleSync` calls (or short-circuit `doSync`) so
   `pal_` is sole canonical. Row writes stay. Reversible: re-enable the sync.
4. **New restore RPC**: add authenticated `pal_restore_snapshot(id)` (safety snapshot → rebuild `pal_`
   → in one txn), then wire the Activity restore + manual-snapshot buttons with undo over confirm.
5. **Daily skill switch** (Karl, work laptop): skill v2 stops calling `pal_apply_to_v1` and calls
   `pal_apply_update` directly (snapshot + read-back), `palantir_state` frozen as the archived v1 row.
6. **Verify**: snapshot at cutover, reversible live test, v1 reachable read-only at `/palantir/legacy`.
   Reversal: swap routes back, re-enable export sync, tables stay consistent.

## 8. Git

One chained line (Git Bash):

```
cd "C:/Users/KarlH/Documents/02.Claude Apps/Karl's Apps/kh-tools" && git add src/apps/Palantir/v2 docs/palantir-2.0/palantir-2.0-session6-report.md && git commit -m "Palantir v2 Session 6: Today surface (week strip + cockpit + capture) and Activity (stream + snapshots); cutover M4 held" && git push
```

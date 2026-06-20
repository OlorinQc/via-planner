# Palantír 2.0: Session 6b kickoff prompt (the M4 cutover)

Paste the block below into a NEW Cowork chat to start the cutover. Run it as its own session,
with a comfortable usage budget and the Palantír tab CLOSED, since it touches the live canonical
write path. This is the M4 step that was split off from Session 6.

---

Start Palantír 2.0 Session 6b: the M4 cutover.

Model: Opus, and stay on it. This is the load-bearing, hard-to-reverse step (live DDL for a restore
RPC, the route swap, dropping the palantir_state sync, and the daily-write-path switch). Do not
downshift mid-session.

Status, do not redo: Sessions 1-6 are complete and live on Supabase ngdbtgsbtyfghdyqbazj. The pal_
schema, hardened pal_apply_update, the pal_apply_to_v1 bridge, and skill v2 are live for daily
updates, with palantir_state still the canonical row. v2 lives at /palantir2 (route in src/main.jsx)
and is fully usable: read scaffold (S4), file-page editing (S5a/5b), and Today + Activity (S6). v1
is untouched at /palantir (App.jsx byte-identical, md5 c68a3fccc68602bb0d50e6d35cb509d1). A
"Palantír v2" tile points to /palantir2 in src/Hub.jsx. The v2 write path is the transitional
model: optimistic pal_ row writes plus a debounced pal_export_state() -> palantir_state upsert
(updated_at-guarded), reversible; this session retires that sync so pal_ becomes sole canonical.

For this session: load my project memory and the docs in kh-tools/docs/palantir-2.0/, above all
palantir-2.0-session6-report.md section 7 (the M4 plan), plus palantir-2.0-session3-bridge.sql and
palantir-2.0-session1-final.sql for the pal_migrate_from_v1 / pal_export_state / function + ACL
patterns the restore RPC must mirror. Approve the kh-tools folder (it is under "Karl's Apps"). Then
read the relevant source: src/main.jsx (routes), src/Hub.jsx (tiles), v2 data/store.jsx +
data/mutations.js (the sync to drop), and v2 views/Activity.jsx (the restore + manual-snapshot
buttons to wire). Before any code or any live step, propose the cutover plan, the
pal_restore_snapshot SQL, and the exact step order for my approval. Every live step is gated and
runs with the app closed.

Session 6b scope (M4), in order, each live step behind my approval:
1. Snapshot + final resync: pal_snapshot('pre-cutover','manual'), then pal_migrate_from_v1() so pal_
   matches canonical one last time. Record baseline counts + palantir_state md5 and updated_at.
2. New authenticated pal_restore_snapshot(snapshot_id) RPC: in one transaction, take a safety
   snapshot, then rebuild pal_ from the chosen snapshot's v1-shape state (the pal_migrate logic run
   against the snapshot blob, not the live row). INVOKER, anon revoked, authenticated + service_role
   granted, search_path pinned, per the session1/2 pattern. Rehearse in PGlite against the latest
   backup FIRST (the established cheap-test path), then apply live (additive DDL, snapshot first) and
   prove a reversible restore round-trip.
3. Wire Activity: enable the restore button (undo over confirm, calls the RPC, safety snapshot noted)
   and the manual "Save snapshot" button (pal_snapshot, verify the signature first). No window.confirm.
4. Route swap in src/main.jsx: /palantir -> v2 App, /palantir/legacy -> v1 (reads the now-frozen
   palantir_state). Keep /palantir2 as an alias or drop it. Update src/Hub.jsx: point the "Palantír"
   tile at v2, add a small "Palantír (legacy)" tile -> /palantir/legacy, and retire the interim
   "Palantír v2" tile.
5. Drop the palantir_state sync in v2 store.jsx (remove or short-circuit scheduleSync/doSync) so pal_
   is sole canonical. The row writes stay. Reversible: re-enable the sync.
6. Daily-write-path switch (my action, work laptop): update skill v2 so it stops calling
   pal_apply_to_v1 (which rebuilds pal_ from palantir_state and goes stale once pal_ is canonical)
   and applies directly via pal_apply_update with snapshot + read-back; palantir_state frozen as the
   archived v1 row. Prepare the exact skill edit and a one-line install note for me.
7. Snapshot at cutover.

Reversal (document it): swap the routes back in main.jsx, re-enable the export sync, restore the Hub
tiles; the tables stay consistent via pal_export_state, and palantir_state is never deleted.

Build rules: keep every v2 pattern (row-level writes through the store actions, undo over confirm,
the single HierarchyList renderer, derive.js owns all selectors, inline styles, no window.confirm,
the shared drag context). CRITICAL desync note: this repo desyncs the build sandbox when an existing
file is overwritten or edited (Hub.jsx and main.jsx are repeat offenders, observed again in S6);
after any overwrite or edit verify with wc -l or a build, and prefer a bash heredoc for overwrites.
Daily updates happen on the work laptop only; Cowork is dev-only, so run every live cutover step with
the app closed and behind my approval. Finish with a green vite build (build to a temp outDir to dodge
the dist EPERM), a reversible live round-trip of the restore RPC and of the cutover, confirmation of
what happens to v1 (App.jsx stays byte-identical; only its route and Hub mount change), and one
chained git line for me to run.

One judgment call to put to me at the top: do the full cutover in one session, or split the restore
RPC (steps 1-3: additive, reversible, no change to which store is canonical) from the route + sync +
skill flip (steps 4-6: the actual cutover). If usage is tight, do 1-3 and hold 4-6 for a follow-up.

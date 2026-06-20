# Palantír 2.0 — Session 6 kickoff prompt

Paste the block below into a new Cowork chat to start Session 6.

---

Start Palantír 2.0 Session 6: Today + Activity, then the cutover (M4).

Model: Sonnet is fine for most of Session 6, since Today and Activity mostly reuse the 5a/5b
primitives (mini calendar, hover pill, chip composer, selection + batch bar, the drag engine,
undo toasts). Switch to Opus for the cutover (M4) and any migration or live write step, since that
is the load-bearing, hard-to-reverse part.

Status, do not redo: Sessions 1-3 (pal_ schema, hardened apply engine, pal_apply_to_v1 bridge,
skill v2 installed and live for daily updates) are complete and live on Supabase
ngdbtgsbtyfghdyqbazj, with palantir_state as the canonical row. Session 4 (read-only v2 scaffold),
Session 5a (editing parity, first slice) and Session 5b (capture chip composer + grammar tokens,
drag engine, relink pill, Flags/Links/History editing) are done and committed. v2 lives at
/palantir2 (route in src/main.jsx); v1 is untouched at /palantir (App.jsx byte-identical, md5
c68a3fccc68602bb0d50e6d35cb509d1). The v2 write path is in src/apps/Palantir/v2/data/store.jsx +
mutations.js: optimistic row writes to pal_ tables (update + insert + delete, undo over confirm),
then a debounced pal_export_state() -> palantir_state upsert (updated_at guarded), reversible. The
file page is fully editable; data/derive.js holds all selectors; one HierarchyList renders the
file -> output -> task tree; components/dnd.jsx is the shared drag context.

For this session: load my project memory and the docs in kh-tools/docs/palantir-2.0/
(palantir-2.0-phase2-blueprint.md and its binding section 4.2b interaction standard, plus section
4.1 the four surfaces and the migration plan with step M4, palantir-2.0-mockups.html for the Today
and Activity layouts, palantir-2.0-session4-5a-report.md, and palantir-2.0-session5b-report.md).
Approve the kh-tools folder when prompted (it is under "Karl's Apps"). Then read the relevant v2
source (data/store.jsx, data/derive.js, App.jsx shell, components/MiniCalendar.jsx, Composer.jsx,
dnd.jsx, HoverPill.jsx, BatchBar.jsx, Toasts.jsx, views/Files.jsx) and, before writing any code,
propose the Session 6 scope, sequence, and plan for my approval.

Session 6 scope per the blueprint and 4.2b:
- Today surface: the cockpit (overdue / today / next / no-date buckets, grouped by file), the
  two-week drag strip (drag a task onto a day to set its date, day to day across both weeks,
  within-day reorder, group reorder), ghost capture in context reusing the chip composer, and the
  selection + batch bar. Visual rules stay status = dot, priority = bar, date = chip.
- Activity surface: the event stream (pal_events, log + system events as one stream) with filters,
  and a snapshots UI (list pal_snapshots, view, and restore with undo over confirm).
- Cutover (M4, gated, needs my approval before any live step): final M2 resync, route swap so
  /palantir serves v2 and /palantir/legacy serves v1 read-only against the frozen row, and drop the
  palantir_state sync so pal_ becomes sole canonical. Plan the daily-write-path implication
  carefully: post-cutover the daily chat skill must stop driving the palantir_state bridge
  (pal_apply_to_v1 rebuilds pal_ from palantir_state, which goes stale once pal_ is canonical) and
  instead apply directly to pal_ via pal_apply_update, with palantir_state frozen as the archived v1
  row. Reversal: swap routes back, tables stay synced via export. Snapshot at cutover.

Build rules: keep every v2 pattern from 5a/5b (row-level writes through the store actions, undo over
confirm, the single HierarchyList renderer, derive.js owns all selectors, inline styles, no
window.confirm, the drag context in components/dnd.jsx). Critical environment note: this repo has a
host/sandbox desync where overwriting or editing an existing file can leave a truncated copy in the
build sandbox while brand-new files sync fine. After any overwrite or edit, verify the sandbox sees
full content (wc -l or a build) before trusting it, and prefer writing via a bash heredoc for
overwrites. Daily updates happen from my work laptop (claude.ai chat only); Cowork is dev-only, so
run any live cutover step with the app closed and behind my approval. Finish with a green vite build
(build to a temp outDir to avoid the dist EPERM), a reversible live round-trip test of any new write
or migration, confirmation that v1 App.jsx is byte-identical until the cutover step itself, and one
chained git line for me to run.

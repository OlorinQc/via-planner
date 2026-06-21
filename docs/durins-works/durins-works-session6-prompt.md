Durin's Works: Session 6 prompt (Records + polish)
Suggested model: Sonnet for cost / contractor / maintenance (mechanical build-out). Switch to Opus only if you take on photo upload via Supabase Storage or the snapshot-restore path in the same session, since those are pattern-setting.

Load the `palantir-dev` skill conventions (single-file React, the `T` token system, `ss` atoms, no deps, dark theme, inline styles only). Read `docs/durins-works/durins-works-phase2-blueprint.md` section 4.3 (action plan: the Coût block), 4.7 (Entretien recurrence), 3.2 (the document shape: cost / contractor / photos / maintenance.history), and the Session 6 row in section 6. `docs/durins-works/durins-works-mockup.html` is illustrative only.
Note on paths: the repo is at `C:/Users/KarlH/Documents/02.Claude Apps/Karl's Apps/kh-tools`. Durin's Works is the single file `src/apps/Durin's Works/App.jsx`, route `/durins-works`, sharing the `T` tokens. Store is `durins_works_state` (one row id=1, `state` jsonb, `version` int) plus `durins_works_snapshots` (id bigint identity, label, state, created_at). Supabase project `ngdbtgsbtyfghdyqbazj`.

CONTEXT Sessions 0 through 5 are done, committed, and live. The app loads one document, self-seeds via `buildSeedDoc()`, derives in-memory shapes via `hydrateDoc()`, and saves the whole document through the version-guarded `persist()` with a once-per-session snapshot (`stateRef` holds the live doc, `versionRef` the guard, `snappedRef` the snapshot flag, `bump()` force-renders writes with no keyed map). The action shape already carries the Session 6 placeholders, seeded empty: `cost: { estimate: null, actual: null, quotes: [] }`, `contractor: null`, `photos: []`. Maintenance tasks carry `history: [{ date }]`, and `toggleMaint` already appends/removes today's entry; `currentSeason()` and `seasonMatch()` exist; the blueprint 3.3 "maintenance due" rule is: a task is due when its season matches the current season and its last `history` entry is not in the current cycle. `durins_works_snapshots` rows are written before the first structural write of each session but there is no UI to view or restore them. Existing mutation handlers all route through `persist()`. The Session 5 in-app quick-add (`QuickAdd` + `parseQuickAdd`) and the `durins-works` Claude skill are live; the skill grammar currently says cost / contractor / photos are out of scope.

GOAL Build the record layer and finish the polish, without breaking Projets, Calendrier, Aujourd'hui, Achats, Entretien, or the quick-add.

DELIVERABLES
1. Coût (in `ActionView`, and a roll-up in `ProjectDashboard`):
   * Edit `action.cost.estimate` and `action.cost.actual` (numbers, nullable), and manage `action.cost.quotes` as a list of `{ id, who, amount, note }` (add / edit / remove). Show a small estimate-vs-actual readout.
   * In `ProjectDashboard`, add a project cost roll-up (sum of action estimates and actuals across the system), beside the existing materials subtotal.
   * New handlers (e.g. `setActionCost`, `addQuote`, `removeQuote`) routed through the existing `persist()`. No new persistence path.
2. Contractor (in `ActionView`):
   * Edit `action.contractor` as `{ name, phone, email, notes }` (null when empty). One handler `setActionContractor` through `persist()`.
3. Photos (in `ActionView`): DECIDE THE STORAGE APPROACH IN THE PLAN and get my approval before building. Options to weigh: (a) Supabase Storage bucket (e.g. `durins-works-photos`) with upload from the phone, storing `{ id, url, caption, at }` in `action.photos` (right for on-site capture, needs a bucket + access policy + upload code); (b) link-only, paste an image URL into `photos`; (c) defer photos to a later session. Do not embed base64 in the JSONB document. If we go with Storage, keep the document storing only the path/URL.
4. Maintenance recurrence (in `EntretienView`):
   * Surface due state per task: a "due" badge when due, the last-done date, and the next-due cycle, computed from `history` + season (blueprint 3.3). Show a short history list and allow unchecking the current cycle. Keep Entretien out of Today and the shopping flow.
5. Snapshots / restore view:
   * A new surface (desktop sidebar entry plus a way in on phone) listing `durins_works_snapshots` (label, created_at, newest first), with a per-row summary (counts: systems, scheduled actions, materials, runs) and a Restore action.
   * Restore writes the chosen snapshot's `state` back into `durins_works_state` under the version guard, after snapshotting the current state first, with a clear confirm. Reload the in-memory shapes after restore.
6. Optional: extend the `durins-works` skill grammar (`kh-tools/skills/durins-works/update-grammar.md` + SKILL.md) to cover the new record fields (set cost / add quote / set contractor / add photo link), and remove the "do not author" note. Deliver the updated skill as an installable `.skill` file.

CONSTRAINTS
* Single file `App.jsx`, React, existing `T` tokens and `ss` atoms, no new dependencies, no Tailwind, no UI library, dark theme, inline styles to match surrounding density.
* Reuse the version-guarded `persist()` plus the once-per-session snapshot for every in-app write. Restore uses the same guard-and-snapshot contract.
* Keep all existing surfaces and the quick-add working. Match the seeded document shape exactly for cost / contractor / photos.

PROCESS (standing preference)
* First summarize your understanding, the planned components and handlers, the photo-storage decision with a recommendation, and the restore-path design, then get my approval before large edits. Never use em dashes. Edit in bounded chunks.

VERIFICATION
* Known quirk: the bash sandbox can serve a stale or truncated copy of `App.jsx` right after an edit, and in-place edits may not sync. Do not treat a sandbox build error as real. Verify by reading the actual file with the Read tool, compiling the changed code in an isolated esbuild harness (`--format=esm --loader:.jsx=jsx`, real code plus stubs), and unit-testing logic in node (especially the maintenance-due computation and the snapshot summary counts). Netlify builds the committed host file, which is the real compile.
* Test the restore path against a sample `state` in node before wiring it, since it overwrites the whole document: confirm it snapshots current, writes the chosen state under the guard, and reloads.
* End with a single chained `git add -A && git commit -m "..." && git push` for `App.jsx` (and any docs/skill changes). If the skill is updated, also hand me the refreshed `.skill` file to install (it is not auto-installed).

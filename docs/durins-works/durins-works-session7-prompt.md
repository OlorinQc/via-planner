# Durin's Works: Session 7 prompt (Polish + close-out)

Suggested model: Sonnet. This is mechanical polish and a small Supabase cleanup. Switch to Opus only if you take the legacy-table drop plus a data-model change in the same pass.

Load the `palantir-dev` skill conventions (single-file React, the `T` token system, `ss` atoms, no deps, dark theme, inline styles only). Read `docs/durins-works/durins-works-phase2-blueprint.md` section 3.4 (write safety: snapshot before the first structural write, keep the last 30) and the Session 6 row in section 6 (the named polish: empty states, the Hub tile, responsive breakpoints). `docs/durins-works/durins-works-mockup.html` is illustrative only.

Note on paths: the repo is at `C:/Users/KarlH/Documents/02.Claude Apps/Karl's Apps/kh-tools`. Durin's Works is the single file `src/apps/Durin's Works/App.jsx`, route `/durins-works`, sharing the `T` tokens. The Hub tile lives in the KarlOS hub shell (the home grid), not in this file. Store is `durins_works_state` (one row id=1, `state` jsonb, `version` int) plus `durins_works_snapshots`. Supabase project `ngdbtgsbtyfghdyqbazj`. Private photos bucket `durins-works-photos`.

CONTEXT Sessions 0 through 6 are done and live. Session 6 shipped the record layer (cost, contractor, photos to the private bucket), maintenance recurrence (`maintDueState` from history plus season), and the Sauvegardes snapshots/restore view; the `durins-works` skill now covers the record fields. This session closes out the blueprint: the polish the Session 6 row named, plus two correctness and cleanup items. No new feature surfaces.

GOAL Close out the build with polish and cleanup, without breaking Projets, Calendrier, Aujourd'hui, Achats, Entretien, the quick-add, or Sauvegardes.

DELIVERABLES
1. Snapshot pruning (correctness gap). The app inserts a `durins_works_snapshots` row on the first write of a session (in `persist()`) and again in `restoreSnapshot`, but never prunes, so snapshots grow unbounded. After each insert, prune to the most recent 30 by id (blueprint 3.4), the same rule the skill already applies. Keep it to one extra delete and never let a prune failure block the write.
2. Photo captions (deferred from Session 6). Let a photo's `caption` be edited in `ActionView` (a small input under the thumbnail, commit on blur) through one new handler `updatePhoto(actionId, photoId, patch)` routed via `persist()`. The `caption` field already exists in the seeded shape; this only adds the in-app edit.
3. Empty-state pass. Make empty states consistent and useful across Projets, Aujourd'hui, Achats (each bucket), Entretien, Sauvegardes, and an action with no plan: one shared card style and one helpful next-step line each. Nothing that implies a missing feature.
4. Phone header and responsive pass. The phone header now carries KarlOS, the title, the Sauvegardes button, the quick-add +, and the save indicator. Confirm it does not crowd at 380px and tighten if needed. Re-check the Session 6 blocks (Coût, Entrepreneur, Photos) and `SnapshotsView` at 380px and 1200px.
5. Hub tile. Update the Durin's Works tile on the KarlOS hub to reflect the finished app, matching the copy and status pattern of the other tiles. This touches the hub shell, not `App.jsx`; read it first and match the existing tile.
6. Optional cleanup: drop the three superseded Phase 1 tables (`durins_works_action_statuses`, `durins_works_maintenance_completions`, `durins_works_shopping_items`) via a Supabase migration, now that the single document is the only source. This is destructive and irreversible: confirm in the plan before running it.

CONSTRAINTS
* Single file `App.jsx` for the app changes; the Hub tile is its own file. Existing `T` tokens and `ss` atoms, no new dependencies, no Tailwind, no UI library, dark theme, inline styles to match surrounding density.
* Reuse the version-guarded `persist()` plus the once-per-session snapshot for every in-app write. Match the seeded document shape exactly; carry every field through unchanged.

PROCESS (standing preference)
* First summarize your understanding, the planned change per deliverable, and the prune approach, then get my approval before large edits. Never use em dashes. Edit in bounded chunks. Confirm explicitly before the legacy-table drop.

VERIFICATION
* Known quirk: the bash sandbox can serve a stale or frozen copy of `App.jsx`, and git inside the sandbox may see a truncated working tree. Do not treat a sandbox build error or a sandbox git diff as real. Verify by reading the actual file with the Read tool, compiling the changed code in an isolated esbuild harness (`--format=esm --loader:.jsx=jsx`, real code plus stubs), and unit-testing logic in node (especially the prune keeping the newest 30 by id).
* End by handing me the single chained `git add -A && git commit -m "..." && git push` to run on the host, since the sandbox cannot commit the real file. If the skill or docs change, hand me the refreshed `.skill` too.

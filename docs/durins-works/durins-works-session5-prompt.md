# Durin's Works: Session 5 prompt (Capture + Claude skill)

Paste the block below to start Session 5. Suggested model: Opus (this introduces a parser-driven capture surface and a new write-back skill, both pattern-setting).

---

Load the `palantir-dev` skill conventions, and read the `palantir` skill end to end (the notes-to-state write-back skill) so the new Durin's Works skill mirrors its shape, its read/snapshot/version-guard/write-back discipline, and its parsing-grammar documentation style. Read `docs/durins-works/durins-works-phase2-blueprint.md` section 5 (capture and Claude) and section 7 (the action-plan authoring format), and skim `docs/durins-works/durins-works-phase1-audit.md` part 3 (the missing capture loop). `docs/durins-works/durins-works-mockup.html` is illustrative only.

Note on paths: the repo lives at `C:/Users/KarlH/Documents/02.Claude Apps/Karl's Apps/kh-tools` (not the `kh-tools` path written in the skill). Use the real path. Durin's Works is the single file `src/apps/Durin's Works/App.jsx`, mounted at `/durins-works`, sharing the `T` token system. The store is `durins_works_state` (one row `id = 1`, `state` jsonb, `version` int) plus `durins_works_snapshots`.

CONTEXT Sessions 0 through 4 are done and deployed. The app loads one document, self-seeds via `buildSeedDoc()`, derives in-memory shapes via `hydrateDoc()` (returns `st` statuses, `md` maintenance-done, `items` materials, `sched` schedules, `sd` step-done map, `runs` buyRuns), and saves the whole document through the version-guarded `persist()` with a once-per-session snapshot. `stateRef` holds the live doc, `versionRef` the guard, `snappedRef` the snapshot flag, and a `bump()` force-render covers writes with no keyed map. The document shape is blueprint 3.2: systems carry actions with `desc`, `priority`, `scheduledDate`, `status`, `cautions`, `steps` (`{id,text,detail,material,caution,done}`), `materialIds`, `log` (`{at,text}`), plus cost/contractor/photos placeholders; `materials` carry `article/magasin/prix_unitaire/qty/status/project/bought`; `buyRuns` are `{id,date,magasin,materialIds,done}`. The existing mutation handlers, all routed through `persist()`, are: `changeStatus`, `scheduleAction`, `toggleStep`, `addLogEntry`, `linkExistingMaterial`, `addActionMaterial`, `unlinkMaterial`, `applyPlan` (the section 7 paste), `addShopItem`/`saveShopItem`/`deleteShopItem`, `toggleMaint`, and the Session 4 buy handlers `assignToRun` (groups a selection by store into a dated run), `toggleBought`, `removeFromRun`, `toggleRunDone`, `deleteRun`. The top bars already carry a placeholder "+" button titled "Ajout rapide (à venir)".

GOAL Build the two near-zero-effort capture paths from blueprint section 5. (1) An in-app quick-add behind the top-bar "+" that turns one short French sentence into a single proposed change, shows a one-line preview, and applies it on one tap through the existing handlers. (2) A Durin's Works skill, mirroring the Palantír skill, so Karl can tell Claude in a chat "log that the mason quoted 1200 and book the foundation for Thursday, and add a GFCI and a tester to Saturday's Rona run," and Claude reads the store, snapshots, applies the changes under the version guard, and writes back. The deployed app stays the daily driver; chat and Cowork are for capture and development.

DELIVERABLES

1. In-app quick-add (in `App.jsx`):
   * Wire the "+" to open a single-line input (a small sheet on phone, a popover on desktop). As Karl types, parse the sentence and render a one-line preview of the interpreted action with the target it resolved, plus a confirm and a cancel.
   * Cover at least these intents, each routed to the existing handler: add a material (article, optional `chez <magasin>`, `<n>$`, `x<qty>`, `pour <projet>`) via `addShopItem`; append a journal line to a named or currently-open action via `addLogEntry`; schedule a named or currently-open action (`aujourd'hui` / `demain` / a date) via `scheduleAction`; and assign a material to a dated shopping run (`... dans la course de samedi chez Rona`) via `assignToRun`, creating the material first if it is new.
   * Resolve action and material references tolerantly (case- and accent-insensitive substring against `desc` / `article`); when the target is ambiguous, show the best guess in the preview and let Karl correct it before confirming. Default to the safest intent (material add) when nothing else matches. Never write without the confirm tap.
   * All writes flow through the existing version-guarded `persist()` and the once-per-session snapshot. Add no new persistence path.

2. Durin's Works skill (delivered as files, mirroring the `palantir` skill):
   * A `SKILL.md` plus any helper, authored so Claude can, from a chat with the Supabase connector available, read `durins_works_state` (row 1: `state`, `version`), write a `durins_works_snapshots` row before the first structural change, apply the parsed updates to the JSON, and write back to `durins_works_state` with the optimistic version guard (`update ... where id = 1 and version = <read version>`, reload-and-retry once on a 0-row result), keeping the last 30 snapshots. Mirror how the Palantír skill structures read, snapshot, apply, and guarded write-back; decide and justify in the plan whether to write directly or to add a hardened apply RPC like Palantír's `pal_apply_to_v1` bridge.
   * Support an update grammar covering: log a line on an action, set or clear an action's status and `scheduledDate`, add or link a material, assign materials to a dated run (create or extend, grouped by store) and mark bought, toggle a maintenance task, and paste a section 7 action plan onto an action. One sentence may carry several updates.
   * Document the update grammar and restate the section 7 authoring format inside the skill, with worked examples, exactly as the Palantír skill documents its import grammar.
   * Since skills cannot be installed from inside this session, deliver the skill as a folder Karl installs himself, and tell him where to drop it (alongside the `palantir` skill) and how he will invoke it.

CONSTRAINTS

* The in-app part stays in the single file `App.jsx`, React, the existing `T` tokens and `ss`/atoms, no new dependencies, no Tailwind, no UI library, dark theme. The skill is separate files, not code in `App.jsx`.
* Reuse the Session 0 version-guarded `persist()` plus the once-per-session snapshot for every in-app write. The skill uses the same guard-and-snapshot contract against Supabase.
* Do NOT build this session: cost / contractor / photos, maintenance recurrence, and the snapshots/restore view (all Session 6). Keep Projets, Calendrier, Aujourd'hui, Achats, and Entretien working.

PROCESS (Karl's standing preference)

* First summarize your understanding, the planned quick-add grammar and component, the skill's read/snapshot/apply/write-back design (including the direct-write vs RPC decision), and the key choices, and get Karl's approval before large edits. Never use em dashes in anything you write for Karl. Edit in bounded chunks.

VERIFICATION

* Known quirk: on this folder the bash sandbox can serve a stale or truncated copy of `App.jsx` right after the editor writes it, and in-place edits may never sync to the sandbox. Do not treat a sandbox build error as real. Verify instead by reading the actual file with the Read tool, by compiling the new code in an isolated esbuild harness (real functions plus stubs, `--format=esm --loader:.jsx=jsx`), and by unit-testing the parser logic in node. Netlify builds the committed host file, so the deploy is the real compile.
* Confirm: the app compiles; the "+" opens, parses each intent, previews the resolved target, and applies on confirm through the right handler with persistence still version-guarded; the parser handles a handful of real French sentences for each intent; the skill, dry-run against a sample `state`, produces the correct mutated JSON and a valid guarded write-back, and its documented grammar round-trips the section 7 example.
* Karl runs all git himself. End by giving him a single chained `git add -A && git commit -m "..." && git push` for `App.jsx` and the new docs, and separately hand him the skill folder to install, noting it is not auto-installed.

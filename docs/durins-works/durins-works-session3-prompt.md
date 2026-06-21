# Durin's Works: Session 3 prompt (Action plans: checkable steps + authoring parser)

Paste the block below to start Session 3. Suggested model: Sonnet (this is mechanical build-out on an architecture Sessions 1 and 2 already set).

---

Load the `palantir-dev` skill conventions. Read `docs/durins-works/durins-works-phase1-audit.md` and `docs/durins-works/durins-works-phase2-blueprint.md`. Blueprint section 4.3 is the authoritative spec for the action plan screen and section 7 is the authoritative spec for the authoring format; `docs/durins-works/durins-works-mockup.html` is an illustrative reference for the look of the step plan.

CONTEXT
Durin's Works is Karl's renovation tracker for 8235 Avenue Orégon, one app inside the KH Tools / KarlOS hub (React + Vite + Supabase, repo OlorinQc/via-planner, branch master, Netlify auto-deploy on push). It is a single file: `src/apps/Durin's Works/App.jsx`, mounted at `/durins-works`, sharing the `T` token system.

Note on paths: the repo lives at `C:/Users/KarlH/Documents/02.Claude Apps/Karl's Apps/kh-tools` (not the `kh-tools` path written in the skill). Use the real path.

Sessions 0, 1, and 2 are already done and deployed:

* The app loads one document from `durins_works_state` (`state` jsonb, `version` int), self-seeds from the `SYSTEMS` / `MAINTENANCE` / `SHOPPING_SEED` constants via `buildSeedDoc()`, derives in-memory shapes via `hydrateDoc()` (which returns `st` statuses, `md` maintenance-done, `items` materials, and `sched` schedules), and saves the whole document through `persist()` with an optimistic version guard plus a once-per-session snapshot into `durins_works_snapshots`. `stateRef` holds the live doc, `versionRef` the guard.
* The shell is responsive (`useIsDesktop()` matchMedia at 820px): a `PhoneShell` (bottom tabs Projets / Aujourd'hui / Achats / Entretien, full-screen push detail) and a `DesktopShell` (left sidebar Calendrier / Projets / Achats / Entretien plus main and right detail panes). The zoom slider, density buttons, and `ResizeHandle` are gone.
* Projets is the front door: `ProjectList`, `ProjectDashboard`, and a basic `ActionView`. The "Plan prêt (N étapes) / Plan à venir" badge already keys off `action.steps.length`.
* `ActionView` already renders: a back affordance, priority, the plan badge, the description, the status control, a `PlanifierControl` (Aujourd'hui / Demain / date / Retirer), a read-only red Précautions block when `action.cautions` is non-empty, a read-only list of `action.steps`, Pourquoi (system context), composantes, notes, and source.
* Scheduling (Session 2) is live: a `schedules` map plus `scheduleAction(id, date)` version-guarded handler, a desktop `CalendarView` (week grid, work chips, à planifier tray, select-then-click assign), and a phone `AujourdhuiView`.
* The document shape is blueprint 3.2. Each action carries: `desc`, `priority`, `timing`, `scheduledDate`, `status`, `cautions` (string array), `steps` (`{ id, text, detail, material, caution, done }`), `materialIds` (string array into `materials`), `log` (`{ at, text }` array), `cost`, `contractor`, `photos`, `composantes`, `source`, `notes`. `steps`, `cautions`, and `materialIds` are seeded empty.

GOAL
Turn the basic `ActionView` into the real execution screen from blueprint 4.3: interactive checkable and expandable steps, the action-level Précautions block, a per-action materials roll-up with an add control, and a one-line journal. Then add a parser for the section 7 authoring format so a researched plan can be pasted onto an action. Everything reads from and writes to the loaded document.

DELIVERABLES

1. Interactive Étapes (replace the current read-only step list):
   * Ordered steps, each with a number you tap to toggle `done` (the step grays out and strikes through), persisted as `step.done` in the document.
   * Tap the step text to expand and collapse its `detail` (local UI state, not persisted).
   * Each step still shows its optional material chip and caution chip.
   * Done state persists through a version-guarded write and survives reload. Add whatever reactive layer you need (mirror how `statuses` / `schedules` are hydrated and held), and extend `hydrateDoc` if you derive a step-done map.
   * Show a small progress count for the action (steps done / total).

2. Précautions: keep the red action-level block, confirm it matches 4.3 and renders `action.cautions`.

3. Matériaux roll-up in the action: resolve `action.materialIds` against the `materials` list, render them with a subtotal (reuse the `MatRow` / `money` helpers), and add an "ajouter un matériau" control. Adding either links an existing material or creates a new `materials` row and appends its id to `materialIds`, then persists. This begins populating `materialIds`, the canonical link that the Projets dashboard and Achats will prefer over the interim project-text match.

4. Journal: render `action.log` as one-line entries with timestamps, plus a one-line append control that pushes `{ at: <ISO now>, text }` and persists.

5. Authoring-format parser (section 7): a "coller un plan" control (textarea) that accepts the pasted `ACTION / PRÉCAUTIONS / ÉTAPES / MATÉRIAUX` block, parses it into steps (text plus optional `detail:`, `material:`, `caution:`), action-level `cautions`, and materials, attaches the result to the current action (creating `materials` rows and linking `materialIds`), and writes back under the version guard. Parse the section 7 example tolerantly (numbered steps, the `detail:` / `material:` / `caution:` sub-labels, and a MATÉRIAUX list with best-effort `xN`, store, and `~NN$` hints). After a successful paste, the badge flips to "Plan prêt" automatically since it keys off `steps.length`.

CONSTRAINTS

* Single file (`App.jsx`), React, the existing `T` tokens, no new dependencies, no Tailwind, no UI library, dark theme.
* All new writes (step done, materials link/add, journal append, pasted plan) flow through the Session 0 version-guarded `persist()` plus the once-per-session snapshot. Hydrate any new reactive state from the document on load.
* Do NOT build this session: Coût (estimate / actual / quotes), contractor, and photos (Session 6); Achats time-phasing and shopping runs (Session 4); the Claude capture skill (Session 5). Keep Projets, Calendrier, Aujourd'hui, Achats, and Entretien working.

PROCESS (Karl's standing preference)

* First summarize your understanding, the planned component structure, and the key decisions, and get Karl's approval before large edits. Never use em dashes in anything you write for Karl.
* Edit in bounded chunks.

VERIFICATION

* Known quirk: on this folder the bash sandbox can serve a stale or truncated copy of a file right after the editor writes it, so `npm run build` may fail spuriously with an "unexpected end of file" near the edit. Before treating a build error as real, confirm the actual file via the Read tool, or reconstruct it in /tmp and run `./node_modules/.bin/esbuild /tmp/app.jsx --format=esm` as a syntax check. Also, building to the repo `dist` can hit an EPERM clearing the host-owned folder; build to an alternate outDir (for example `--outDir /tmp/dw/dist --emptyOutDir`) to confirm a clean build.
* Confirm: the app compiles; tapping a step number toggles done and the state survives a reload; tapping step text expands the detail; pasting the section 7 example onto an action (for example a7-4) creates the steps, the action cautions, and the linked materials and flips the badge to Plan prêt; the materials roll-up subtotal is correct; a journal line persists; the phone shell at 380px and the desktop shell at 1200px still render cleanly; persistence is still version-guarded.
* Karl runs all git himself. End by giving him a single chained `git add -A && git commit -m "..." && git push` command using the real repo path above.

# Durin's Works: Session 1 prompt (Responsive shells + Projets front door)

Paste the block below to start Session 1. Suggested model: Opus (this sets the UI architecture both later sessions build on).

---

Load the `palantir-dev` skill conventions. Read `docs/durins-works/durins-works-phase1-audit.md` and `docs/durins-works/durins-works-phase2-blueprint.md`. The blueprint section 4 is the authoritative UI spec; `docs/durins-works/durins-works-mockup.html` is an illustrative reference for the look and the Projets / action flow.

CONTEXT
Durin's Works is Karl's renovation tracker for 8235 Avenue Orégon, one app inside the KH Tools / KarlOS hub (React + Vite + Supabase, repo OlorinQc/via-planner, branch master, Netlify auto-deploy on push). It is a single file: `src/apps/Durin's Works/App.jsx`, mounted at `/durins-works`, sharing the `T` token system.

Session 0 is already done and deployed:
- The app loads one document from the Supabase table `durins_works_state` (columns `state` jsonb, `version` int), self-seeds it from the `SYSTEMS` / `MAINTENANCE` / `SHOPPING_SEED` constants on first run via `buildSeedDoc()`, derives the in-memory shapes via `hydrateDoc()`, and saves the whole document through `persist()` with an optimistic version guard plus a once-per-session snapshot into `durins_works_snapshots`.
- `stateRef` holds the live document; `versionRef` holds the guard.
- The four existing views (`DashboardView`, `TravauxView`, `AchatsView`, `EntretienView`) still render from the module constants, and the old desktop split-pane shell is still in place: a zoom slider, density buttons, and mouse-only `ResizeHandle` panels.
- The document shape is blueprint section 3.2 (systems with actions carrying scheduledDate, status, steps, cautions, materialIds, log, cost; maintenance with history; materials; buyRuns).

GOAL
Replace the single desktop-only shell with two responsive shells chosen by viewport width, and rebuild the work browsing into the Projets front door, reading content from the loaded document. Match blueprint section 4 and the mockup.

DELIVERABLES
1. Responsive shell driven by a `matchMedia` width listener (re-render on change):
   - Phone (below ~820px): app shell. Bottom tab bar with Projets, Aujourd'hui, Achats, Entretien. Single column. Detail screens push full-screen with a back affordance. Top bar: KarlOS button, "Durin's Works", a quick-add "+" placeholder, and the save dot.
   - Desktop (~820px and up): web shell. Left sidebar (Calendrier placeholder, Projets, Achats, Entretien) plus a main pane; for Projets use a list plus a right detail pane.
   - Remove the zoom slider, the density buttons, and all `ResizeHandle` usage. Replace fixed-width side-by-side panels with responsive layout. The `zoom` CSS on the inner shell goes away.
2. Projets front door, reading from `stateRef.current.systems`:
   - Project list: cards showing name, zone, a priority color on the left border, and progress (N done / total), ordered by priority.
   - Project dashboard: header (name, zone, priority, progress), the "Ce que l'on sait" and "Pourquoi" context blocks, the ordered actions (each: one-line desc, priority, and a "Plan prêt / Plan à venir" badge depending on whether `steps` is non-empty), and the project's materials with a subtotal.
   - Action view (basic only this session): description, priority, the existing status control, "Pourquoi", composantes, notes. If `steps` exist, render them as a simple read-only list. The checkable / expandable step plan is Session 3, not now.
3. Achats and Entretien: keep current behavior, but render cleanly single-column on phone (Achats as cards below ~640px instead of the 762px table) and normally on desktop.
4. Read content (systems, maintenance, materials) from the loaded document, not the module constants. The constants stay only as the seed source inside `buildSeedDoc`.
5. Do not regress persistence: status changes, maintenance toggles, and shopping edits keep flowing through the Session 0 `saveStatus` / `toggleMaint` / `saveShopItem` / `addShopItem` / `deleteShopItem` (all version-guarded).

CONSTRAINTS
- Single file (`App.jsx`), React, the existing `T` tokens, no new dependencies, no Tailwind, no UI library, dark theme.
- Do NOT build this session: the calendar, scheduling, the checkable / expandable step plan, the shopping runs, or capture. Those are Sessions 2 to 4. Leave Aujourd'hui and Calendrier as labeled placeholders.

PROCESS (Karl's standing preference)
- First summarize your understanding, the planned component structure, and the key layout decisions, and get Karl's approval before large edits. Never use em dashes in anything you write for Karl.
- Edit in bounded chunks.

VERIFICATION
- Heads up on a known quirk: on this folder the bash sandbox can serve a stale or truncated copy of a file right after the editor writes it, so `npm run build` may fail spuriously with an "unexpected end of file" near the edit point. Before treating a build error as real, confirm the actual file via the Read tool, or reconstruct it in /tmp (good head plus known tail) and run `./node_modules/.bin/esbuild /tmp/app.jsx --format=esm` as a syntax check.
- Confirm: the app compiles; the phone shell at 380px has every tab reachable with no horizontal overflow and a readable Achats; the desktop shell at 1200px shows sidebar plus list plus detail; persistence still works.
- Karl runs all git himself. End by giving him a single chained `git add -A && git commit -m "..." && git push` command.

# Durin's Works: Phase 1 System Audit

Prepared June 19, 2026. Evidence base: full read of `src/apps/Durin's Works/App.jsx` (1,176 lines), the live Supabase tables (`durins_works_action_statuses`, `durins_works_maintenance_completions`, `durins_works_shopping_items`), platform wiring (`main.jsx`, `Hub.jsx`, `supabase_migration.sql`), the Palantír 2.0 audit and blueprint lineage in `docs/palantir-2.0/`, and Karl's stated use-case: a phone-first, on-site tool for coordinating the renovation of 8235 Avenue Orégon, centered on "what I do today, what I buy today, and for each task what to do, in what order, and what materials I need."

---

## 0. Verdict

Durin's Works is a beautifully made reference binder for a renovation, built in the shape of a desktop dashboard, for a job that is actually done on a phone with dirty hands between two tasks. The craftsmanship is real and the domain content is excellent. But the app was designed as a thing to read, and Karl needs a thing to act from. That gap, not any single bug, is why a motivated owner mid-purchase has opened it and never touched it.

The one-sentence diagnosis: **Durin's Works is an excellent renovation catalogue with no execution loop, frozen in code, on the wrong device.**

Three findings dominate everything else:

1. **The content is the crown jewel, and it is trapped in the source.** Fifteen building systems, sixty-three concrete actions, and twenty-four seasonal maintenance tasks, every one carrying priority, timing, affected components, inspection-page source, and a plain-language "why," are hardcoded as JavaScript constants. The app can render them; it cannot grow, schedule, or annotate them. Karl can flip a status dropdown. He cannot add the task the inspector missed, log "called the mason June 22," or record a $1,200 quote without editing code and redeploying. This is the same disease that stalled Palantír 1.x ("excellent read surface, failed write path"), in a more acute form: here there is no write path for the domain content at all.

2. **It is built for the wrong device.** The codebase contains zero responsive design: no media queries, no touch handlers, no viewport logic of any kind. The layout is fixed-width side-by-side panels with mouse-only resize handles, the purchasing table is 762 pixels wide, the type runs 9 to 13 pixels, and the bottom bar carries a desktop zoom slider. Karl's real context is a phone, on a job site. The current interface is close to unusable there, and that is the single biggest reason the app sees no use.

3. **The execution loop Karl needs does not exist anywhere in the app.** He needs to see what he is doing today and what to buy today, then open a task and find the steps, the order, and the materials. The app has no dates, no schedule, no concept of "today," and no link between an action and the materials it requires. It is organized as a static archive, browsable by system and by season. It is not organized as a plan you work from.

A fourth point frames the other three: **there is no usage data to analyze, and that absence is itself the finding.** The database holds 0 action statuses, 0 maintenance completions, and a shopping list that is still exactly the 18 untouched seed rows. A tool built to this level of polish, by the person who needs it most, during the exact window it was built for, that records not a single interaction, is not telling us about Karl's discipline. It is telling us about product fit. The rest of this audit is the design review that the zero demands.

---

## 1. The numbers

| Metric | Value | Reading |
|---|---|---|
| Source | 1 file, 1,176 lines, 4 views, ~7 components | Smaller than Palantír (2,739), same single-file trajectory |
| Building systems | 15 | Expert-grade, inspection-traceable |
| Actions | 63 | The real work catalogue, each with priority/timing/source/why |
| Maintenance tasks | 24 | Seasonal, well-detailed |
| Shopping seed items | 18 | Curated, with IKEA SKUs and live cost roll-up |
| Supabase tables | 3 | `action_statuses`, `maintenance_completions`, `shopping_items` |
| Action statuses set (live) | **0** | Nothing marked started or done |
| Maintenance completions (live) | **0** | No task ever checked off |
| Shopping rows (live) | 18 (= the seed, untouched) | Seeded once, never edited |
| Responsive: `@media` queries | **0** | No mobile layout exists |
| Responsive: touch handlers | **0** | Resize and drag are mouse-only |
| `matchMedia` / `innerWidth` use | **0** | The app is blind to screen size |
| Smallest font size in use | 9px | Below comfortable touch legibility |
| Widest fixed table (Achats) | 762px | Forces horizontal scroll on any phone |
| Persisted domain content | **None** | Systems, actions, maintenance are code constants |

The headline is the cluster of zeros. Scale will never be this app's problem; the content is rich and the data is tiny. The problem is that the three things that persist (statuses, completions, shopping) are overlays on a catalogue, and the one thing Karl actually needs to persist, an editable plan he can drive from his phone, has no home in the model.

---

## 2. System and data model

### 2.1 Does the model match the work?

It matches the *reference* layer of the work beautifully and the *execution* layer not at all.

A renovation, as Karl is living it, has three layers. There is the diagnosis (what is wrong with the house and why), the plan (what I am doing this week, today, in what order, with what materials and budget), and the record (what I did, what it cost, who I called, what I still owe). Durin's Works models the first layer with real expertise and ignores the other two.

**What the model captures well.** The `SYSTEMS` array is genuinely good domain modeling. Each system bundles "ce que l'on sait," "pourquoi c'est important," a priority, a timing band, affected component codes, an inspection-page citation, and a set of concrete actions. This is decision-support, not a checklist, and it is the asset the whole project is built on.

**Where the model fights reality.**

- **The plan layer is missing entirely.** There is no date on any action. "Timing" is a fuzzy string ("Été 2026," "Jour 1," "Dès prise de possession"), useful for grouping but impossible to schedule against. You cannot ask "what is today," "what is this week," or "what comes before what." Karl's explicit need, "help me make a schedule of what I do today," has no primitive to attach to.
- **The record layer is missing entirely.** An action has a static `notes` field baked into the source and a status dropdown. There is no place to append progress ("mason came, quoted 1200, booked for the 24th"), no cost, no contractor, no photo, no history. The moment real life happens, the app has nowhere to put it.
- **Materials and work are not linked.** Achats items carry a free-text `project` string ("Plomberie," "Îlot de cuisine") that loosely echoes a system, and some action `notes` say "voir onglet Achats," but there is no data relationship between an action and the materials it needs. Karl's need, "for this task, what do I buy," requires him to eyeball two screens and match by memory.
- **The content cannot change.** Because systems, actions, and maintenance are constants, the catalogue is whatever the inspection said in April, forever. Renovations discover new work constantly. The app cannot absorb a single discovery.

### 2.2 Primitive scorecard

| Primitive | Verdict | Evidence |
|---|---|---|
| System (dossier) | **Keep.** The right organizing unit, well modeled. | 15, each with context and "why" |
| Action | **Keep, but free it.** The core work item. Must become editable, datable, annotatable. | 63, rich metadata, all hardcoded |
| "Ce que l'on sait" / "Pourquoi" | **Keep and protect.** Best decision-support in the app. | On all 15 systems |
| Maintenance task | **Keep, but make it recur.** Seasonal idea is right; the mechanics forget. | 24, completion overwrites with no history |
| Shopping item | **Keep.** The one fully working editable surface. | 18, live CRUD, cost roll-up |
| Status overlay | **Keep, but re-key.** Coupling to hardcoded IDs is brittle. | 0 in use, keyed to `a1-1` style strings |
| Date / schedule | **Build.** Does not exist. The spine of the "today" need. | Absent |
| Today plan | **Build.** Does not exist. Karl's primary requested surface. | Absent |
| Materials-per-task link | **Build.** Does not exist. Karl's primary drill-down need. | Absent |
| Action log / note history | **Build.** Static notes only. | Absent |
| Cost / quote | **Build.** Only shopping has prices; the works have none. | Absent |
| Contractor | **Build (light).** Reno is trade coordination; nothing models it. | Absent |
| Photo / document | **Build (light).** Inspection citations are dead text strings. | `INSP-P##` are not links |

### 2.3 What persists, and the cracks in it

Three tables persist, and each has a structural flaw worth naming before any rebuild.

1. **Statuses are keyed to hardcoded action IDs.** `durins_works_action_statuses.action_id` holds strings like `a1-1`, generated by hand in the source array. The moment anyone reorders, renumbers, or edits that array, the persisted statuses orphan silently. Live data is keyed to a literal that lives in a JavaScript file. This is the weakest integrity point in the model and it is structural, not cosmetic.

2. **Maintenance completion forgets on purpose.** `toggleMaint` upserts on `task_id`, so the table holds one row per task: the last time it was done. A `year` column exists but nothing reads it for reset logic. The consequence: a task checked this spring stays checked next spring, and there is no history of "done in 2026, due again in 2027." A seasonal maintenance tracker that cannot recur is a one-time checklist wearing a calendar's clothes.

3. **Shopping seeds once and never reconciles.** On first load, if the table is empty, the 18 `SHOPPING_SEED` rows are inserted. After that the seed and the table diverge with no path back. This is fine in isolation, but it is the only editable domain surface in the entire app, which is why the live table tells the whole story: 18 rows, the exact seed, never touched.

### 2.4 The single most important architectural fact

The content is in the code, not the database. Everything downstream follows from this. You cannot schedule what you cannot edit. You cannot annotate what you cannot write. You cannot let Claude help maintain a catalogue that only exists at build time. The Palantír 2.0 program spent its first three sessions moving content out of a frozen store and into editable, writable tables, and that single move is what unlocked everything after it. Durin's Works needs the same first brick, and it needs it before any of the features Karl asked for can exist.

---

## 3. The execution loop (the loop that is missing)

Palantír's audit centered on an update loop that had collapsed under its own friction. Durin's Works has the opposite problem: the loop Karl needs was never built, so there is nothing to collapse. This section describes the loop he asked for and measures the app against it.

**The loop Karl described, in his words, reordered as a flow:**

1. Open the app on my phone, on-site.
2. See what I am doing today, and what I need to buy today.
3. Pick a task. Read what to do, in what order, and what materials it needs.
4. Do it. Mark progress, jot a note, maybe a photo.
5. Move to the next task. Adjust the plan as reality changes.

**The app against that loop:**

| Step | What Karl needs | What exists today | Gap |
|---|---|---|---|
| 1. Open on phone | A usable phone screen | A desktop layout with no responsive code | Severe. The entry point itself fails |
| 2. Today + buy today | A dated plan and a shopping shortlist for today | A static "urgent by timing" list and a full season's maintenance | No dates, no "today," no buy-today |
| 3. Steps / order / materials | Per-task instructions, sequence, and linked materials | An action description, a "why," component codes, static notes | No ordered steps, no materials link |
| 4. Mark progress / note / photo | A quick write as you work | A status dropdown only | No note, no log, no photo |
| 5. Next task / adjust plan | Re-plan on the fly | Nothing to re-plan; the catalogue is fixed | No plan to adjust |

Every row resolves to the same two root causes already named: there is no plan layer (no dates, no today, no schedule), and there is no write path for content (no editing, no notes, no materials links, no capture). The mobile failure (step 1) sits on top of both and makes even the read-only catalogue unreachable in practice.

A note on capture, given Karl's stated constraint that he "won't have a lot of time to sit down." The most valuable thing the app could offer a busy on-site owner is a near-zero-effort way to put reality in: speak or type "bought the galvanized duct, 80 bucks, plumbing," or "electrician booked Thursday," and have it land in the right place. This is exactly the role Claude played for Palantír. Durin's Works has no skill, no import path, and no capture surface of any kind. For this user, in this context, that is a larger miss than it would be for a tool used at a desk.

---

## 4. UI and UX, read through a phone

### 4.1 Information architecture

The four-view split (Tableau de bord, Travaux, Achats, Entretien) is a sound concept and maps cleanly to diagnosis, work, materials, and upkeep. The problem is not the map; it is that every view is drawn for a wide mouse-driven screen, and the default view (Dashboard) is a read-only summary rather than the action surface Karl needs to land on.

### 4.2 View by view

**Tableau de bord (Dashboard).** Conceptually the closest thing to a "today," and the right instinct. It shows metric cards, the top ten urgent-by-timing actions, and the current season's maintenance. Weaknesses: "urgent" is derived from fuzzy timing strings, not dates, so it cannot answer "today"; the metric cards and the urgent list duplicate what Travaux already shows; and the layout is a two-pane split with a reversed resize handle and a side detail panel, which collapses badly on a narrow screen. The "Voir dans Travaux" button is a dead end (see 4.4).

**Travaux (Works).** The strongest screen and the heart of the app. Systems grouped by priority, an accordion of actions, a status dropdown per action, and a context panel showing "ce que l'on sait" and "pourquoi." This is good information design for a desk. On a phone it is a 300-pixel resizable left rail plus a detail pane, two columns competing for a 380-pixel viewport, with 11 to 13 pixel type and tap targets sized for a cursor. The content is exactly right; the container is exactly wrong.

**Achats (Purchasing).** The one fully functional editable surface: inline-editable cells, add and delete rows, status dropdowns, per-project and grand-total cost roll-ups in CAD. It is genuinely useful and it works. It is also a 762-pixel-wide fixed-column table (article 220, magasin 110, prix 70, qté 50, statut 120, notes 160, plus a delete column), which means a phone shows roughly half of one column at a time. The data model here is the most mature in the app and should survive; the presentation needs a card layout for narrow screens.

**Entretien (Maintenance).** Clean seasonal grouping with a "current season" highlight and good task detail. Undermined by the no-recurrence flaw (2.3): once checked, tasks never come due again, so over a single year the screen quietly drifts from a maintenance schedule into a list of things done once. The detail text is good enough that this content, too, is worth preserving.

### 4.3 The mobile verdict, stated concretely

This is not a matter of tightening a few breakpoints. The app has no responsive layer to tighten. Evidence, all verified in source: zero `@media` queries, zero touch event handlers, zero reads of `matchMedia` or `innerWidth`. The shared chrome assumes width it will not have: a 44-pixel header packed with a back button, a title, four nav tabs, an urgent badge, a 160-pixel search box, and a save indicator, all in one non-wrapping row; a bottom bar with three density buttons and a range slider; and an inner shell scaled by the non-standard `zoom` CSS property, a desktop-era hack. Making this phone-first is a rebuild of the shell and every view's layout primitives, not a patch. The good news is that the content and the visual tokens (`T`) are clean and fully reusable; it is the geometry that must change.

### 4.4 Specific defects found

- **Dead deep-link.** Dashboard's "Voir dans Travaux →" calls `handleGoToAction`, which sets `pendingGoTo` and switches the view. The receiving effect (lines ~1056 to 1060) simply clears `pendingGoTo` and does nothing with it. Travaux never receives it. The button changes tabs and abandons you at the top of the list. A half-built feature that looks finished.
- **Search is global in the chrome but works in one view.** The header search box is always visible, but `searchQuery` is passed only to `TravauxView`. Typing while on Dashboard, Achats, or Entretien does nothing, with no indication why.
- **Maintenance cannot recur** (2.3). The most consequential correctness gap for a seasonal tool.
- **Status coupling is brittle** (2.3). Live data keyed to source-literal IDs.
- **Desktop-only interactions.** Resize handles and any drag use `onMouseDown` and `mousemove`; there are no touch equivalents, so these are inert or awkward on a phone even where they render.

---

## 5. Code health

At 1,176 lines in one file, Durin's Works is on the same single-file path Palantír walked to 2,739, but it is far earlier and far healthier. The `T` token object is disciplined and shared with Palantír, the four view components are reasonably separated, the helpers (`timingStyle`, `seasonMatch`, `currentSeason`) are clean, and the Supabase calls are simple and correct. There is no seven-renderer disease here yet, because there is only one real hierarchy (system to action) and it is rendered in two places, not seven.

The real code-health issues are architectural, not stylistic:

- **Content as code.** The 15-system, 63-action, 24-task, 18-item payload lives in module constants. This is the central fact of the audit and the central refactor of the blueprint. It is also, helpfully, very clean data that will migrate to the database almost verbatim.
- **The `zoom` shell hack.** `zoom: effectiveZoom` on the inner container is non-standard, interacts poorly with fixed layouts, and exists only because sizing was hardcoded rather than scaled from a base. It should not survive a mobile rebuild.
- **No tests, no error boundaries, no snapshots.** Acceptable at today's scale and zero usage, but the moment content becomes editable (and therefore loseable), Durin's Works will need the snapshot discipline Palantír already has and Durin's entirely lacks.
- **Inline styles everywhere.** Fine for this size, but a mobile rebuild is the right moment to introduce a few shared layout primitives (a responsive shell, a card, a bottom tab bar) rather than re-inlining geometry per view.

The encouraging conclusion: this is a salvage, not a teardown. The content is migratable, the tokens are reusable, the view concepts are sound. What changes is where the data lives and what shape the container takes.

---

## 6. What is genuinely good and must survive

1. **The domain content.** Fifteen systems, sixty-three actions, twenty-four maintenance tasks, all inspection-traceable, all carrying priority, timing, components, source, and a human "why." This is the project's reason to exist and a real piece of expert work. Any rebuild must migrate it faithfully and lose nothing.
2. **The "ce que l'on sait / pourquoi c'est important" framing.** Decision-support, not a checklist. It is what makes this more than a to-do app, and it is exactly what a non-expert owner needs while standing in front of a cracked foundation.
3. **The four-view information architecture.** Diagnosis, work, materials, upkeep is the right mental model. Keep the map; redraw the screens.
4. **Achats as working, persistent CRUD with live cost roll-up.** The one surface that already does what the whole app should do. It is the proof that editable, persisted, useful is achievable here.
5. **The seasonal maintenance concept.** Right idea, surfaced by current season. It needs recurrence to deliver on its promise, but the concept and the content are keepers.
6. **The shared `T` visual identity.** Corporate-dark, consistent with Palantír, disciplined. Refine for touch; do not replace.
7. **The Quebec-French domain language.** Correct, specific, and appropriate to the trades and the inspection. Preserve it.

---

## 7. Where this points (preview of the blueprint)

Stated as conclusions the blueprint must answer to:

1. **Move the content into Supabase first.** Migrate the 15 systems, 63 actions, 24 maintenance tasks, and 18 shopping items into editable, writable storage, with a snapshot taken before the app can ever write. This is the first brick, exactly as it was for Palantír 2.0. Nothing Karl asked for is possible while the catalogue is frozen in code.
2. **Add the missing primitives the execution loop needs.** A real date on actions, a "today" plan, a materials-to-action link, an append-only note/log, and light cost, contractor, and photo fields. These are what turn a catalogue into a tool you work from.
3. **Rebuild mobile-first, phone as the primary device.** A single-column shell, a bottom tab bar, large touch targets, no resize handles, no zoom slider, a card layout for Achats. Desktop becomes the bonus, not the baseline.
4. **Make "Today" the front door.** Landing on the app should answer "what am I doing today and what do I buy today," with one tap into a task's steps, order, and materials. The Dashboard's instinct was right; it needs dates and a plan to deliver on it.
5. **Add a near-zero-effort capture path, and let Claude help.** A quick-add that accepts plain text or voice, plus a Durin's Works skill so Karl can offload "log this, schedule that, I bought this" the way he does for Palantír. For a busy owner with no time to sit down, capture is the feature.
6. **Sequence so a phone-usable Today-plus-materials version ships early,** before the heavier additions (contractors, photos, cost reporting, maintenance recurrence). Karl should be able to use it on-site within the first one or two build sessions, not at the end.

End of audit.

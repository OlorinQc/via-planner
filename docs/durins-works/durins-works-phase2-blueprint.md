# Durin's Works: Phase 2 Blueprint and Build Roadmap

Prepared June 19, 2026. Locked after design review with Karl (mockup iterations in this Cowork session). Companion to `durins-works-phase1-audit.md`. This document defines the target product, the data model, the responsive design, and a staged build plan with ready-to-run session prompts. It is executed one session at a time, smallest-shippable-piece first.

---

## 1. The target product

Durin's Works becomes a plan-driven coordination tool for renovating 8235 Avenue Orégon, used on two devices for two jobs. On the **computer**, Karl plans: he opens the week calendar, drops work onto specific days, and batches the materials he needs into dated shopping runs. On the **phone**, on-site, he executes: he opens a project or a day, follows the checkable step-by-step plan for an action, sees the materials and the safety précautions, and marks progress as he goes. The expert inspection content stays underneath as the "why." The surface he lives in is a plan he drives, not a catalogue he reads.

Two non-negotiables learned in review: the app must be genuinely usable as a phone app and as a desktop web interface (not a stretched phone), and buying is first-class. A purchase is a scheduled task in its own right, batched onto a date as a shopping run, sitting on the calendar next to the work.

---

## 2. Design principles

1. **Two real layouts, one data model.** Phone is an app shell (bottom tab bar, single column, full-screen drill-downs). Desktop is a web interface (left sidebar, week calendar, side-by-side list and detail). Both read and write the same store. Responsive switch at a width breakpoint.
2. **Projects are the front door, Today is optional.** Karl does not always know his day in advance, so the app opens on Projets (or the Calendar on desktop). The "Today" view exists for when he has planned a day, and never assumes he has.
3. **Plan on the computer, execute on the phone.** Scheduling, calendar, and shopping-run batching are desktop-leaning. Step-by-step execution and quick capture are phone-leaning. Both work on both.
4. **Buying is a task.** Materials can be selected and assigned to a date, creating a shopping run that appears on the calendar and can be checked off as bought.
5. **Steps are checkable and expandable.** Each step is a one-line instruction you can tap to mark done (it grays out) and tap to expand into a fuller explanation. Steps carry their own materials and safety précautions.
6. **Content is data, not code.** The catalogue lives in the database, editable and writable. It is never frozen in source again.
7. **Capture is near-zero-effort.** Adding reality (a note, a purchase, a reschedule) takes one tap and a sentence, or a handoff to Claude.
8. **Safe writes.** Every write is version-guarded and snapshot-backed before the app can lose anything. The lesson Palantír paid for, inherited here.

---

## 3. Target data model

### 3.1 One versioned JSONB store plus snapshots

Single JSONB document, consistent with `planner_state`, far simpler than Palantír's normalized schema. It makes the materials-to-task link, the shopping runs, and the per-task log trivial because everything lives in one document, and snapshots are a one-row copy. Replaces the three current tables (which hold 0 statuses, 0 completions, and the 18 untouched seed rows).

```
durins_works_state
  id          int  primary key default 1     (single row)
  state       jsonb
  version     int  not null default 1          (optimistic concurrency)
  updated_at  timestamptz

durins_works_snapshots
  id          bigint primary key generated always as identity
  label       text
  state       jsonb
  created_at  timestamptz default now()
```

### 3.2 The document shape

```jsonc
{
  "meta": { "address": "8235, Avenue Orégon", "schemaVersion": 2 },

  "systems": [
    {
      "id": "s1", "name": "...", "zone": "...",
      "ceQueOnSait": "...", "pourquoi": "...",          // preserved verbatim
      "priority": "Urgent", "timing": "Été 2026",
      "source": "INSP-P17", "notes": "...",
      "actions": [
        {
          "id": "a1-1", "desc": "...",                   // the one-line summary
          "priority": "Urgent", "timing": "Été 2026",
          "scheduledDate": null,                          // ISO date, drives the calendar and Today
          "status": "À faire",
          "cautions": ["Couper l'électricité au panneau avant de commencer"],   // action-level safety
          "steps": [                                      // ordered, checkable, expandable
            { "id": "st1", "text": "Couper le disjoncteur", "detail": "Explication plus complète...",
              "material": "Testeur de tension", "caution": "Couper au panneau", "done": false }
          ],
          "materialIds": ["m12", "m13"],                  // rolls up from steps + extras
          "log": [{ "at": "2026-06-22T14:00Z", "text": "Maçon appelé, devis 1200" }],
          "cost": { "estimate": null, "actual": null, "quotes": [] },
          "contractor": null,
          "photos": [],
          "components": ["SITE-001"], "source": "INSP-P27", "notes": "..."
        }
      ]
    }
  ],

  "maintenance": [
    { "id": "M-01", "season": "Printemps", "zone": "...", "task": "...", "detail": "...",
      "notes": "...", "history": [{ "date": "2026-04-15" }] }    // recurrence, not a single done flag
  ],

  "materials": [
    { "id": "m1", "project": "Îlot de cuisine", "article": "...", "magasin": "IKEA",
      "prix_unitaire": 224, "qty": 2, "status": "En recherche", "lien": "...", "notes": "...",
      "bought": false }
  ],

  "buyRuns": [
    { "id": "r1", "date": "2026-06-20", "magasin": "Rona", "materialIds": ["m1","m6"], "done": false }
  ]
}
```

### 3.3 Derived surfaces (computed, never stored)

- **Today (work)**: actions where `scheduledDate <= today` and `status != Fait`.
- **Today (buy)**: shopping runs dated today, plus their materials.
- **Calendar week**: per day, the actions scheduled that day (work chips) and the shopping runs that day (cart chips).
- **Achats buckets**: "à planifier" (material in no run, not bought), "courses planifiées" (grouped by run date), "achetés", "tout".
- **Project materials**: union of `materialIds` across a project's actions.
- **Maintenance due**: tasks whose season is current and whose last `history` entry is not the current cycle.

### 3.4 Write safety

Read carries `version`. On save, update only where `id = 1 AND version = currentVersion`; on a 0-row result, reload, reapply, retry once. Take a `durins_works_snapshots` row before the first structural write of a session (and before any Claude or bulk write), keep the last 30. This kills the silent-clobber autosave that blocked Palantír.

### 3.5 Rejected alternative

Normalized tables (`dw_systems`, `dw_actions`, `dw_materials`, `dw_buy_runs`, ...). Rejected: data is tiny and single-user, joins buy nothing here while costing migration and write complexity. Revisit only if Durin's ever goes multi-property or multi-user.

---

## 4. Surfaces and navigation

### 4.1 Two shells

**Phone (app):** bottom tab bar (Projets, Aujourd'hui, Achats, Entretien), single column, detail screens push full-screen with a back affordance, large touch targets, 14 to 16px type, no zoom slider, no resize handles.

**Desktop (web):** left sidebar (Calendrier, Projets, Achats, Entretien), main pane plus a right detail pane for calendar and projects. The calendar is the natural desktop home for planning.

### 4.2 Projets (front door)

A list of the 15 systems as project cards (priority color, progress). Open one for its dashboard: context ("ce que l'on sait", "pourquoi"), the ordered actions to complete it, and the project's materials with a subtotal. Each action shows whether its plan is written ("Plan prêt", N étapes) or still to author ("Plan à venir").

### 4.3 Action plan

The execution screen. Header (desc, priority, schedule chip, status). A **Précautions** block (red) listing action-level safety notes. **Étapes**: an ordered list where each step is a one-line instruction with a number you tap to complete (grays and strikes it), tappable to expand a fuller explanation, and carrying its own material chip and caution chip. **Matériaux** rolled up with a subtotal and an add control. **Pourquoi** (system context). **Journal** (one-line append). **Coût** (estimate, actual, quotes). A **Planifier** control sets the action's date.

### 4.4 Calendrier (planning, desktop-leaning)

A week view. Each day shows work chips (blue or red by priority) and shopping-run chips (gold, cart icon, item count and total). An "à planifier" tray holds unscheduled work; pick a day to schedule it. Click a work chip to open its plan in the right pane; click a run chip to open its basket. A right-pane toggle switches between the selected item's detail and the week's shopping runs.

### 4.5 Achats (materials and shopping runs)

Time-phased and selectable. A filter row: "à planifier", "courses planifiées" (grouped by run date), "achetés", "tout". In "à planifier" you multi-select materials with checkboxes; a bottom bar shows the count and total with two actions: "mettre dans une course" (pick a date, which creates or extends a shopping run) and "marquer comme acheté". "Courses planifiées" lists each run by date with its basket, a per-item bought check, and a remove control. Everything groups by store so a run is one trip.

### 4.6 Aujourd'hui (optional)

Today's scheduled work and today's shopping run, nothing more. Empty by default; it fills as Karl plans. Never the forced front door.

### 4.7 Entretien (separate)

Seasonal recurring upkeep. No cost, no date. Grouped by season with the current season surfaced. Checking a task records it in `history` and it returns to due next cycle. Deliberately kept out of Today and out of the shopping flow.

---

## 5. Capture and Claude

Two near-zero-effort capture paths: an in-app quick-add (top-bar "+") that parses a short sentence into a material, a log entry, a schedule, or a buy assignment with a one-tap confirm; and a Durin's Works skill so Karl can tell Claude "log that the mason quoted 1200 and book the foundation for Thursday, and add a GFCI and a tester to Saturday's Rona run," and Claude reads the store, snapshots, applies the change under the version guard, and writes back. Daily driver is the deployed app (phone and desktop). Cowork and chat are for capture and development.

---

## 6. Build roadmap

Sequenced so a usable phone-and-web version lands by Session 4. Model per project convention: Opus for data-model and pattern-setting, Sonnet for mechanical build-out.

| Session | Goal | Ships | Model |
|---|---|---|---|
| 0 | Foundation: content into Supabase, safe writes, self-seed | Same UI, now editable and crash-safe | Opus |
| 1 | Responsive shells: phone app bar + desktop sidebar, reading from the store | App usable on a phone; real web layout on desktop | Opus |
| 2 | Scheduling + Calendar: `scheduledDate`, week view, Today | Plan work onto days | Opus |
| 3 | Action plans: checkable + expandable steps, cautions, materials link, authoring format | Follow a real plan on-site | Sonnet |
| 4 | Achats + shopping runs: time-phased buckets, select, assign to a date, mark bought | Buying as a scheduled task | Opus |
| 5 | Capture + Claude skill | Offload updates to a sentence | Opus |
| 6 | Records + polish: cost, contractor, photos, maintenance recurrence, snapshots view | The record layer; complete | Sonnet |

After Session 4, Karl has the product reviewed in the mockup.

---

## 7. Action-plan authoring format

The standard format for injecting a researched plan into an action, by hand or via Claude. Each action plan provides: a list of ordered steps (each a short instruction plus an optional fuller detail, an optional material, and an optional per-step caution), a list of action-level précautions, and the materials. Example, as Karl will dictate or paste:

```
ACTION: a7-4  Corriger les prises à risque (GFCI)
PRÉCAUTIONS:
  - Couper l'électricité au panneau avant tout travail
  - Confirmer l'absence de tension avec un testeur
ÉTAPES:
  1. Couper le disjoncteur du circuit
     detail: Mettre le bon disjoncteur à OFF; confirmer avec une lampe si non étiqueté.
     caution: Couper au panneau, pas seulement l'interrupteur
  2. Vérifier l'absence de tension à la prise
     material: Testeur de tension sans contact
  3. Installer la prise GFCI (LINE / LOAD respectés)
     material: Prise GFCI 15A
  4. Rétablir le courant et tester (test / reset)
MATÉRIAUX:
  - Prise GFCI 15A x2 (Rona, ~25$)
  - Testeur de tension sans contact (Canadian Tire, ~30$)
```

The Session 5 skill ingests this format, attaches the steps and materials to the action, links new materials, and writes back under the version guard.

---

## 8. Ready-to-run session prompts

Start each by loading the `palantir-dev` skill conventions (single-file React, the `T` token system, Supabase via `src/supabase.js`) and reading this blueprint plus the audit.

### Session 0: Foundation  (done in this session)

```
Create durins_works_state and durins_works_snapshots (RLS authenticated). Refactor
src/apps/Durin's Works/App.jsx so it loads the document from durins_works_state, self-seeds
it from the existing SYSTEMS/MAINTENANCE/SHOPPING_SEED constants on first run (mapped to the
section 3.2 shape), and saves the whole document with an optimistic version guard plus a
once-per-session snapshot. Keep the four current views rendering identically. Verify the
build compiles and the seed builder yields 15 systems, 63 actions, 24 maintenance, 18
materials.
```

### Session 1: Responsive shells

```
Read blueprint section 4.1. Replace the desktop split-pane shell with two responsive shells:
below ~820px a phone app (bottom tab bar Projets/Aujourd'hui/Achats/Entretien, single column,
full-screen push detail); above it a desktop web layout (left sidebar Calendrier/Projets/
Achats/Entretien, main + right detail pane). Remove the zoom slider and mouse-only resize
handles. Source all content from the store (section 3.2). Verify at 380px and 1200px.
```

### Session 2: Scheduling and Calendar

```
Read sections 3.3, 4.4, 4.6. Add scheduledDate to actions with a Planifier control
(Aujourd'hui / Demain / choisir une date). Build the desktop week Calendar with work chips
per day and an "à planifier" tray; clicking a day assigns. Build the optional Aujourd'hui
view. Verify scheduling persists and surfaces.
```

### Session 3: Action plans

```
Read sections 4.3 and 7. Build the action plan screen: action-level Précautions, ordered
steps that are checkable (tap number to toggle done) and expandable (tap text for detail),
each with optional material and caution chips, materials roll-up, and a journal line. Steps,
done state, and log persist. Implement the authoring format parser for paste.
```

### Session 4: Achats and shopping runs

```
Read section 4.5 and the buyRuns model. Build the time-phased Achats (à planifier / courses
planifiées / achetés / tout), multi-select with a bottom bar, "mettre dans une course" (pick
a date, create or extend a buyRun), and "marquer acheté". Render run chips on the Calendar
(gold, cart). Verify a run appears on its day and its basket checks off.
```

### Session 5: Capture and Claude skill

```
Read section 5. Add a top-bar quick-add that parses a sentence into a material, log, schedule,
or buy assignment. Author a Durin's Works skill (mirror the Palantir skill) that reads the
store, snapshots, applies log/schedule/buy/plan updates under the version guard, and writes
back. Document the update grammar and the section 7 authoring format in the skill.
```

### Session 6: Records and polish

```
Add cost (estimate/actual/quotes) and a light contractor field per action; photos via Supabase
storage; maintenance recurrence driven by history (last-done, next-due); a snapshots/restore
view. Polish empty states, the Hub tile, and the responsive breakpoints.
```

---

## 9. Open decisions (resolved)

All resolved to the recommended option: single versioned JSONB store; phone-keyboard dictation for voice (no custom build); photos in Session 6; a light contractor field per action; keep "Durin's Works" and `/durins-works`. Buying is modeled as a first-class shopping-run task (Karl's addition).

End of blueprint.

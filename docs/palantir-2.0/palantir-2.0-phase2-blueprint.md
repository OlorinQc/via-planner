# Palantír 2.0 — Phase 2 Redesign Blueprint

Prepared June 11, 2026, against the approved Phase 1 audit. Binding constraints carried forward: daily updates happen from the work-laptop claude.ai chat (connector confirmed read-write); Cowork is the build environment only; zero data loss with reversible migration; corporate-dark visual identity; no Tailwind, no UI libraries; Karl handles git.

---

## 1. Design goals, in priority order

1. **An update must cost under five minutes** from "notes exist" to "Palantír is current," from the work laptop, or the system dies again.
2. **No write path can lose data**, including the case where chat writes while a Palantír tab is open.
3. **The model matches the proven reality:** file → task spine, outputs optional, memory central, everything else lightweight.
4. **One hierarchy renderer.** The seven-renderer disease must be structurally impossible, not just avoided.
5. **Fewer, better surfaces.** Every screen earns its place or dies.

---

## 2. Target data architecture

### Decision A: the store

| Option | Description | Verdict |
|---|---|---|
| A1. Normalized tables (recommended) | One table per entity, row-level writes, FlexDates and similar shapes kept as JSONB columns inside rows | Solves concurrency, history, integrity, and chat-write safety at the root. Larger one-time migration, done once |
| A2. Versioned JSONB row + realtime | Keep the single row, add a version column and optimistic locking, subscribe to changes | Cheapest migration, but chat must still rewrite the whole 44 KB blob per update, conflicts resolve at whole-state granularity, and history/integrity stay unsolved. A patch, and we are done patching |
| A3. Inbox-only hybrid | Keep v1 as is, add a staging table chat writes to, app applies | Lowest risk, but preserves the two-step apply and the JSONB liabilities forever. Worth keeping as a fallback idea only |

**Recommendation: A1.** The state is 44 KB; the migration is small and fully verifiable. Normalization is what makes every other decision in this document simple instead of clever.

### 2.1 Schema (Supabase, all tables prefixed `pal_`)

IDs are `text` primary keys defaulting to `gen_random_uuid()::text`, so existing IDs (`p19`, `p8043`, `p1778885900xxx`) migrate unchanged and the `uid()` scheme dies. All tables get RLS (authenticated user) matching current `palantir_state` policy, `created_at`/`updated_at` with a shared trigger, and Supabase Realtime enabled.

```
pal_people        id, name, title, active
pal_campaigns     id, title, status, notes                  -- C3, schema now, UI later
pal_files         id, title, status, priority, sensitivity,
                  lead_id → pal_people, campaign_id → pal_campaigns (null),
                  memory (text, HTML as today), archived, archived_at,
                  created_at, updated_at
pal_outputs       id, file_id → pal_files, title, type, status,
                  owner_id → pal_people, due jsonb (FlexDate),
                  publication jsonb (FlexDate), approval_status,
                  sharepoint_url, notes, sort_order (float)
pal_tasks         id, file_id → pal_files (null), output_id → pal_outputs (null),
                  title, status, due jsonb (FlexDate, normalized on migration),
                  assignee_ids text[], depends_on text[],
                  notes, gate, source, sort_order (float),
                  completed_at, created_at, updated_at
pal_flags         id, file_id → pal_files, kind ('risk'|'question'|'blocker'),
                  text, owner_id, status ('open'|'resolved'|'dropped'),
                  resolution, created_at, resolved_at
pal_links         id, file_id → pal_files, label, url, type, created_at
pal_events        id, file_id (null), entity ('file'|'task'|'output'|'flag'|...),
                  entity_id, kind ('log'|'create'|'update'|'complete'|'import'...),
                  summary (prose), actor ('karl'|'claude'), payload jsonb,
                  package_id (null), created_at
palantir_snapshots  unchanged (kept as is, same restore semantics)
palantir_state      kept frozen post-cutover as the v1 fallback, never deleted
```

Notes on deliberate choices:

- **`pal_outputs` replaces `deliverables`**, renamed to what it is. Tasks reference an output optionally; `file_id` stays mandatory on tasks (the audit's 86% case is the first-class case). Milestones are gone: a dated output or a dated task covers every one of the 5 that exist.
- **`pal_flags` absorbs risks and open questions** into one lightweight primitive (9 combined uses did not justify two heavyweight object types). `kind` keeps them distinguishable; a blocker flag can also replace the freetext `gate` over time.
- **`pal_events` is both the change log and the file Log.** Hand-written log entries become `kind='log'` events with prose summaries (the skill's accountability style survives intact). Writes from the apply function record events automatically, so history accrues even when nobody writes prose. The Activity surface and the file History section are two filters over one table.
- **`sort_order` floats replace all order arrays** (`taskIds`, `standaloneTaskOrder`, `deliverableOrder`). Reordering writes one row. The union-dedupe reconciliation idiom dies.
- **FlexDate stays exactly as it is, as JSONB.** Migration normalizes legacy string due-dates into `{precision:'exact', date, confidence:'confirmed'}` so a date is one shape everywhere and `taskDateStr` dual-type guards die.
- **Memory stays HTML** in this migration. Converting to markdown is a candidate later; transforming user content during a structural migration is risk we do not need.
- **uiPrefs** move to a tiny `pal_prefs` key/value table or localStorage; they are cosmetic and excluded from fidelity checks.

### 2.2 Server-side functions (the safety core)

Three Postgres functions, deployed before anything else, used by both the app and chat:

- **`pal_export_state() → jsonb`** rebuilds the v1 JSONB shape from the tables. Used for snapshot payloads, the fidelity proof during migration, and JSON download. The old format lives on as the interchange and backup format.
- **`pal_snapshot(label text, trigger text)`** inserts `pal_export_state()` into `palantir_snapshots`. One snapshot path for every writer.
- **`pal_apply_update(package jsonb) → jsonb`** the heart of the new update loop. In one transaction: validates the package against a whitelist of operations and fields, takes a snapshot, applies the changes, writes one `pal_events` row per change plus one import event, and returns a structured result (applied, skipped, warnings). A unique `package_id` inside the package makes re-applies no-ops: **idempotent by construction**, which the May 20 double-apply proved v1 is not. Matching is by ID with title fallback retained but reported in warnings.

The package format is the v1 import JSON, evolved: the same verb structure (`tasksToComplete`, `tasksToCreate`, `memoryUpdates`, `flagsToCreate`...) plus the verbs real sessions proved missing (`tasksToDelete`, `filesToMerge`, renames, relinking), and a per-item result report so nothing fails silently. Everything the skill knows survives; only the delivery mechanism changes. See 3.1b for the transcript evidence behind each addition.

### Decision B: how chat writes

| Option | Description | Verdict |
|---|---|---|
| B1. `pal_apply_update` RPC (recommended) | Skill builds the same reviewed package as today, then executes `SELECT pal_apply_update('{...}')` through the connector | One audited, validated, idempotent, transactional code path. Snapshot guaranteed. The package is stored in events, so every import is inspectable and attributable forever |
| B2. Raw SQL writes by the skill | Skill emits INSERT/UPDATE statements directly | Maximum flexibility, no function to maintain, but every update is a new hand-written transaction with no validation, no idempotency, and snapshot discipline enforced only by prompt. One bad WHERE clause away from disaster |
| B3. Inbox staging table | Chat inserts the package into `pal_inbox`; Palantír shows "1 pending update," Karl clicks apply | Safest-feeling, but reintroduces a second step and requires opening the app to complete an update. Keep as the documented fallback if connector write access is ever revoked at work |

**Recommendation: B1.** It keeps the skill's editorial protocol, removes both copy-paste hops and the Import screen, and concentrates all write risk into one tested function. Raw connector SQL (B2) stays available for one-off surgical fixes from Cowork, as today.

### 2.3 Concurrency model (the audit's first brick)

- The app performs **row-level writes only** (update one task, one file column), so an open tab can no longer clobber the world. The 800 ms whole-state debounce dies with the single row.
- The app **subscribes to Realtime** on the `pal_` tables and merges incoming changes into the store. When chat applies an update at work, an open Palantír tab reflects it within seconds, with a toast ("Claude applied 12 changes, view in Activity").
- Snapshots cover the remaining restore cases. With row-level writes plus an event trail, restores should become rare instead of load-bearing.

---

## 3. The new update loop

The daily flow, work laptop, end to end:

1. Karl pastes meeting notes into the claude.ai chat (skill v2 triggers as today).
2. Claude reads live state through the connector, targeted to the files mentioned.
3. Claude presents **one consolidated diff**, grouped by file, compact: completions, creations, date changes, memory deltas, flags. Questions only where genuinely ambiguous (the v1 skill's safety rules carry over verbatim).
4. Karl replies once with corrections ("all good except the Dorval date is the 17th").
5. Claude runs `pal_apply_update(...)`. Snapshot, apply, events, all in one transaction. It reads back and confirms: "Applied: 9 completions, 4 tasks, 2 memory updates. Snapshot #14 taken."

Steps 6 through 10 of the v1 pipeline no longer exist. Estimated cost: **3 to 5 minutes**, against 20 to 40 today.

### 3.1b What the real updates look like (from Karl's actual work-chat transcripts)

Review of four real update conversations (May 20, May 22, May 27, June 8) revealed facts that reshape the design:

1. **The primary notes format is Palantír's own Meeting Prep export, annotated.** Karl exports the file → output → task tree, edits it inline during the week (DONE, NEW DATE, NEW for KARL, TRANSFORM FILE INTO "FIFA", MERGE THIS FILE WITH "LDRR"), and pastes it back. The update is not a foreign document to parse; it is **a diff against a baseline Palantír itself produced.** Design consequence: the Team surface export gets two flavors. "Share" (clean, for the room, as today) and **"Working copy," which embeds a short stable ref per line (file, output, task)**. When the annotated working copy comes back, DONE markers carry exact refs and the matching ambiguity that consumed whole exchanges (three tasks sharing ID p8001, "which task is it?", IDs inferred from sequence position) disappears.
2. **Secondary formats must keep working:** structured meeting summaries from transcription tools (Name, action, TBD), uploaded docx team documents, and raw voice-dictation transcripts with transcription noise. The skill's parsing layer stays format-tolerant; only the primary path gets the ref-code fast lane.
3. **The package needs verbs v1 never had.** Real sessions required: deleting duplicate tasks ("delete manually in the UI" appeared in warnings twice), merging one file into another (LDRR), renaming files, and linking existing tasks to a file or output. v2 `pal_apply_update` supports `tasksToDelete`, `filesToMerge` (reassign children, write events, archive source), `rename`, and `tasksToUpdate` with link changes, all snapshot-protected.
4. **Silent no-ops are a proven failure mode.** `peopleToCreate` was silently ignored before it was wired; a structurally wrong package produced "no recognised changes" with no detail. The RPC therefore returns a **per-item result** (applied, skipped with reason, warning), and the skill reads it back and reports it. Nothing is allowed to fail silently.
5. **Date discipline is a standing rule, not a one-off.** Karl had to commission a "date audit" (28 backfilled due dates) and then patched the skill himself: dates go on the task as FlexDates AND as memory bullets, and missing intermediate dates get reverse-engineered from delivery anchors (publish → approval → review → draft). Note: that patch lives only in the work-chat copy of the skill; the Cowork copy never got it. Skill v2 makes the date-discipline rules canonical, and skill distribution becomes single-source so the two environments cannot drift again.
6. **The numbered-questions confirm pattern works.** Karl answers like "1 assign, 2 update, 3 completed, 4 still under review, 5 create confirmed." The consolidated diff ends with a numbered question list; one reply resolves everything.

**Skill v2** ships alongside: same parsing rules, markers, and writing rules; new sections add the RPC protocol, the working-copy ref-code fast lane, the date-discipline rules from May 21, dedupe-before-create checks (flag similar existing tasks instead of creating doubles, as the APA duplicate pairs demanded), and read-back verification. The missing `schema.md` and `update-package.md` get written for real this time, against the new schema.

**The Import screen is deleted.** Its replacement is the Activity surface (section 4), where every applied package is listed with its full content, actor, timestamp, and a restore point.

---

## 4. Information architecture and UI direction

### Decision C: the surfaces

| Option | Description | Verdict |
|---|---|---|
| C1. Four surfaces (recommended) | Today, Files, Team, Activity | Each surface answers one question a director actually asks. Calendar and Templates die as top-level views; Meeting Prep is promoted into Team |
| C2. Keep current six views, share the renderer | Minimal IA change, fix only the code duplication | Cheaper, but preserves three views of the same task list and a top-level Templates view that produced 4 tasks ever |
| C3. Two surfaces (Today + Files) | Ultra-minimal | Attractive, but burying the people/meeting pivot inside Files undervalues the director's actual weekly rhythm |

**Recommendation: C1.** Four surfaces, one shared hierarchy component, URL-routed.

### 4.1 The four surfaces

**Today** (default, route `/palantir/today`)
The morning cockpit. Left: Overdue / Today / Next 3 days / No date task groups (current TodayView, rebuilt on the shared renderer), with the No-date group capped and prompting triage. Right rail: urgent files (derived, as now), open blocker flags across all files, stale-file alerts ("8 files untouched 14+ days"), and the latest Activity entries ("Claude applied 12 changes yesterday"). The compressed week strip from the current weekly calendar lives at the top; the two-month grid dies (Decision D below).

**Files** (route `/palantir/files`, deep-linkable `/palantir/files/:id`)
The portfolio and the dossier. List pane as today (priority groups, staleness chips) with three fixes: search covers tasks, outputs, memory text, and flags, not just titles; Monitoring is visible by default alongside Active; the empty right pane becomes a portfolio digest instead of "select a file." The file page is restructured around proven usage: **Memory** on top (rich editor, latestUpdate field deleted), then **Work** (outputs as collapsible sections with their tasks, then file tasks as equal citizens, not "standalone" leftovers; one-click add-task as the primary action), then **Flags**, **Links**, **History** (events for this file, hand log entries plus generated ones, one stream).

**Team** (route `/palantir/team`)
The People kanban (rebuilt on the shared renderer, fixing the co-assignee drop bug) plus **Meeting mode**: the current Meeting Prep tree as a live, person-filterable surface rather than a modal, with inline check-off during the meeting and two export flavors. "Share" is the clean rich-text/print export as today. "Working copy" embeds short stable refs per line; it is the document Karl annotates through the week and pastes into the work chat, making the weekly update nearly deterministic. This surface is the start and the end of the real update loop the transcripts revealed, which is the strongest argument for its promotion from modal to place.

**Activity** (route `/palantir/activity`)
The event stream (filterable by file, actor, kind), applied packages with full content, snapshot list with preview and restore (absorbing the Snapshots modal), and JSON export. This surface replaces the Claude view, the Import screen, and the Snapshots modal, and it is where trust in the automated write path is built and verified.

Templates become an action inside output creation ("apply workflow"), not a view. Settings (type lists), Team roster: small modals, as now.

### Decision D: the calendar

| Option | Verdict |
|---|---|
| D1. Week strip on Today, monthly grid deleted (recommended) | The weekly view is the only calendar mode dense enough to read; FlexDates (week-of, month, TBD) mostly cannot render on day grids anyway |
| D2. Keep both modes | Carries the 7px two-month heatmap forward for sentiment, not use |
| D3. Per-file timeline later | A horizon view of outputs by FlexDate is a genuinely good future idea; out of scope for 2.0 |

### 4.2 Visual direction

Evolution, not replacement. The `T` token family, corporate-dark surfaces, chips and dots all stay. Changes: the type scale collapses from nine sizes to five (10/11/12/13/15), nothing below 10px ever; the CSS `zoom` hack is replaced by rem-based scaling driven by the same slider; Cinzel remains only for the wordmark; chip semantics get one rule (status = dot, priority = bar, dates = chip) so color stops carrying four meanings at once. Accent color: unchanged (`#5b9cf6`). If you want to revisit it I will show 2 or 3 options on the mockups, per standing rule, but nothing in the audit argues for a change.

Mockups: on blueprint approval I will produce quick static HTML mockups of Today, the file page, and Team/Meeting mode before any React is written, so you judge the IA on pixels, not prose.

### 4.2b Interaction standard (binding, consolidated June 12 after mockup validation)

These patterns were validated with Karl on the interactive mockup and are build requirements, not suggestions. Any new surface or element must answer to them.

**The affordance trio.** One floating pill on hover (📅 date, @ person, ↳ output where outputs exist), overlaying the row's right edge, never shifting content. 📅 opens the mini calendar; @ opens the initials strip; ↳ opens the file's outputs. The same three buttons sit at hand on every capture line.

**The mini calendar IS the date picker, app-wide.** It replaces v1's FlexDateInput everywhere, including the task and output panels: month grid with shortcuts row (Today / Tmrw / next Mon / TBD), a `w/o` button on each week row for week-of precision, `m/o` beside the month name for month-of precision, and a small tentative/confirmed toggle carrying FlexDate confidence. One picker, every date in the app, exact or flexible.

**Chip composer on every capture line.** Picked or typed values render as removable chips (file, ↳ output, @ person, date, flag kind); only the title is free text. Typed grammar tokens (`@wa`, `w/o jun 15`, `>output:`, `Q:`) parse live into the same chips and remain the keyboard fast lane only; nothing is ever required to be memorized. The flag composer's kinds (Q / Risk / Blocked) are clickable chips too. Backspace on an empty title deletes the last chip. Exemption: the History prose composer takes no tokens by design.

**Drag wherever a hierarchy or date exists.** The complete matrix: Today list → week strip day; day → day across both weeks; within-day live reorder; Today group reorder. File page: task reorder, task ↔ output (both directions), task → file card in the list to re-file, **output headers drag to reorder**, and **file cards drag between priority groups to set priority**. Team Board: card person → person (additive by default, "Replace instead" on the toast), batch drag, drop on column headers. **Meeting tree: tasks drag into, between, and out of outputs**, same engine. All drops are one row write.

**One selection model, one batch bar.** Click-to-select on every row type; the floating bar offers 📅 (mini calendar), **@ (batch reassign, a gap closed in this pass)**, ✓ Done, context actions (link to output on the file page), and clear. Esc clears everywhere.

**Undo over confirm, no exceptions.** Every destructive or bulk action (complete, delete, archive, restore, batch ops) acts immediately and offers Undo on the toast for 8 seconds, backed by events and snapshots. `window.confirm` does not exist in 2.0.

**Keyboard floor.** Ctrl+K palette (whose result actions use the same 📅/@ popovers, not bespoke buttons), `n` captures in context, space completes the focused row, Esc clears. Nothing more until usage asks for it.

**Gaps this consolidation closed** (now in scope for the build): output headers get 📅 (due and publication) and @ (owner) on hover; flag rows get @ owner and ✓ resolve on hover; batch bar gains @; output reordering by drag; file-card priority by drag; palette actions unified on the popovers; tentative/confirmed toggle on the calendar; Add File modal uses the chip composer for lead and priority.

### 4.3 Code structure

```
src/apps/Palantir/
  App.jsx            thin shell: routes, nav, providers
  theme.js           T, ss, status maps, type scale
  data/
    client.js        supabase calls, one module per entity
    store.jsx        context: state, actions, realtime subscription
    derive.js        ALL selectors: fileTree, urgency, date buckets, person pivot
    flexdate.js      FlexDate make/format/compare (single home)
  components/        Chip, StatusDot, FlexDateInput, HierarchyList,
                     SidePanel (one nav-stack implementation), Editor
  views/             Today.jsx, Files.jsx, FilePage.jsx, Team.jsx, Activity.jsx
  modals/            Settings, Roster
```

Rules that make the disease structurally impossible: views may not group or filter entities themselves, only call `derive.js`; the file → output → task tree renders only through `HierarchyList`; the side-panel stack exists once; all date math goes through `flexdate.js`. Inline JSX styling stays (no CSS framework), but tokens and shared style objects live in `theme.js` only. React Router sub-routes give deep-linking and make the deferred mobile route (C5) a styling exercise later instead of an architecture change.

What dies in code: `migrateFromPlanner`, the sensitivity migration, `fileId||projectId`, `dependsOn`/`dependencies` duality, legacy status strings, FH map, `latestUpdate`, `uid()`, the paste UI, the Templates view, `document.execCommand` (replaced by a minimal contenteditable wrapper or, later, markdown).

---

## 5. Migration plan

Zero data loss, every step reversible, the live app never broken. `palantir_state` is never deleted, and v1 keeps running on it until the final step.

| Step | What | Reversal | Proof of safety |
|---|---|---|---|
| M0 | Manual snapshot + JSON download archived locally | n/a | Belt and braces before anything |
| M1 | Create `pal_` tables, triggers, RLS, Realtime, and the three functions. Purely additive | `DROP` the new objects | v1 untouched, does not know they exist |
| M2 | Run the migration script: copy JSONB → tables (IDs preserved, string dates normalized to FlexDate, risks+questions → flags, log → events, order arrays → sort_order) | `TRUNCATE pal_` tables and rerun | **Fidelity gate:** `pal_export_state()` output compared against the live row semantically (entity counts, every ID present, field-level spot checks). Script is rerunnable: refresh anytime v1 changes |
| M3 | Build v2 app at `/palantir2` reading the tables. v1 at `/palantir` remains canonical; M2 rerun syncs v2 before each session | Ignore `/palantir2` | Two apps, one writer (v1), no divergence risk |
| M4 | Editing parity reached in v2. **Cutover:** final M2 sync, route swap (`/palantir` → v2, `/palantir/legacy` → v1 read-only against the frozen row) | Swap routes back, tables stay synced via export | Frozen v1 row + snapshot taken at cutover |
| M5 | Skill v2 goes live in work chat (RPC apply). Old skill retired | Re-enable old skill; v1 import path still exists in legacy | First real updates verified in Activity |
| M6 | After 2+ weeks of stable use: remove legacy route and dead code. `palantir_state` row stays in the DB permanently as the archived v1 state | Restore from any snapshot | Cold storage, costs nothing |

---

## 6. Build plan, sized for Cowork sessions

Each session: bounded objective, post-build verification, git commands handed to you one chained line at a time. Order chosen so the update loop, your top priority, is live by Session 3 even before the UI rebuild finishes.

| Session | Objective | Ships |
|---|---|---|
| 1 | **Foundation.** M0, M1, M2: tables, functions, migration script, fidelity proof | New schema populated and verified; v1 untouched |
| 2 | **The write path.** `pal_apply_update` hardening (validation, idempotency tests), skill v2 written (with real schema.md and update-package.md), tested end to end from this Cowork session simulating chat | A working apply pipeline |
| 3 | **Go live on updates.** You run the first real update from your work chat; we verify in SQL and in Activity-precursor queries; M2 resync procedure documented | **The 5-minute update loop is live**, while v1 remains the viewing app |
| 4 | **App scaffold.** Multi-file structure, theme, data layer, store + Realtime, Files + file page read-only at `/palantir2` | v2 readable |
| 5 | **Editing parity.** File page and task/output/flag editing, row-level writes, side panel | v2 usable as daily driver |
| 6 | **Today + Activity.** Cockpit, event stream, snapshots UI. Cutover (M4) | v2 is Palantír |
| 7 | **Team.** People pivot + Meeting mode with exports | The promoted jewel |
| 8 | **Sweep.** Type scale, week strip, legacy removal (M6), C5 mobile groundwork check | Done |

Sessions 4 through 7 each end with the app deployable and unbroken. If energy or usage limits bite, the system is in a stable, improved state after any session from 3 onward.

---

## 7. Risks and open questions

- **Connector permissions at work.** Confirmed read-write today; if IT ever tightens it, fallback B3 (inbox table) is a one-session retrofit on top of the same `pal_apply_update` function.
- **RLS vs connector.** The chat connector writes outside the app's authenticated session. Session 1 must verify the function's SECURITY DEFINER setup so chat and app both pass policy. Tested in Session 2 before anything depends on it.
- **Realtime free-tier limits.** Five tables, one user: comfortably inside limits, but verified in Session 4.
- **Memory HTML.** Carried as is; a later markdown migration is optional and independent.
- **Skill drift across environments.** The work-chat skill and the Cowork skill have already diverged (the May 21 date-discipline patch exists only at work). Skill v2 needs one canonical source and a stated update procedure, or the two copies will diverge again.
- **Meeting rhythm primitive: largely resolved by the transcripts.** Karl's cadence is meeting-driven (May 20, 22, 27, June 3) and every applied package now records an event with date and source. A "last discussed" stamp per file can be derived from import events rather than maintained by hand. A working-copy export header naming the meeting date covers the rest. No new primitive needed unless use proves otherwise.

End of blueprint.

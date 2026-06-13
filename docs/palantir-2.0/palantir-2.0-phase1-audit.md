# Palantír 1.x — Phase 1 System Audit

Prepared June 11, 2026. Evidence base: full read of `src/apps/Palantir/App.jsx` (2,739 lines), live Supabase state (`palantir_state` id=1), `palantir_snapshots` history, both Palantír skills, platform files (`main.jsx`, `Hub.jsx`, `Hub.css`, `supabase.js`, Durin's Works), and project memory.

---

## 0. Verdict

Palantír 1.x is a well-crafted single-user tool whose core loop is failing. The craftsmanship is real: the snapshot discipline, the FlexibleDate model, derived urgency, and Meeting Prep are better than what commercial tools offer for this job. But the system is built around an update pipeline that costs so much per use that it stopped being used, and a three-level data model that the data itself shows is mostly a two-level reality. The code has grown to the point where the dominant cost of every change is re-reading and re-synchronizing seven hand-copied renderers.

The one-sentence diagnosis: **Palantír is an excellent read surface attached to a failed write path.**

Three findings dominate everything else:

1. **The update loop has effectively collapsed.** Eight imports between May 15 and 27, one since. 29 of 46 files untouched in over two weeks. A status tool that is two weeks stale is not a status tool; it is a liability, because it looks authoritative and is wrong.
2. **The deliverable layer failed in practice, not in concept.** 15 deliverables ever created against 46 files and 208 tasks; 86% of tasks bypass it. Yet deliverables are the actual unit of corporate communications work. The implementation made them optional, high-friction, and forced; the data shows people (Karl, and Claude-as-importer) routed around them.
3. **Any fix to the update loop is blocked by the save architecture.** The app debounce-upserts the entire state row with no version check. Direct writes from a Cowork session, the most promising friction killer, would be silently clobbered by an open tab. This must be solved first or every other improvement sits behind a data-loss risk.

---

## 1. The numbers

| Metric | Value | Reading |
|---|---|---|
| Files | 46 (33 active, 9 monitoring, 1 paused, 3 completed, 1 archived) | "Active" covers 72%: status does not discriminate |
| Files at medium priority | 39 of 46 | Priority does not discriminate either |
| Tasks | 208 (100 done, 95 not started, 12 in progress, 1 waiting) | Completion flows when imports flow |
| Tasks linked to a deliverable | 29 (14%) | The middle layer is bypassed |
| Tasks created by Claude import | 133 (64%) | The import pipe is the real data entry |
| Tasks created from templates | 4, from 9 built-in templates | Template system is dead weight |
| Tasks created via paste | 0 | Paste UI is dead weight |
| Deliverables | 15 total | Several are actually decisions or discussions |
| Milestones / risks / open questions | 5 / 2 / 7 across 46 files | Primitives exist but are not used |
| `latestUpdate` field usage | 0 | Dead field |
| Files with memory | 45 of 46 | Memory is the loved primitive |
| Log entries | 40, concentrated in 17 files | History accrues only where imports touched |
| Imports May 15–27 | 8 | Cadence: every ~2 days |
| Imports May 28 – June 11 | 1 | Cadence: collapsed |
| Files untouched since before May 25 | 29 of 46 | Two-thirds of the system is stale |
| Total state size | 44 KB | Scale is not, and never will be, the problem |

---

## 2. System and data model

### 2.1 Does file → deliverable → task match the work?

Partially, and the mismatch is instructive.

**What corporate communications work actually looks like:** a portfolio of ongoing dossiers (files: correct primitive, well chosen), each of which periodically produces concrete outputs (press release, Q&A, board document) through a known workflow (draft, validate, approve, publish), surrounded by a constant stream of small actions, conversations, decisions, and waiting-on-others states that belong to the dossier but not to any output.

**Where the model fights reality:**

- **Most day-to-day items are not steps toward a deliverable.** "Strategy review with Mathieu," "confirm date with Geneviève," "follow up with Amtrak" are file-level actions. The model handles this (standalone tasks), and the data confirms it is the dominant case (86%). The problem is the inverse: the model treats deliverables as the organizing layer, and the UI nests everything under them, so the dominant case renders as the leftover case ("Standalone tasks" below the deliverable list).
- **The deliverable object is doing four jobs**: a real output with a lifecycle (press release), a workflow container for template tasks, a grouping header in views, and, in practice, a place to put things that have no primitive ("Go/No go sur la relance du rapport" is a decision, "Discuss with Denis Boucher the approach" is a conversation). When users stuff a model, the model is missing a primitive, not the users.
- **No primitive for the recurring weekly rhythm.** Karl's actual cadence is the team meeting: per person, per file, what moved, what is next. Meeting Prep reconstructs this read-only at export time, and the People view approximates it, but nothing in the model captures "discussed June 10, next check-in June 17."
- **People are strings.** `lead`, `assignees`, `ownerName` are all name strings matched by equality, with a parallel `people` array that has IDs nobody references. `isMyTask` hardcodes the string "Karl". Renaming a person required raw SQL string replacement over the JSONB (documented in memory). This is the weakest integrity point in the model.

### 2.2 Primitive scorecard

| Primitive | Verdict | Evidence |
|---|---|---|
| File | **Keep.** The correct unit. | 46 in use, memory on 45 |
| Memory (current truth) | **Keep.** The most-loved field in the app. | 45 of 46 files |
| Log (append-only history) | **Keep, but generate it.** Hand-written logs stall when imports stall. | 40 entries, 17 files, none since June 3 |
| Task | **Keep.** | 208, healthy completion |
| Deliverable | **Rethink.** Right concept, wrong mechanics. | 15 ever, 14% task linkage, semantic abuse |
| Milestones | **Fold in or drop.** Duplicates dated tasks/deliverable dates. | 5 total |
| Risks | **Fold into a lighter concept.** A full severity/status/owner object for 2 uses. | 2 total |
| Open questions | **Keep the idea, lighten the object.** Questions are real comms currency; the form is too heavy. | 7 total |
| `latestUpdate` | **Delete.** | 0 uses |
| `health` | **Already replaced** by derived urgency. Delete remnants. | Dead code in FH map |
| Templates | **Demote drastically.** 9 templates, 4 tasks ever. | Near zero use |
| SharePoint links | **Keep.** Quietly useful. | 8 files |
| Sensitivity | **Questionable.** Set on creation, never surfaced anywhere that matters. | Display-only chip |

### 2.3 The single JSONB row

At 44 KB the row is trivially small; queryability via `jsonb_array_elements` works fine for the skill. The real liabilities, in order:

1. **Concurrency.** Last-write-wins from any open tab, 800 ms after any change, no version stamp, no conflict detection. Two writers (a second tab, a Cowork session, a future mobile route) silently destroy each other's work. This is not hypothetical; it is the documented blocker for the entire "direct write" family of update-loop fixes.
2. **No history below the snapshot level.** You cannot ask "when did this task change status" or "what did Claude's June 8 import touch." Snapshots give restore points, not diffs.
3. **No integrity.** Orphaned `deliverableId`s after deletion are patched in app code; order arrays (`dv.taskIds`, `standaloneTaskOrder`, `deliverableOrder`) can hold dead IDs; nothing enforces that a task's file exists.
4. **All-or-nothing writes.** Every keystroke-blur ships the whole world. A network failure mid-save risks the whole world.

The single row is not sacred and should not survive Phase 2 as the primary store. It is, however, a perfectly good **format**: the right migration treats the current row as the export/snapshot/interchange shape while moving live data to a handful of real tables.

### 2.4 IDs

Three generations coexist (`p01`, `p8043`, `p1778885900xxx`). The `uid()` bump-past-max repair pushed the counter to ~1.778 trillion after a `Date.now()` ID escaped from DeliverablePanel. Cosmetic today, but the scheme (module-level counter, digits-only parse, per-session) is structurally collision-prone and was the root cause of Bug 4. Real IDs (UUIDs or DB-generated) come free with real tables.

---

## 3. The update loop

### 3.1 The pipeline, costed

Current loop, with the friction at each step:

| # | Step | Cost |
|---|---|---|
| 1 | Karl edits his notes document between meetings | Genuine work, stays in any design |
| 2 | Open a Claude chat, invoke the skill, paste notes | Context switch, setup overhead |
| 3 | Claude reads live state via SQL | Automated, fine |
| 4 | File-by-file walk-through with confirmations | The protocol itself multiplies turns: per-file proposals, up to 2 questions each. Conscientious, and expensive |
| 5 | Claude emits the JSON package | Automated |
| 6 | Karl copies JSON | Manual, error-prone |
| 7 | Open Palantír, navigate to the Claude view | Second context switch |
| 8 | Paste, validate, preview | Preview shows **counts, not contents** ("18 task(s) completed" without naming them), so the careful walk-through in step 4 is the only real review |
| 9 | Apply | Not idempotent: snapshots 2 and 3 prove a double-apply happened May 20 |
| 10 | Verify in the UI | Manual spot-checking |

Ten stages, two applications, two manual copy-paste hops, and a review protocol that does the same diff review twice (once conversationally, once as counts). Estimated 20 to 40 minutes per real session based on the snapshot labels (the May 27 import alone: 18 completions, 9 creations, renames, merges, links).

### 3.2 The behavioral evidence

The cost shows up exactly the way friction always does: **batching, then abandonment.** Import sizes grew (May 15: small corrections; May 22: team-wide batch; May 27: 27+ changes) as updates were saved up to amortize session overhead. Then the batches stopped. The system's freshness now depends on willpower against a 30-minute chore, and willpower lost.

A detail worth naming: the Claude view contains a 5-step instruction card explaining this workflow to its only user. **An app that needs to document its own update procedure on the update screen is confessing.**

### 3.3 What is removable

**Environment constraint (binding):** the daily update loop runs from Karl's work laptop, which has claude.ai chat with the Supabase connector and the Palantír web app, and nothing else. No Cowork, no local tooling. Cowork is the development environment only. Every option below must work from chat plus the browser.

Working backwards from "Karl finished a meeting and the notes exist":

- **Steps 6–9 (copy, switch, paste, apply) are eliminable from chat.** The work-laptop chat already reads Supabase through the connector; the skill depends on it. If the connector permits writes (to be verified), the same chat session can apply the reviewed changes directly, snapshot first, and "produce JSON, copy, switch apps, paste, apply" disappears. If the connector is read-only, two chat-compatible fallbacks exist: a Supabase RPC/edge function the connector can call, or a low-risk staging pattern where chat writes only to a `palantir_inbox` table and Palantír shows "1 pending update, review and apply" (one click instead of copy-paste-validate-apply). Either way the clobbering autosave (3.4) must be fixed first.
- **Step 4 is compressible.** The file-by-file interrogation exists because mistakes were expensive and invisible. With a real, content-level diff preview (in chat or in app) and instant snapshot/undo, the review can be one consolidated pass: "here are the 12 changes, flag any wrong ones."
- **Step 2 is reducible.** A standing entry point (a scheduled session, a pinned conversation, or quick-capture inside Palantír that accepts raw note text and stages changes) removes setup overhead.
- **Step 1 is the interesting question for Phase 2.** The notes document is currently the true write surface and Palantír is a downstream copy, which is exactly why Palantír drifts. Either the notes stay canonical and syncing becomes near-zero-cost, or Palantír becomes pleasant enough to be the primary capture surface and the notes shrink. Designing for both at once is how the current system got here.

### 3.4 The hidden blocker, stated precisely

`App.jsx` line ~2613: on any `data` change, after 800 ms, `upsert({id:1, state:data})`. No `updated_at` precondition, no version column, no realtime subscription. Consequences:

- A Cowork session writing `palantir_state` while a tab is open loses its write on Karl's next interaction (or even on a stray pending debounce).
- Two tabs destroy each other invisibly.
- The import apply path mutates React state and lets the same debounced save persist it, which is why a double-click or re-render double-applied on May 20.

Every update-loop option in Phase 2 (direct writes, conversational updates, quick capture, mobile) routes through fixing this. It is the first brick.

---

## 4. UI and UX

### 4.1 Navigation model

Five top-level views (Files, My Work, Calendar, People, Templates) plus a Claude view styled as a sixth, plus four modals (Settings, Meeting Prep, Team, Snapshots). Problems:

- **Three of the six views render the same my-tasks data** (My Work's Today, Board, and List are modes; fine) but Calendar and People also re-render the same hierarchy with the same side panels. The app has effectively one content type and six bespoke presentations of it.
- **Templates does not deserve top-level navigation** (4 tasks ever). The Claude view, the actual lifeline of the system, is a small button on the right.
- **No global search.** Search exists only in Files and only over title/lead. A director's most common question, "where is the thing about X," has no answer surface.
- **No URL state.** Everything is component state; nothing is linkable, nothing survives refresh except uiPrefs. (C5 mobile was deferred, but even desktop deep-linking into a file is impossible.)
- **Risks and questions have no global surface.** They exist only inside a FilePage accordion. A risk register that requires opening files one by one to read is why there are only 2 risks.

### 4.2 View by view

**Files (list + FilePage).** The strongest screen and rightly the default. Priority-grouped cards with staleness chips are good information design. Weaknesses: status filter defaults to Active and hides Monitoring (real work lives there); cards show next task but not "what changed recently"; with 33 active files the single-column card list under-uses the pane; the empty state ("Select a file to view") wastes the largest panel in the app on the most common landing.

**FilePage.** The accordion set (Memory, Deliverables & Tasks, Risks & Questions, Milestones, Links, Log) is coherent, and per-file accordion persistence is a nice touch. Issues: the unified Create/Paste/Template header row buries the single most common action (add a task) behind a two-step picker; the Memory editor is `document.execCommand` (deprecated, quirky lists, HTML in your data model); "Latest update" renders a field that is never populated; Risks & Questions forms are heavyweight for primitives used 9 times total.

**My Work / Today.** The best daily-driver concept in the app: Overdue, Today, Next 3 days, No date, grouped by file, with drag-ordering of today's groups. Two real problems: **95 of 108 open tasks have no date or stale dates after the drift**, so Today shows a fraction of reality and "No date" becomes the junk drawer; and the deliverable-grouping logic inside the section cards is visibly buggy at the edges (the double-derivation scar at TodayView ~line 1295).

**My Work / Board.** The five columns (Urgent, In Progress, To Plan, Waiting, Done Today) mix two taxonomies: Urgent is file-derived while the rest are task-status. The same task can morph columns when an unrelated risk elsewhere in its file flips urgency, which makes the board feel haunted. "Done Today" depends on `completedAt`, which only some completion paths set.

**My Work / List.** Solid, sortable, resizable. This and Today carry the daily load. The Blocker column conflates three sources (dependencies, gate text, status) into one cell, which is actually a good summary; the rest of the app should learn from it.

**Calendar.** The weekly mode is usable. The two-month grid renders file titles at 7px with "+2 more" overflow at ~3 items per day; at that size it is a heatmap pretending to be a calendar. Given FlexibleDates (week-of, month, TBD) mostly cannot render on a day grid at all, the calendar silently excludes the dates that are most characteristic of this work.

**People.** Conceptually the right view for a director (workload per person, files led starred, overdue counts) and visibly the most code-expensive (column drag, task drag between people, per-column resize, nested hierarchy cards). Reassigning by drag sets `assignees` to a single person, silently dropping co-assignees. It duplicates the full hierarchy renderer for the seventh time.

**Meeting Prep.** The jewel. File → deliverable → task tree, person filter, rich-text clipboard for Outlook/Word, print CSS. This is the artifact a comms director actually carries into a room. It is buried behind a toolbar button in a modal, cannot be linked or saved, and regenerates from scratch each time with no record of what was discussed.

**Claude (Import).** Functional and honest, but the preview is counts-only, apply is not idempotent, and error handling is "Invalid JSON." For the app's most consequential write path, it has the least review affordance of any screen.

**Settings / Team / Snapshots.** Snapshots modal is genuinely good (preview with stats, restore, prune at 30). Team modal mixes roster management with a workload summary that duplicates People. The `pre_edit` and `daily` trigger icons in the snapshot code have no producers: intended safety automation that was never built.

### 4.3 Density and visual design

The corporate-dark theme is coherent, the `T` token object is disciplined, and density is appropriate for a working tool. Critiques: font sizes run 7px to 15px with at least nine distinct sizes, several below legibility (7px, 8px); color-coding carries too much of the semantics (status, priority, urgency, staleness all reduce to small colored chips that compete); `zoom` CSS on the inner shell is a blunt instrument with known layout quirks (it exists because font sizing was hardcoded everywhere rather than scaled from a base); the Cinzel serif appears in exactly three places, a vestige.

---

## 5. Code health

### 5.1 Shape

2,739 lines, one file, ~117k tokens. Components: ~30. Top-level state lives in one `data` object passed down with 10 to 15 props per view (`sharedFileProps` spreads 11). No tests, no linter config in the loop, no error boundaries; verification is a hand-rolled `node -e` brace count. At this size, every patch session pays a fixed tax: re-read large regions, hold seven renderers in mind, then verify by symbol grep. The documented bug history is the receipts.

### 5.2 The disease, named

The recurring bugs (FlexDate crashes, uid collisions, stale `selTask` references, drop-indicator inconsistencies, column-resize cross-talk) are all the same disease: **one hierarchy, seven hand-copied renderers, zero shared derivation layer.**

File → deliverable → task grouping is independently reimplemented in FilePage, KanbanView, TodayView, CalendarView weekly, CalendarView monthly, PeopleView, and MeetingPrepModal, each with its own Map-building, its own standalone-task edge cases, its own drag-and-drop wiring, and its own date extraction. Every model change must be applied seven times; every miss is a new bug of exactly the class documented in memory. TodayView contains the smoking gun: standalone tasks derived twice, the second attempt commented "Re-derive standalone properly."

The same applies to the right-panel navigation stack (copied three times) and the order-array reconciliation idiom (`[...ord.map(find).filter(Boolean), ...rest]`, copied at least five times).

The fix is not "be more careful": it is a single selector/derivation layer (`getFileTree(data, options)`) and one HierarchyList component, consumed by every view. That alone would have prevented most of Bugs 1 through 6.

### 5.3 Legacy strata

The file is an archaeological dig: `t.fileId||t.projectId` in every filter; both `dependsOn` and `dependencies` carried and merged in `isBlocked`; the TS status map containing both new keys and legacy strings ('Urgent', 'To Plan'); `migrateFromPlanner` still shipped in the bundle; the sensitivity migration running on every load; `deliverableIds` arrays on files that nothing reads; Claude-import file creation writing `sensitivity:'normal'` and `health:'unknown'`, values from two retired schemes. Each stratum is small; together they mean no one can state the current schema without reading all 2,739 lines. (Notably, the schema reference the skill points to, `schema.md`, does not exist in the installed skill.)

### 5.4 Specific defects found in this audit

- **Clobbering autosave / no concurrency control** (section 3.4). Critical.
- **Import apply is not idempotent** and is applied via React state + debounced save. Evidenced by duplicate snapshots 2 and 3 (same label, 11 minutes apart, May 20).
- **`TODAY` is computed at module load.** A tab left open overnight shows yesterday's overdue/today buckets until refresh. For a daily-driver status tool this is a real correctness bug, not a nit.
- **Completion paths are inconsistent:** some set `completedAt` (Board, List, People ✓ buttons), some do not (TaskRow ✓, DeliverablePanel ✓), which breaks "Done Today" and any future velocity reporting. DeliverablePanel's ✓ also mutates `dv.taskIds` while TaskRow's does not.
- **Import matching falls back to title equality** for files, tasks, deliverables, milestones, and questions. A rename between Claude's read and the apply silently no-ops the change. `tasksToUpdate`/`filesToUpdate` apply `Object.assign` with arbitrary keys: no validation, typos create new fields forever.
- **People view drag-reassign drops co-assignees** (`assignees:[toPerson]`).
- **`RichTextEditor` uses deprecated `document.execCommand`** and stores HTML in `memory`, which the skill then has to `stripHtml` for every export and prompt.
- **Dead code:** FH health map, `latestUpdate` rendering, `pre_edit`/`daily` snapshot triggers, the legacy status entries, paste-help tooltip describing fields the importer ignores.

### 5.5 What the code does well

Buffer-on-blur for text fields (hard-won, correct), explicit `startWidth` on ColResizer (correct fix), `taskDateStr` as a chokepoint for FlexDate safety (right instinct, wrong enforcement: it relies on every call site remembering), uid bump-past-max (a fair patch for a flawed scheme), accordion state persistence, and a consistent visual token system. These micro-lessons should be carried into 2.0 as platform primitives rather than re-learned.

---

## 6. What is genuinely good and must survive

1. **The file/dossier as the core unit, with Memory as editable current truth.** This matches how a comms director thinks better than any generic PM tool. Memory's 98% adoption is the proof.
2. **The snapshot culture.** Automatic pre-import snapshots with rich human labels, preview, restore. Extend it (server-side, on every write path), never weaken it.
3. **FlexibleDate.** Exact / range / week / month / TBD with confidence is the correct date model for communications timing and should become a first-class platform pattern.
4. **Derived urgency from real signals** (priority, open high risks, overdue, blocked) instead of a manually maintained health field. Keep deriving; never ask the user to maintain a summary the system can compute.
5. **Meeting Prep.** The highest-leverage feature per line of code in the app. In 2.0 it deserves promotion from modal to a primary surface, possibly the primary surface.
6. **The skill's editorial rules.** "Never complete without a clear signal," "delta only," "flag conflicts," "log entries as prose with accountability." These rules are good judgment encoded and apply to any future update mechanism, conversational or not.
7. **The visual identity.** Corporate-dark with the shared `T` token family across Palantír and Durin's Works. Refine, do not replace.

---

## 7. Where this points (preview of Phase 2, not the blueprint)

Stated as conclusions the blueprint must answer to, with the trade-offs to be worked out there:

1. **Fix the write path before anything else.** Normalized tables (likely: files, tasks, deliverables, people, log/events) or at minimum a versioned row with realtime subscription. Zero data loss, reversible, with the current JSONB shape retained as snapshot/export format.
2. **Make Claude a first-class writer, not a JSON generator, from claude.ai chat on the work laptop.** The notes → review → apply flow stays (the editorial protocol is good); the copy-paste and the Import screen go. Snapshot first, write via the chat connector (or an inbox/RPC pattern if the connector is read-only), show a content-level diff. Cowork is the build environment, not part of the daily loop.
3. **Restructure the model around what the data proved:** file → task as the spine; deliverable as an optional "output" attachment with a lifecycle, not a mandatory middle layer; one lightweight "flag" primitive absorbing risks/questions/blockers; log generated from actual writes rather than hand-composed.
4. **Collapse six presentations into two or three surfaces** built on one shared hierarchy component: a daily cockpit (Today + overdue + meeting-ready), the file dossier, and a portfolio/people pivot. Meeting Prep gets promoted.
5. **Multi-file architecture with a derivation layer**, so the seven-renderer disease cannot recur, sized so each Cowork session ships one bounded piece.

End of audit.

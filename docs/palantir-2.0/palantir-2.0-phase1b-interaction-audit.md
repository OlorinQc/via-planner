# Palantír 2.0 — Phase 1b Interaction Audit

> **Consolidation note (June 12, end of day):** the patterns proposed here were validated and refined on the interactive mockup, then consolidated into the **binding Interaction Standard, blueprint section 4.2b**. Where this document and 4.2b differ (notably: inline hover buttons became the floating pill with mini-calendar and initials popovers; raw token insertion became the chip composer), **4.2b wins.** This document remains the evidence and reasoning trail.

Prepared June 12, 2026. Companion to the Phase 1 audit (approved June 11). Scope: how data enters, moves, and changes across every surface other than Today, judged with the same severity as Phase 1. Evidence: the v1 code (full read), the four work-chat transcripts, and the interaction kit validated on the Today mockup last night.

---

## 0. The yardstick

Last night's Today kit worked because it obeys six rules. They are the grading criteria for everything below.

1. **Direct manipulation beats forms.** If a change can be a drag or a click on the thing itself, a form is a defect.
2. **Enter data where your eyes already are.** Ghost rows at the point of attention, never navigate-to-create.
3. **One line should be enough.** Parse intent from text ("Dorval: call Philippe @wa fri"), do not interrogate with fields.
4. **Batch is a first-class gesture.** Anything you do to one task you can do to a selection.
5. **Feedback plus cheap undo replaces confirmation.** Toast and event trail instead of `window.confirm`.
6. **Every gesture is one row write.** If an interaction needs more than that, the model is wrong, not the gesture.

**The unifying proposal of this audit:** Palantír should have **one capture grammar everywhere**. `File: title @person date`, with the prefixes you already use in your notes (`Q:`, `RISK:`, `BLOCKED:`, `DONE`) promoting a line to a flag or completion. The same grammar works in the Today capture bar, in every ghost row, in the flag composer, in Meeting mode, and it is literally the language skill v2 parses from your pasted notes. One language for Karl-to-app and Karl-to-Claude. Nothing new to learn, because it is the notation you invented yourself.

**Refinement (Karl, Jun 12): the grammar is the machine's format, never a user obligation.** Every token must be reachable by click: capture lines are chip composers. Buttons for 📅 date (mini calendar with exact, w/o week, m/o month precision), @ person (initials), and ↳ output (list of the file's outputs) each add a removable chip to the line; only the title is typed. Typed tokens parse live into the same chips, so corrections are a click on a chip's x, and the chips teach the syntax passively. Additionally, the Meeting-mode tree is a full drag target like every other hierarchy view: capture a task at file level with no syntax, then drag it onto an output header to nest it, between outputs, or back out to file level. The `>` output syntax and all tokens remain as the keyboard fast lane only.

---

## 1. File page

The dossier is where v1 punishes data entry hardest. Score against the yardstick, element by element.

### 1.1 Memory (the most-edited field in the app)

**v1:** a contenteditable rich-text box with a B/I/U/list toolbar, `document.execCommand`, saving on every input event. It works, but editing feels like operating a tiny 2009 CMS, and it stores HTML.

**Friction:** toolbar fiddling for what is always the same structure (a paragraph of truth plus date bullets); no visual save confirmation at the field; and the content is dead text, when it is actually full of latent tasks and dates.

**Proposed interactions:**
- Click anywhere in memory to edit in place; save on blur with a brief green flash. Markdown-style shortcuts (`- ` starts a bullet) instead of toolbar buttons; toolbar disappears.
- **Promote-to-task:** select any phrase inside memory ("circulate with partners week of June 5") and a floating `→ task` button appears. One click creates the task under this file with the selected text as title, date parsed if present. This is the single highest-value entry gesture in the app: your memories are already task lists wearing prose.
- Same selection affordance offers `→ flag` for `Q:`-shaped sentences.

### 1.2 Creating tasks and outputs

**v1:** "+ Create" opens a picker (Deliverable or Task), then a 6-to-9-field form, then "Add." Three interactions before you can type a title. The data shows the result: 71 manual tasks in a month, while 133 came through Claude. The form is why.

**Proposed:**
- Ghost `+ task` rows everywhere (file level and inside each output), accepting the capture grammar inline: `Review quotes @wa fri` sets assignee and date in the same keystroke stream. **Enter saves and keeps the input open** for the next task, so dumping six tasks after a phone call is six lines, not six forms.
- Ghost `+ output` takes one line too: `Press release - Jun 20 @wa`. Type inferred from keywords (press release, Q&A, plan, video, board...), everything else editable later in the panel. The 9-field form dies; the panel remains for refinement, never for creation.
- The Workflow templates (kept but demoted) attach from the output's own header: `Workflow…` on an existing output, applying its task chain to it, instead of the modal-driven deliverable factory nobody used.

### 1.3 Moving and ordering work

**v1:** FilePage is the only place with task drag, wired to three different order arrays with the union-dedupe idiom, plus drop-to-link on deliverable headers. It mostly works and was clearly loved enough to fix twice.

**Proposed (same engine as Today, shared HierarchyList):**
- Live-insertion reorder while dragging, like day items last night, not drop-zones.
- Drag a task onto an output header to link it; drag it to the file-level list to unlink. Same gesture both directions.
- **Drag a task onto a file card in the left list to re-file it.** Your May 27 session spent seven `tasksToUpdate` entries relinking Board Documents tasks; in 2.0 that is seven drags, or one batch drag.
- Hover affordance on every row, superseded by the floating pill (see 4.2b): 📅 opens the mini calendar (exact, w/o, m/o), @ opens the initials popover, both overlaying the row edge with zero content shift. Reassignment and rescheduling without opening anything.

### 1.4 Flags

**v1:** the risk form has six fields; the question form four. Combined usage: nine items ever. The forms killed the primitive.

**Proposed:** one ghost `+ flag` line using your note markers: `Q: who presents to Board, Philippe or Karl?` or `BLOCKED: clearances may not pass in time @denis`. Prefix sets the kind, the rest is the text, `@` sets the owner. Resolution is a ✓ on the flag with an inline "answer?" prompt that posts to History. Two interactions, total.

### 1.5 Links and History

- Links: paste-first. A ghost `+ link` row where pasting a SharePoint URL is the entire interaction; label optional, type auto-guessed from URL path (folder vs file). Bonus gesture: paste a URL anywhere on the file page and it offers to attach.
- History: a one-line composer at the top ("log what changed…"), Enter posts a log event with you as actor. The title+summary form goes; auto-events carry the structural record anyway, so hand entries can be prose-only.

### 1.6 Header fields

**v1:** four always-visible dropdowns (status, priority, sensitivity, lead). **Proposed:** chips, not dropdowns. Click the status chip and the five options fan out inline; click priority to cycle or long-press for the fan. Lead chip opens the same one-row people picker. Half the visual weight, zero dropdown chrome.

---

## 2. Files list

**v1:** search on title and lead only; status filter defaulting to Active (hiding Monitoring); cards are click-to-open only, nothing can be done from the list itself.

**Proposed:**
- **Ctrl+K command palette, the app-wide one.** Search across files, tasks, outputs, flags, and memory text; results act, not just navigate: complete a task, reschedule it, jump to a file. On a 46-file portfolio this becomes the fastest path to almost everything, and it is the keyboard answer for "I know it exists but not where."
- Card hover quick-actions: `+ task` (ghost popover with the grammar, no navigation) and `log…` directly on the card. Capturing against a file should not require opening it.
- Cards accept drops: tasks dragged from anywhere re-file onto them (1.3).
- Filter defaults fixed per the Phase 1 audit (Active + Monitoring together), with the search box also accepting the grammar's `@person` token to filter by person.

---

## 3. Team

### 3.1 Board mode (v1 People view)

**v1:** the most interaction-rich view in the app: cross-person task drag, column reorder, hide/show people, per-column resize. Also the buggiest by class, and the drag silently destroys co-assignees (`assignees:[toPerson]`).

**Proposed:**
- Keep cross-person drag, fix its semantics: default drop **adds** the person as assignee and makes them primary; a drop menu chip appears for half a second offering "replace" if that is what you meant. Destructive-by-default becomes additive-by-default.
- Person column headers are batch drop targets: select five tasks (the same multi-select as everywhere), drop on a header, five reassignments, one toast.
- Header shows a small load figure (open, late) so the drop target doubles as the workload readout, and the Team modal's duplicate workload table dies.

### 3.2 Meeting mode (the promoted jewel)

The check-off and two-flavor export are in the mockup. What the transcripts say is still missing: things come up *during* the meeting, and today they wait for your annotation pass afterward.

**Proposed:**
- **Meeting capture, scoped.** Each file group in Meeting mode carries the same one-line capture, prefilled with that file's context: while discussing Dorval, typing `update web page @wa fri` files it under Dorval without naming it. `DONE` prefix completes a named task; `Q:` raises a flag. If you capture live, the after-meeting annotation pass shrinks to whatever you could not type in the moment, and the paste-back to Claude becomes a top-up instead of the whole load.
- Keyboard pass for running the room: space checks the focused task, arrows move, `n` opens capture on the current file. Three keys, learnable in one meeting.
- The check-off writes immediately (row write + event), so the export you copy at the end of the meeting is already current. Working-copy refs stay for the things you annotate later on paper or in Word.

### 3.3 What this does to the update loop

Worth stating plainly: live meeting capture, ghost rows, and promote-to-task all reduce the volume that flows through the weekly Claude session. The chat loop stays the heavy lifter for batch weeks and document dumps (the May 22 docx, the Champions transcript), but the everyday trickle gets captured at the moment it exists. The drift problem is attacked from both ends.

---

## 4. Activity

**v1 equivalents:** the Import screen (counts-only preview) and the Snapshots modal (blind `confirm()` restore).

**Proposed:**
- Package rows expand to a **content-level diff grouped by file**, the same shape as the chat walk-through, so reviewing what Claude applied takes ten seconds.
- Restore previews before acting: "restoring snapshot #9 changes 3 files, 12 tasks, shows list," then one click. No `window.confirm` anywhere in the app; bulk and destructive actions instead get an **Undo button on the toast (8 seconds)**, backed by the event trail for simple inverses and snapshots for everything else.
- Snapshots can be pinned and annotated inline (click label to edit), since their labels are already your de facto journal.

---

## 5. Cross-cutting

- **One selection model.** Click-to-select with the floating batch bar everywhere rows exist: Today, file page, Team, even palette results. The bar is context-aware: in the file page it adds "link to output…", in Team it adds "reassign to…". Esc clears.
- **Undo over confirm.** Stated in section 4; it is a global rule. Every `window.confirm` in v1 (delete task, archive file, delete snapshot, restore) becomes act-now-undo-after.
- **Keyboard, minimal but real.** Ctrl+K palette, `n` capture-in-context, space complete, Esc clear. No vim ambitions.
- **URLs everywhere** (already in the blueprint): every panel state addressable, so back/forward work and a file can be linked in an email to William.
- **Touch and on-the-go.** Drag is mouse-first; the batch bar, quick-date buttons, capture grammar, and chip-fans are all finger-sized by design. The future `/palantir/m` route gets capture, check-off, and quick-dates for free, which covers what "on the go" actually needs.

---

## 6. The forms ledger

Every v1 form and dialog, and its 2.0 replacement:

| v1 form or dialog | Fields | 2.0 replacement |
|---|---|---|
| New Task form (picker + form) | 6 | Ghost row + grammar, Enter-chains |
| New Deliverable form | 9 | Ghost output line, type inferred |
| Risk form | 6 | `RISK:` flag line |
| Question form | 4 | `Q:` flag line |
| Milestone form | 3 | Gone (dated tasks and outputs) |
| Link form | 3 | Paste-first ghost row |
| Log entry form | 2 | One-line History composer |
| Add File modal | 6 | Stays a small modal (rare, deliberate act), title-first with grammar defaults |
| Apply Template modal (3 steps) | n/a | `Workflow…` on an output header |
| Import screen | n/a | Gone (chat applies; Activity reviews) |
| Team modal workload table | n/a | Board headers |
| All `window.confirm` dialogs | n/a | Toast with Undo |

Eleven forms reduced to one small modal and a set of one-line gestures, all writing single rows, all evented, all snapshotted.

---

## 7. Proposed mockup additions, for your pick

1. **File page interactions** (1.1 to 1.6): promote-to-task from memory, ghost rows with grammar and Enter-chaining, flag composer, chip-fan header. Highest value, most new surface.
2. **Team Board + Meeting capture** (3.1, 3.2): additive reassign drag, batch drop on person headers, scoped meeting capture with DONE/Q: prefixes.
3. **Ctrl+K palette** (2): cross-entity search with act-from-result.
4. **Activity diff + undo toasts** (4): content diff expansion and the undo pattern.

All four extend the existing mockup file. Recommendation: 1 and 2 first, they carry the daily load; 3 and 4 are quick afterward.

End of Phase 1b audit.

---
name: palantir
description: |
  Palantír is Karl's private corporate communications file-control and deliverable-management app at VIA Rail Canada. Load this skill immediately and without being asked when: Karl mentions Palantír by name, Karl pastes meeting notes or team status updates (especially notes with Lead/Supporting/Next steps structure), Karl asks to process notes or updates into Palantír, Karl asks for an import package or update, Karl mentions files/deliverables/tasks in the context of his communications work, or Karl mentions any of his team members (William-Antoine, Marie-Élise, Sylvie, Sarah, Lise, Denis) in the context of work updates. Also load when Karl pastes structured notes with headers like "DONE", "BLOCKED:", or "Q:". This skill tells you how to read the current live state from the pal_ tables, how to parse Karl's notes, and how to apply updates through the pal_apply_update RPC.
---

<!-- DRAFT v2 (Session 2). Targets the normalized pal_ tables + pal_apply_update RPC.
     Pending Karl's review before it replaces the installed skill. -->

# Palantír Skill (v2)

You are helping Karl manage Palantír — a private file-control and deliverable-management app for
his corporate communications work at VIA Rail Canada. Karl is interim director of corporate
communications.

Palantír 2.0 stores data in normalized `pal_` tables and is written **only** through the
`pal_apply_update` RPC. The work-chat Supabase connector is read-write. See `schema.md` for the
data model and `update-package.md` for the exact write verbs.

---

## STEP 0 — ALWAYS READ LIVE STATE FIRST

Before parsing any notes, read current state from Supabase. Two modes:

**Daily delta (preferred, cheap)** — query only the files in Karl's notes:
```sql
SELECT id, title, status, priority, memory FROM pal_files
WHERE lower(title) = ANY (ARRAY['bikes on board','board documents']);
```
Then pull their tasks / outputs / flags as needed:
```sql
SELECT id, title, status, due, output_id FROM pal_tasks WHERE file_id = '<id>' AND status <> 'completed';
SELECT id, title, status, due FROM pal_outputs WHERE file_id = '<id>';
SELECT id, kind, text, status FROM pal_flags WHERE file_id = '<id>' AND status = 'open';
```

**Weekly full review** — one call returns the whole v1-shaped picture:
```sql
SELECT pal_export_state();
```

**Do NOT ask Karl to paste or export state. Read it directly every time.**
**Never write the tables directly and never touch `palantir_state`.**

---

## PALANTÍR DATA MODEL

See `schema.md`. Key relationships:
- A **File** (`pal_files`) is the main object — a comms file, issue, campaign, or project.
- An **Output** (`pal_outputs`, v1 "deliverable") belongs to a file and has a type.
- **Tasks** (`pal_tasks`) belong to a file or to a specific output within a file.
- **Memory** = current truth (editable, present tense). **Log** = `pal_events` kind `log`
  (append-only, past-tense prose). **Milestones** = `pal_tasks` with `source = 'milestone'`.
- **Flags** (`pal_flags`) = risks, blockers, and open questions on a file.
- **People**: Karl, William-Antoine Blaney, Marie-Élise Jarry, Sylvie Gosselin,
  Sarah Perron-McLean, Lise Arsenault, Denis Boucher, Mathieu Paquette, Félix, Ève-Danièle.

---

## PARSING KARL'S NOTES

### Notes structure
Karl's notes are organized **team member → file/project → details** (Lead / Timeline /
Next steps / Supporting / Link). He edits them in place between sessions — adding, removing,
or updating bullets. The notes are his current picture. **There is no separate "what changed"
section; markers appear inline throughout.**

### Working-copy ref fast lane
Karl's notes are often Palantír's own Meeting Prep **Working copy** export, with short refs
embedded next to files/tasks/outputs. When a line carries a ref, use it directly as the
`fileId` / `taskId` / `outputId` in the package — that is the deterministic path; skip title
matching. Plain notes with no refs fall back to title resolution.

### Inline markers — scan the ENTIRE document

| Marker | Meaning |
|---|---|
| `DONE` (all caps, anywhere on a line) | Task / output / milestone complete |
| `NEW DATE:` or an inline date correction | Date changed — update the task/output FlexDate |
| `Q:` or an explicit question | Open question → `flagsToCreate` kind `question` |
| `BLOCKED:` | Blocker → `flagsToCreate` kind `blocker` (or `risk`) |
| `NEW FILE:` | New Palantír file (ask before creating) |
| `NEW:` | New task or output to create |

Markers appear anywhere — mid-bullet, end of line, as a sub-bullet.

### Carry-forward vs. actual change
Most content is **carry-forward** (already in Palantír). Propose updates only for what is
genuinely new or different:
- **DONE** → find matching task/output, `tasksToComplete` / output status update.
- **NEW DATE** → update the task/output `due` FlexDate.
- **Q:** → `flagsToCreate` (question). **BLOCKED:** → `flagsToCreate` (blocker/risk).
- **No marker** → compare against current memory; propose only if it meaningfully differs.

### Completion signals without a DONE marker
Past-tense verbs in context also signal completion: "sent", "issued", "approved", "completed",
"published", "launched", "handed over". "Press release issued" → complete the output and its
final task. "Done for this Board" → complete the relevant tasks.

---

## DATE DISCIPLINE

- Resolve every date against the **note's own date / today**, never the model's training date.
  Convert relative dates ("next Thursday", "week of the 18th") to absolute before writing.
- Never invent a year. If the year is ambiguous, use FlexDate precision `month`/`week` or ask.
- French/English mixed dates are normal: "18 mai" = May 18, "10 juin" = June 10.
- Use FlexDate precision honestly: `exact` only when the day is firm; otherwise `week`,
  `month`, or `tbd`. Pushed/moved dates → update the existing task/output, don't add a new one.
- A bare `"YYYY-MM-DD"` string is accepted and auto-wrapped; pass JSON `null` to clear a date.

---

## WALK-THROUGH FORMAT

After reading state and parsing notes, walk through proposed changes **file by file**, only
for files where something actually changed:

```
**[File title]**
Memory update: [what to add/change, or "none"]
Log entry: [plain prose with natural accountability]
Tasks to complete: [list]
Tasks to create: [owner — task — due if known]
Output / flag / date updates: [if any]
→ Confirm: [numbered questions, only if genuinely ambiguous]
```

When you need confirmation, ask **numbered** questions (max ~2 per file) so Karl can answer
"1 yes, 2 no" quickly. Don't bury questions in prose.

---

## RULES

### Writing rules
1. **Memory** = current live truth, present tense. "File is active. Key messages approved by Mathieu Paquette on May 12."
2. **Log entries** = plain prose, past tense, accountability woven in. "Dorval slides integrated by Karl and approved by Carl Delisle." Never "Status updated to approved."
3. **Task titles** = action-first. "Review booking data with Commercial team", not "Booking data review."
4. **Dates** = FlexDate; use `week`/`month`/`tbd` when timing is uncertain.

### Safety rules
5. **Never complete a task** unless clearly signalled. "Looks good" ≠ done. Ask if uncertain.
6. **Never overwrite memory wholesale by accident.** Build `newMemory` from the current memory and send the full intended HTML; never blank it.
7. **Dedupe before create.** Check existing people/files/tasks first; the RPC also guards (skips duplicate people/files, warns on similar open tasks) — read those warnings.
8. **Never invent facts.** Vague date, owner, or outcome → ask, don't fill in.
9. **Flag conflicts.** Notes contradict current memory → surface it, don't silently overwrite.

### Scoping rules
10. **Delta only.** Don't include carry-forward items with no change.
11. **Group correctly.** A task under an output → set `outputId` (or `outputTitle`).
12. **New files.** A file in notes not in Palantír → ask Karl before creating.
13. **People.** Palantír names for assignees; external stakeholders (Philippe Normand, Carl Delisle, etc.) go in task notes or log prose, not as people.

---

## THE WRITE PATH (RPC protocol)

After Karl confirms each file:

1. Build one package (see `update-package.md`). Give it a **stable, unique** `packageId`
   (e.g. `2026-06-17-bikes-board`). Re-running the same id is a safe noop.
2. Apply it:
   ```sql
   SELECT pal_apply_update('<package json>'::jsonb);
   ```
3. **Read back and verify.** Inspect the returned `{ status, results, warnings }`:
   - `status: applied` does **not** mean every item succeeded — scan `results` for any
     `skipped: …` and every `warn` (ambiguous titles, missing assignees, unknown leads).
   - Then re-query the affected rows (or `pal_export_state()` for those files) to confirm the
     writes landed.
4. Report back to Karl: a one-paragraph plain-language summary of what changed, plus any
   skipped/warned items that need his decision.

If `status: error` (e.g. missing `packageId`) or anything looks wrong, the package was atomic —
nothing applied — and a pre-apply snapshot exists. Fix and re-run with the same `packageId`.

---

## TOKEN EFFICIENCY
- Daily update: query only the files mentioned with `WHERE` filters, not full state.
- Weekly review: one `pal_export_state()` at the start.
- Don't pull all files into context for a small update.

---
name: palantir
description: |
  Palantír is Karl's private corporate communications file-control and deliverable-management app at VIA Rail Canada. Load this skill immediately and without being asked when: Karl mentions Palantír by name, Karl pastes meeting notes or team status updates (especially notes with Lead/Supporting/Next steps structure), Karl asks to process notes or updates into Palantír, Karl asks for an import package or update, Karl mentions files/deliverables/tasks in the context of his communications work, or Karl mentions any of his team members (William-Antoine, Marie-Élise, Sylvie, Sarah, Lise, Denis) in the context of work updates. Also load when Karl pastes structured notes with headers like "DONE", "BLOCKED:", or "Q:". This skill tells you how to read the current live state from palantir_state, how to parse Karl's notes, and how to apply updates through the pal_apply_to_v1 bridge RPC (which writes back into palantir_state, the row the app reads).
---

> ## STATUS: LIVE via the bridge (Session 3 applied + verified 2026-06-18).
> The write path is the **`pal_apply_to_v1` bridge**, applied and verified on 2026-06-18
> (see `palantir-2.0-session3-report.md`). `palantir_state` stays the **canonical row the app
> reads**; on every call the bridge rebuilds the `pal_` tables from it, applies the package through
> the hardened `pal_apply_update` engine, and writes the result back into `palantir_state`, so the
> app reflects every change. The old field-name mismatch is gone: you no longer use the app's Import
> screen, you call the bridge, which uses the RPC's field names internally and re-exports the v1 shape.
>
> **Run daily updates with the Palantír app closed.** The bridge takes an optimistic-concurrency
> token (`palantir_state.updated_at`); if the app saves between your read and your write you get a
> `conflict` (nothing written), so you re-read and retry. The first real bridge write also
> permanently normalizes `palantir_state` (drops deprecated v1 fields, archived into `pal_events`;
> resolves 6 duplicate task ids). That is expected and app-compatible.

# Palantír Skill (v2 draft)

You are helping Karl manage Palantír — a private file-control and deliverable-management app for
his corporate communications work at VIA Rail Canada. Karl is interim director of corporate
communications.

Palantír 2.0 stores data in normalized `pal_` tables and is written through the `pal_apply_to_v1`
bridge, which keeps the v1 `palantir_state` row (what the app reads) as the source of truth. See
`schema.md` for the data model and `update-package.md` for the write verbs.

---

## STEP 0 — READ LIVE STATE + CAPTURE THE CONCURRENCY TOKEN

`palantir_state` (id=1) is the source of truth and what the app reads. The `pal_` tables are the
bridge's internal engine (rebuilt from `palantir_state` on every write), so never read them as the
live picture. Always start by reading the state **and** its `updated_at`; you pass that `updated_at`
to the bridge as the concurrency token.

**Daily delta (cheap)** - the token plus only the files named in Karl's notes and their tasks:
```sql
WITH s AS (SELECT updated_at, state FROM palantir_state WHERE id = 1),
     fids AS (SELECT f->>'id' AS id FROM s, jsonb_array_elements(s.state->'files') f
              WHERE lower(f->>'title') = ANY (ARRAY['bikes on board','board documents']))
SELECT (SELECT updated_at FROM s) AS token,
       (SELECT jsonb_agg(f) FROM s, jsonb_array_elements(s.state->'files') f
        WHERE f->>'id' IN (SELECT id FROM fids)) AS files,
       (SELECT jsonb_agg(t) FROM s, jsonb_array_elements(s.state->'tasks') t
        WHERE coalesce(t->>'fileId', t->>'projectId') IN (SELECT id FROM fids)) AS tasks;
```
Each file object embeds its milestones, risks, openQuestions, log, and sharePointLinks; its tasks
are in `state->'tasks'` keyed by `fileId`/`projectId`.

**Weekly full review** - the whole v1-shaped picture plus the token:
```sql
SELECT updated_at, state FROM palantir_state WHERE id = 1;
```

**Optional SQL convenience** - to query the normalized tables instead of JSON, resync them first
with `SELECT pal_migrate_from_v1();` then read `pal_files` / `pal_tasks` / `pal_outputs` / `pal_flags`.
The bridge re-migrates on write, so this is read-only convenience; it does not change the source of truth.

**Do NOT ask Karl to paste or export state. Read it directly every time.**
**Never `UPDATE`/`INSERT` the tables or `palantir_state` directly. Every write goes through `pal_apply_to_v1`.**

---

## PALANTÍR DATA MODEL

See `schema.md` for tables, the real FlexDate shapes, and the live vocabularies. Key relationships:
- A **File** (`pal_files`) is the main object — a comms file, issue, campaign, or project.
- An **Output** (`pal_outputs`, v1 "deliverable") belongs to a file and has a type.
- **Tasks** (`pal_tasks`) belong to a file or to a specific output within a file.
- **Memory** = current truth (present tense). **Log** = `pal_events` kind `log` (past-tense prose).
  **Milestones** = `pal_tasks` with `source = 'milestone'`.
- **Flags** (`pal_flags`) = risks, blockers, and open questions on a file.
- **People**: resolve names against the **live `pal_people` table**, do not trust a hardcoded list.
  Roster as of 2026-06-17: Karl, William-Antoine Blaney, Marie-Élise Jarry, Sylvie Gosselin,
  Sarah Perron-McLean, Lise Arsenault, Denis Boucher, Mathieu Paquette, Catherine Langlois,
  Vanessa Zieman, Félix, Ève-Danièle. External stakeholders (Philippe Normand, Carl Delisle, etc.)
  go in task notes or log prose, not as people.

---

## PARSING KARL'S NOTES

### Notes structure
Karl's notes are organized **team member → file/project → details** (Lead / Timeline /
Next steps / Supporting / Link). He edits them in place between sessions. The notes are his
current picture. **There is no separate "what changed" section; markers appear inline throughout.**

### Working-copy ref fast lane
Karl's notes are often Palantír's own Meeting Prep **Working copy** export, with short refs
embedded next to files/tasks/outputs. When a line carries a ref, use it directly as the
`fileId` / `taskId` / `outputId` — that is the deterministic path; skip title matching. Plain
notes with no refs fall back to title resolution.

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
- Never invent a year. If timing is uncertain, use a coarser FlexDate precision, do not guess a day.
- French/English mixed dates are normal: "18 mai" = May 18, "10 juin" = June 10.
- **Emit the app's real FlexDate object** (see `schema.md` for the exact shape). Precision is one of
  `exact` (uses `date`), `week` (uses `weekStartDate`), `month` (uses `month` + `year`),
  `range` (uses `startDate` + `endDate`), or `tbd` (no date). Set `confidence` to `confirmed` only
  when the date is firm, otherwise `tentative`. A plain `"YYYY-MM-DD"` string is also accepted and
  is auto-wrapped to an exact, confirmed FlexDate; pass JSON `null` to clear a date.
- Pushed/moved dates → update the existing task/output, do not add a new one.

---

## WALK-THROUGH FORMAT

After reading state and parsing notes, walk through proposed changes **file by file**, only for
files where something actually changed:

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
4. **Dates** = the app's FlexDate object; coarsen precision when timing is uncertain.

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
13. **People.** Use live `pal_people` names for assignees; external stakeholders in notes/log prose only.

---

## THE WRITE PATH (the `pal_apply_to_v1` bridge)

After Karl confirms each file:

1. Build one package (see `update-package.md`) with a **stable, unique** `packageId`
   (e.g. `2026-06-17-bikes-board`). Re-running the same id is a safe noop.
2. Apply it through the bridge, passing the token from STEP 0:
   ```sql
   SELECT pal_apply_to_v1('<package json>'::jsonb, '<token from STEP 0>'::timestamptz);
   ```
   The bridge snapshots `palantir_state`, rebuilds `pal_` from it, runs `pal_apply_update`, writes
   the result back into `palantir_state` (what the app reads), and logs the `packageId`.
3. **Handle the returned status:**
   - `applied` - it landed in `palantir_state`; the app will show it. `applied` does **not** mean
     every item succeeded: scan `results` for any `skipped:` and every `warn`, and surface them.
     Then read back (the STEP 0 query, or `SELECT state FROM palantir_state WHERE id = 1`) to confirm.
   - `noop` - this `packageId` was already applied via the bridge; nothing to do.
   - `conflict` - `palantir_state` changed since STEP 0 (Karl edited in the app, or another update
     ran). Re-read STEP 0 for a fresh token and re-apply the **same** `packageId`.
   - `error` - atomic, nothing applied (a snapshot exists). Fix and re-run the same `packageId`.
4. Report back to Karl: a one-paragraph plain-language summary, plus any skipped/warned items.

**Run daily updates with the Palantír app closed** so the concurrency guard does not bounce you
with conflicts. Always pass the token; omit it (`NULL`) only for a deliberate force-write.

---

## TOKEN EFFICIENCY
- Daily update: use the STEP 0 delta query to pull only the named files + their tasks, not full state.
- Weekly review: one `SELECT updated_at, state FROM palantir_state WHERE id = 1;` at the start.
- Don't pull all files into context for a small update.

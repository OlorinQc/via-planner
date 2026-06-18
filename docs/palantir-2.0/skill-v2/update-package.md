# Palantír 2.0 — Update Package Reference (pal_apply_update)

The write path is a single RPC:

```sql
SELECT pal_apply_update('<package json>'::jsonb);
```

One package = one transaction = one snapshot + one `import` event. Field names below are
**exact** (they come straight from the deployed function). Unknown keys are reported as
warnings, never silently dropped.

---

## Envelope

```json
{
  "packageId": "2026-06-17-bikes-board",   // REQUIRED, unique. Re-use = safe noop.
  "summary": "Weekly update: Bikes on Board, Board docs",
  "date": "2026-06-17",
  "source": "weekly notes",
  "...verb arrays...": []
}
```

- `packageId` is **required**. Missing → `{ "status": "error", "error": "packageId is required" }`.
- Make it stable and descriptive (date + slug). Re-applying the same id returns
  `{ "status": "noop", "reason": "package already applied" }`.

## Resolution: id OR title

Most verbs accept an explicit id **or** a human title:
- files: `fileId` | `fileTitle`
- outputs: `outputId` | `outputTitle`
- tasks: `taskId` | `taskTitle`
- flags (resolve): `flagId` | (`fileId`/`fileTitle` + `text`)

Title matching prefers the live row (non-archived file / open task) and **skips on ambiguity**
with a warning (`ambiguous title (N matches), skipped`). Prefer ids when the working-copy refs
give you one (the deterministic fast lane).

---

## Verbs (apply order)

Order is fixed inside the function: people → files(create/update) → outputs → tasks →
flags → links → memory → log → **merges last**.

### peopleToCreate — `[{ name, title }]`
Duplicate-guarded on `name` (case-insensitive). Existing → `skipped: already exists`.

### filesToCreate — `[{ title, status, priority, sensitivity, lead, memory }]`
- `title` required. Same-title non-archived file → `skipped: file with same title exists`.
- `lead` is a person **name**; unknown → created anyway with `warn: lead not found`.
- Defaults: status `active`, priority `medium`, sensitivity `low`.

### filesToUpdate — `[{ fileId|fileTitle, changes:{ title, status, priority, sensitivity, lead, archived } }]`
- `archived` accepts a JSON boolean. A malformed value is **ignored + warned**
  (`invalid archived value ignored: …`); it never aborts the package.
- Unknown keys inside `changes` are warned and skipped.

### outputsToCreate — `[{ fileId|fileTitle, title, type, status, owner, due, publication, approvalStatus, sharePointUrl, notes }]`
- `fileId|fileTitle` must resolve; `title` required.
- `owner` is a person name (unknown → warn). `due` / `publication` are FlexDate or `"YYYY-MM-DD"`.

### outputsToUpdate — `[{ outputId|outputTitle, changes:{ title, type, status, owner, due, publication, approvalStatus, sharePointUrl, notes, sortOrder } }]`
- `due`/`publication`: pass FlexDate or date string; pass JSON `null` to **clear** the date.
- `sortOrder` malformed → ignored + warned (sibling changes still apply).

### tasksToComplete — `[{ taskId|taskTitle }]`
Already-complete → `ok` with `warn: already completed`. Ambiguous title → `skipped: no match`.

### tasksToCreate — `[{ fileId|fileTitle, outputId|outputTitle, title, status, assignees[], due, notes, gate }]`
- `assignees` is an array of person **names**; unknown names are warned, known ones linked.
- A similar open task in the same file adds `warn: similar open task exists: <id>` (does **not** block).
- Created with `source = claude_import`.

### tasksToUpdate — `[{ taskId|taskTitle, changes:{ status, title, notes, gate, due, outputId, fileId, assignees, sortOrder } }]`
- Referential safety: a bad `outputId`/`fileId` is dropped with a warning, link unchanged,
  **the rest of the change still applies** (does not abort).
- Setting `status: "completed"` sets `completed_at`; any other status clears it.

### tasksToDelete — `[{ taskId }]`
Hard delete; the full row is archived into the `delete` event payload first. Id only (no title).

### flagsToCreate — `[{ fileId|fileTitle, kind, text, detail, severity, owner }]`
- `kind` ∈ `question` | `risk` | `blocker`; anything else → defaults to `question` + warn.
- `text` required. `severity` ∈ `low`/`medium`/`high` (use for risks/blockers).

### flagsToResolve — `[{ flagId | (fileId|fileTitle + text), status, resolution }]`
- Match by `flagId`, else by `text` (optionally scoped to a file). Ambiguous text → skipped.
- `status` default `resolved`; also accepts `dropped` / `open` (re-open clears `resolved_at`).

### linksToCreate — `[{ fileId|fileTitle, label, url, type }]`
`url` required. `type` default `folder`.

### memoryUpdates — `[{ fileId|fileTitle, newMemory }]`
Replaces the file's memory wholesale with `newMemory`. **Always send the full intended memory
HTML** — omitting `newMemory` writes an empty memory. (Per the writing rules, build the new
memory from the current one; never blank it by accident.)

### logEntriesToCreate — `[{ fileId|fileTitle, date, title, summary }]`
`summary` is the prose log line. `date` defaults to today if missing/invalid.

### filesToMerge — `[{ sourceFileId|sourceTitle, targetFileId|targetTitle }]`
Reassigns tasks/outputs/flags/links from source → target, archives the source, writes a
`merge` event on both with the moved counts. Source = target → skipped. Runs **last**.

---

## Result contract

```json
{
  "status": "applied",                 // applied | noop | error
  "packageId": "2026-06-17-bikes-board",
  "results": [
    { "op": "task.create", "id": "…", "result": "ok", "warn": "assignees not found: Ghost" },
    { "op": "complete", "ref": {…}, "result": "skipped: no match", "warn": "ambiguous title (2 matches), skipped" }
  ],
  "warnings": [ "unknown key ignored: bogusKey" ]
}
```

- `result` is `ok` or `skipped: <reason>`. A `skipped` item is informational, not a failure.
- `op` values: `person.create`, `file.create`, `file.update`, `output.create`,
  `output.update`, `task.create`, `complete`, `task.update`, `task.delete`,
  `flag.create`, `flag.resolve`, `link.create`, `memory`, `log`, `file.merge`.

## Robustness (post Session 2)

- Malformed `archived` (boolean) and `sortOrder` (number) values are ignored + warned instead
  of aborting the whole package. Bad date strings normalize to null. Bad `outputId`/`fileId`
  links are dropped with a warning. **One bad value no longer rolls back the other changes.**
- Still atomic on real errors: anything the function cannot handle rolls the whole package back,
  and the pre-apply snapshot lets you restore.

## Always read back

After applying, re-query the affected rows (or `pal_export_state()` for those files) and confirm
the writes landed. Surface every `skipped`/`warn` line to Karl; do not assume `applied` means
every item succeeded.

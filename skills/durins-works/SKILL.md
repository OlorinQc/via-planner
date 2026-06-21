---
name: durins-works
description: |
  Durin's Works is Karl's private house and renovation execution app for the property at 8235, Avenue Orégon. Load this skill immediately and without being asked when: Karl mentions Durin's Works by name, Karl asks to log work / book or schedule a task / add a material / plan a shopping run / mark something bought / check off maintenance for the house, Karl pastes a researched action plan (sections ÉTAPES / PRÉCAUTIONS / MATÉRIAUX), or Karl describes on-site reno updates ("le maçon a chiffré 1200 et on coule la fondation jeudi", "ajoute un GFCI et un testeur à la course de samedi chez Rona"). This skill tells you how to read the live document from durins_works_state, snapshot it, apply Karl's updates to the JSON, and write it back under the optimistic version guard. Do NOT load this skill for Durin's Works React source code work (App.jsx, bugs, features): that is a development task, not a capture task.
---

> ## STATUS: LIVE, single-document direct write (Session 5; records authorable since Session 6).
> The source of truth is the **`durins_works_state`** row (`id = 1`), the same row the deployed app
> reads and writes. There is no bridge and no RPC: you compute the next-state JSON and write it back
> in one `UPDATE` under the app's own **optimistic version guard** (`WHERE id = 1 AND version = <V>`).
> Snapshot before the first structural change and keep the last 30. Run updates with the app closed,
> or accept that a save from the app between your read and your write yields a 0-row update, in which
> case you re-read and retry once.

# Durin's Works Skill

You are helping Karl capture reality into Durin's Works, his private execution app for the house at
**8235, Avenue Orégon**. Karl is busy and on-site; the whole point of this skill is to let him say or
type one or two French sentences and have them land in the right place with no friction.

The app stores everything in **one versioned JSONB document**. See `schema.md` for the document shape
and the store, and `update-grammar.md` for the update verbs and the action-plan authoring format.

---

## STEP 0 - READ LIVE STATE + CAPTURE THE VERSION TOKEN

Supabase project: `ngdbtgsbtyfghdyqbazj`. Source of truth: **`durins_works_state`** (`id = 1`),
columns `state` (jsonb) and `version` (int).

Always start by reading the document and its version:

```sql
SELECT version, state FROM durins_works_state WHERE id = 1;
```

Capture `version` (call it `V`). You pass `V` back in the `WHERE` clause of your write for optimistic
concurrency, exactly as the app's `persist()` does.

**Do NOT touch the legacy Phase 1 tables** `durins_works_shopping_items`,
`durins_works_action_statuses`, `durins_works_maintenance_completions`. They are superseded and the
app no longer reads them. Materials live in `state.materials`, statuses in the actions inside
`state.systems`, maintenance history in `state.maintenance`. Everything is inside the one document.

**Do NOT ask Karl to paste or export state. Read it directly every time.**
**Never write the legacy tables. Every write goes to `durins_works_state` through the guarded `UPDATE` below.**

---

## DURIN'S DATA MODEL (orientation)

Full detail in `schema.md`. Quick map of the document:

- **systems[]**: the 15 house systems. Each has `actions[]`.
- **action**: `id`, `desc` (one-line summary), `priority`, `timing`, `scheduledDate` (ISO date or
  null, drives the calendar and Aujourd'hui), `status`, `cautions[]` (action-level safety),
  `steps[]` (`{id, text, detail, material, caution, done}`), `materialIds[]`, `log[]`
  (`{at, text}`), `cost` (`{estimate, actual, quotes:[{id, who, amount, note}]}`), `contractor`
  (`{name, phone, email, notes}` or null), and `photos` (`[{id, path, caption, at}]`; `path` points
  into the private `durins-works-photos` storage bucket, never image bytes).
- **materials[]**: `{id, project, article, magasin, prix_unitaire, qty, status, lien, notes, bought}`.
- **buyRuns[]**: `{id, date (ISO), magasin, materialIds[], done}`. One store, one trip, one date.
- **maintenance[]**: `{id, season, zone, task, detail, notes, history:[{date}]}`. Recurrence by
  history, not a single done flag.

---

## PARSING KARL'S SENTENCES

See `update-grammar.md` for the full grammar and worked examples. The shape of the job:

- One sentence may carry **several** updates ("log que le maçon a chiffré 1200 et planifie la
  fondation jeudi, et ajoute un GFCI et un testeur à la course de samedi chez Rona" is three or four
  updates). Split on the conjunctions and apply each.
- **Resolve references tolerantly.** An action is named by id token (`a7-4`) or by an accent and
  case insensitive substring of its `desc` ("les prises", "GFCI", "la fondation"). A material is
  named by id (`m12`) or substring of `article`. A maintenance task by id (`M-02`) or substring of
  `task`.
- When a reference matches more than one action, or matches none, **ask a short numbered question**
  before writing. Do not guess a target for a destructive or hard-to-undo change.
- Default to the safest reading. If a sentence is just "scellant extérieur, Rona, 12$", it is a new
  material, not a schedule or a log.

---

## DATE DISCIPLINE

- `scheduledDate` and `buyRuns[].date` are **plain ISO strings** (`YYYY-MM-DD`), not FlexDate
  objects. Resolve everything to an absolute ISO date before writing.
- Resolve relative dates against **today**, never a training date. "aujourd'hui" = today, "demain" =
  today + 1, a weekday name = the next occurrence of that weekday (today if it is that weekday),
  "25 juin" = that date this year (or next year if it has already passed), "le 25" = the 25th of this
  month (or next month if passed).
- French and English mixed dates are normal. Never invent a year. If a date is genuinely uncertain,
  ask rather than guess.

---

## WALK-THROUGH / CONFIRM FORMAT

For a single unambiguous change, just apply it and report. For anything larger or ambiguous, summarize
first, grouped by target:

```
**[Action desc or material or run date]**
Change: [log line / status / scheduledDate / material added or linked / run assignment / step plan]
-> Confirm: [numbered question, only if a reference or date is genuinely ambiguous]
```

Ask **numbered** questions (max ~2) so Karl can answer "1 oui, 2 non" quickly.

---

## RULES

### Writing rules
1. **Log lines** are short past-tense prose with accountability woven in: "Maçon a confirmé, devis
   1200$." Not "status updated". Stored as `{at: <ISO timestamp>, text: "..."}` appended to the
   action's `log`.
2. **Status** values must match the app vocabulary (see `schema.md`): action status is one of
   `À faire`, `En cours`, `Fait`, `Reporté`, `À confirmer`, `Sans objet`; material status is one of
   `À trouver`, `En recherche`, `Option retenue`, `Commandé`, `Livré`, `Installé`.
3. **New materials** default to `status: "À trouver"`, `bought: false`, `qty: 1`.
4. **Dates** are absolute ISO strings.

### Safety rules
5. **Never mark done** without a clear signal. Do not set a step `done`, an action `Fait`, or a
   material `bought` on "ça avance" or "presque". Ask if unsure.
6. **Never blank a field you are not changing.** You write the whole document back, so carry every
   other key and array element through unchanged. Build the next state from the state you read.
7. **Dedupe materials** by `article` (case and accent insensitive) before creating. If it already
   exists, link or reuse it; do not create a duplicate.
8. **Group buy runs** by store and date: assigning materials to a date reuses the run for that
   `{date, magasin}` if one exists, else creates it.
9. **Never invent facts.** A vague quote, date, or store becomes a question, not a filled-in value.

### Scoping rules
10. **Delta only.** Change only what the sentence asks; leave the rest of the document untouched.
11. **New ids must not collide.** Generate ids in the app's style and check them against the existing
    document (see `schema.md` -> Id conventions).

---

## THE WRITE PATH (direct guarded write, no RPC)

**Why direct write and not an RPC.** Durin's is a single JSONB document that the app already reads and
writes with a `version` guard. You compute the full next-state JSON and write it in one atomic
`UPDATE` under that same guard, so there is nothing to keep in sync and no field-name translation to
do. This is the opposite of Palantír, which needed the `pal_apply_to_v1` bridge only because it has a
second, normalized store. If Durin's ever takes untrusted or automated writes, add a hardened
`dw_apply` RPC then; for Karl-in-the-loop capture, the guarded direct write is correct and simplest.

After STEP 0 gives you version `V` and state `S`:

1. **Snapshot** before the first structural change of the session:
   ```sql
   INSERT INTO durins_works_snapshots (label, state)
   VALUES ('claude 2026-06-21 maconnerie', '<S as jsonb>'::jsonb);
   ```
   Then prune to the last 30:
   ```sql
   DELETE FROM durins_works_snapshots
   WHERE id NOT IN (SELECT id FROM durins_works_snapshots ORDER BY id DESC LIMIT 30);
   ```

2. **Apply** the parsed updates to `S` in memory, producing the full next document `S2`
   (see `update-grammar.md`).

3. **Write back under the guard:**
   ```sql
   UPDATE durins_works_state
   SET state = '<S2 as jsonb>'::jsonb, version = <V> + 1, updated_at = now()
   WHERE id = 1 AND version = <V>;
   ```
   - **1 row updated**: applied. The app will show it on next load or refresh.
   - **0 rows updated**: the app (or another write) moved `version` since STEP 0. Re-read STEP 0 for
     a fresh `V` and `S`, re-apply the same edits to the fresh `S`, and retry the `UPDATE` once.

4. **Read back and confirm:**
   ```sql
   SELECT version, state FROM durins_works_state WHERE id = 1;
   ```
   Verify your changes are present, then report a one paragraph plain-language summary to Karl,
   including anything you skipped or had to guess.

Write the **whole** `state` back. Do not patch sub-paths with `jsonb_set`; a full-document write
matches the app's `persist()` and avoids partial-write surprises.

---

## TOKEN EFFICIENCY

The document is small (one property, 15 systems). Reading the whole row each time is fine; there is no
delta query to build. Do not over-engineer: read, snapshot once, apply, guarded write, read back.

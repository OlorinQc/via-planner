# Durin's Works - Update Grammar and Authoring Format

How to turn Karl's sentences into edits on the `state` document, then write the whole document back
under the version guard (see `SKILL.md` -> THE WRITE PATH). There is no RPC: each verb below is an
in-memory edit to the JSON you read. One sentence may carry several verbs; apply them all to the same
next-state document, then do one guarded `UPDATE`.

Resolution is shared by every verb: an **action** is found by id (`a7-4`) or accent and case
insensitive substring of `desc`; a **material** by id (`m12`) or substring of `article`; a
**maintenance task** by id (`M-02`) or substring of `task`. Ambiguous or no match means ask, do not
guess.

---

## Verbs

### 1. logToAdd - append a journal line to an action
Find the action, append to its `log`:
```jsonc
action.log.push({ "at": "<now ISO>", "text": "Macon a confirme, devis 1200$" })
```
"log que le macon a chiffre 1200 sur la fondation" -> append to `a4-1` (or whichever foundation
action), text in short past-tense prose.

### 2. setActionStatus - set an action's status
Set `action.status` to a value from the vocabulary (`schema.md`).
"marque les prises GFCI en cours" -> `a7-4.status = "En cours"`.
"la fondation est faite" -> `a4-1.status = "Fait"` (only on a clear completion signal).

### 3. setActionSchedule - set or clear scheduledDate
Resolve the date to ISO (see Date discipline). "book the foundation for Thursday" /
"planifie la fondation jeudi" -> `a4-1.scheduledDate = "2026-06-25"`. "deplanifie la fondation" /
"enleve la date" -> `a4-1.scheduledDate = null`.

### 4. addMaterial - create a material
Dedupe by `article` first (case and accent insensitive). If new, push to `state.materials`:
```jsonc
{ "id": "m<base>", "project": "Électricité", "article": "Prise GFCI 15A", "magasin": "Rona",
  "prix_unitaire": 25, "qty": 2, "status": "À trouver", "lien": "", "notes": "", "bought": false }
```
"ajoute une prise GFCI 15A, Rona, 25$ x2, pour electricite" -> one new material as above. Omit fields
you do not know (`prix_unitaire: null`, `magasin: ""`).

### 5. linkMaterial - attach a material to an action
Ensure the material exists (verb 4 if new), then add its id to the action's `materialIds` (no
duplicates):
```jsonc
if (!action.materialIds.includes(id)) action.materialIds.push(id)
```
"lie le testeur de tension a l'action GFCI" -> link `m13` to `a7-4`.

### 6. assignToRun - put materials into a dated shopping run (create or extend, grouped by store)
Ensure each material exists (create if new, verb 4). Then:
- **If the sentence names a store** (`chez Rona`), that store is the run. Set `magasin` to the named
  store on **every** assigned material (new and existing) before grouping, so they all share one
  trip. This honors Karl's words even if an existing material was tentatively sourced elsewhere.
- **If no store is named**, group materials by their existing `magasin` (the app's Achats default),
  which can produce several runs in one call.

For each resulting store, find an existing `buyRun` with the same `date` and `magasin`; reuse it,
else create one. Add the material ids (no duplicates).
```jsonc
// new run when none matches {date, magasin}
{ "id": "r<base>", "date": "2026-06-27", "magasin": "Rona", "materialIds": ["m12","m13"], "done": false }
```
"ajoute un GFCI et un testeur a la course de samedi chez Rona" -> set both materials' `magasin` to
"Rona" (creating the GFCI if new), then create or extend the Rona run on the resolved Saturday with
both. To also mark them bought (verb 7), do so in the same write.

### 7. markBought - mark a material bought
Set `material.bought = true` (find by id or article). "j'ai achete le scellant" -> `m6.bought = true`.
To undo: `bought = false`.

### 8. toggleMaint - record a maintenance completion
Append `{ "date": "<today ISO>" }` to the maintenance task's `history` (skip if the same date is
already there). "j'ai nettoye les gouttieres" -> append today's date to `M-02.history`. To undo a
same-day check, remove today's entry.

### 9. applyPlan - attach a section 7 action plan to an action
Parse the authoring format below into steps, cautions, and materials, then on the target action:
- set `action.steps` to the parsed steps, each `{ id: "st<base>_<i>", text, detail, material,
  caution, done: false }`;
- set `action.cautions` to the parsed précautions;
- for each parsed material: dedupe by `article`, create if new, and link its id into
  `action.materialIds`.

### 10. setCost - set an action's estimate or actual amount
On `action.cost` (create `{ estimate: null, actual: null, quotes: [] }` if missing), set `estimate`
and/or `actual` to a plain number or null. Carry the rest of `cost` through.
"l'estimé de la fondation est 1500" -> `a4-1.cost.estimate = 1500`. "le coût réel des prises GFCI est
980$" -> `a7-4.cost.actual = 980`. Never wrap the amount in a currency object.

### 11. addQuote - add (or edit / remove) a contractor quote on an action
Push to `action.cost.quotes` a `{ id: "q<base>", who, amount, note }` (amount a number or null).
"devis du maçon Tremblay à 1200 sur la fondation" -> push `{ who: "Maçonnerie Tremblay", amount: 1200,
note: "" }` to `a4-1.cost.quotes`. To edit, match the quote by `id` or `who` and change its fields; to
remove, filter it out. Adding a quote does not change `estimate` or `actual`.

### 12. setContractor - set the action's contractor card
Set `action.contractor` to `{ name, phone, email, notes }`, or `null` when nothing is known. Carry
fields you are not changing. "l'électricien c'est Hydro-Pro, 514-555-0199" -> `a7-4.contractor =
{ name: "Hydro-Pro", phone: "514-555-0199", email: "", notes: "" }`. "enlève l'entrepreneur" ->
`contractor = null`.

### 13. addPhotoLink - attach a photo by path or URL
Push to `action.photos` a `{ id: "ph<base>", path, caption, at: "<now ISO>" }`. The app uploads photos
from the phone into the private `durins-works-photos` bucket and stores only the object `path`; from
this skill you can attach a photo only when Karl gives you a path or URL, since you cannot upload a
file. "ajoute la photo <path> sur la fondation, légende fissure" -> push with `caption: "fissure"`.
Never embed image bytes or base64 in the document.

---

## Worked example: one sentence, several verbs

Karl says:
> log que le macon a chiffre 1200 et planifie la fondation jeudi, et ajoute un GFCI et un testeur a la course de samedi chez Rona

Resolved against the document (today = 2026-06-21, a Sunday):
1. **logToAdd** on the foundation action `a4-1`: append `{ at: "2026-06-21T...Z", text: "Macon a
   chiffre 1200$" }`.
2. **setActionSchedule** on `a4-1`: `scheduledDate = "2026-06-25"` (Thursday).
3. **addMaterial** x2 (deduped): `Prise GFCI 15A` and `Testeur de tension`, both `magasin: "Rona"`,
   `status: "À trouver"`, new ids `m<base>`, `m<base>_1`.
4. **assignToRun**: Saturday is `2026-06-27`; create the Rona run `r<base>` on that date with both
   new material ids.

Then one guarded write:
```sql
UPDATE durins_works_state
SET state = '<full next document>'::jsonb, version = <V> + 1, updated_at = now()
WHERE id = 1 AND version = <V>;
```
(Snapshot first; prune to 30; read back to confirm. See `SKILL.md`.)

---

## Section 7 authoring format (restated)

The standard format for injecting a researched plan into an action, by hand or via Claude. Each plan
provides ordered steps (each a short instruction plus an optional fuller `detail`, an optional
`material`, and an optional per-step `caution`), a list of action-level précautions, and the
materials. Example, exactly as Karl will dictate or paste:

```
ACTION: a7-4  Corriger les prises a risque (GFCI)
PRÉCAUTIONS:
  - Couper l'electricite au panneau avant tout travail
  - Confirmer l'absence de tension avec un testeur
ÉTAPES:
  1. Couper le disjoncteur du circuit
     detail: Mettre le bon disjoncteur a OFF; confirmer avec une lampe si non etiquete.
     caution: Couper au panneau, pas seulement l'interrupteur
  2. Verifier l'absence de tension a la prise
     material: Testeur de tension sans contact
  3. Installer la prise GFCI (LINE / LOAD respectes)
     material: Prise GFCI 15A
  4. Retablir le courant et tester (test / reset)
MATÉRIAUX:
  - Prise GFCI 15A x2 (Rona, ~25$)
  - Testeur de tension sans contact (Canadian Tire, ~30$)
```

Parsing rules:
- `ACTION:` carries the target. Prefer the id token (`a7-4`); the trailing text is just a label.
- `PRÉCAUTIONS:` lines (each starting with `-`) become `action.cautions` (strings).
- `ÉTAPES:` numbered lines become steps. Indented `detail:`, `material:`, `caution:` lines attach to
  the step above. A non-keyword indented line continues the previous field.
- `MATÉRIAUX:` lines become materials. The trailing parenthesis is parsed: a bare token is the
  `magasin`, `~25$` or `25$` is the `prix_unitaire`, `x2` is the `qty`; the rest is the `article`.

This round-trips with the in-app "Coller un plan" parser, so a plan authored here applies the same
whether pasted into the app or written through this skill.

### Result of parsing the example above

```jsonc
// on action a7-4:
"cautions": [
  "Couper l'electricite au panneau avant tout travail",
  "Confirmer l'absence de tension avec un testeur"
],
"steps": [
  { "id": "st<base>_0", "text": "Couper le disjoncteur du circuit",
    "detail": "Mettre le bon disjoncteur a OFF; confirmer avec une lampe si non etiquete.",
    "material": "", "caution": "Couper au panneau, pas seulement l'interrupteur", "done": false },
  { "id": "st<base>_1", "text": "Verifier l'absence de tension a la prise",
    "detail": "", "material": "Testeur de tension sans contact", "caution": "", "done": false },
  { "id": "st<base>_2", "text": "Installer la prise GFCI (LINE / LOAD respectes)",
    "detail": "", "material": "Prise GFCI 15A", "caution": "", "done": false },
  { "id": "st<base>_3", "text": "Retablir le courant et tester (test / reset)",
    "detail": "", "material": "", "caution": "", "done": false }
]
// plus two materials created (deduped) and linked into a7-4.materialIds:
//   Prise GFCI 15A  -> magasin "Rona", prix_unitaire 25, qty 2
//   Testeur de tension sans contact -> magasin "Canadian Tire", prix_unitaire 30, qty 1
```

# Durin's Works - Schema Reference

Everything lives in **one versioned JSONB document**. The blueprint rejected normalized tables on
purpose: the data is tiny and single-user, so joins buy nothing while costing write complexity.

## The store

Supabase project `ngdbtgsbtyfghdyqbazj`.

### durins_works_state (the source of truth, one row)
| column | type | notes |
|---|---|---|
| id | int4 | always `1` (check constraint `id = 1`) |
| state | jsonb | the whole document (shape below) |
| version | int4 | optimistic concurrency guard, default 1 |
| updated_at | timestamptz | set to `now()` on every write |

### durins_works_snapshots (restore points)
| column | type | notes |
|---|---|---|
| id | bigint identity | ordering key for prune-to-30 |
| label | text | free text, e.g. `claude 2026-06-21 maconnerie` |
| state | jsonb | full document copy taken before a change |
| created_at | timestamptz | default `now()` |

### Legacy, do NOT use
`durins_works_shopping_items`, `durins_works_action_statuses`,
`durins_works_maintenance_completions` are Phase 1 tables, superseded by the single document. The
deployed app does not read them. Never read or write them from this skill.

## Guard contract

Read `version` with the state. Write with `... WHERE id = 1 AND version = <that version>` and set
`version = <that version> + 1`. A 0-row result means someone wrote between your read and your write:
re-read, re-apply, retry once. This is the same contract the app's `persist()` uses, which is why the
skill and the app can both write safely.

---

## The document shape (state)

```jsonc
{
  "meta": { "address": "8235, Avenue Orégon", "schemaVersion": 2 },

  "systems": [
    {
      "id": "s7", "name": "Électricité", "zone": "Maison",
      "ceQueOnSait": "...", "pourquoi": "...",          // system context, preserved verbatim
      "priority": "Danger", "timing": "Été 2026",
      "source": "INSP-P39-43", "notes": "...",
      "actions": [
        {
          "id": "a7-4", "desc": "Corriger les prises a risque (GFCI)",  // one-line summary
          "priority": "Danger", "timing": "Été 2026",
          "scheduledDate": null,                          // ISO "YYYY-MM-DD" or null
          "status": "À faire",
          "cautions": ["Couper l'electricite au panneau avant tout travail"],
          "steps": [
            { "id": "st1", "text": "Couper le disjoncteur", "detail": "...",
              "material": "Testeur de tension", "caution": "Couper au panneau", "done": false }
          ],
          "materialIds": ["m12", "m13"],                  // ids into state.materials
          "log": [{ "at": "2026-06-21T14:00:00.000Z", "text": "Macon a confirme, devis 1200$" }],
          "cost": { "estimate": null, "actual": null, "quotes": [] },   // Session 6, do not author
          "contractor": null,                              // Session 6, do not author
          "photos": [],                                    // Session 6, do not author
          "composantes": ["ELEC-PRISE-001"], "source": "INSP-P42-43", "notes": "..."
        }
      ]
    }
  ],

  "materials": [
    { "id": "m1", "project": "Îlot de cuisine", "article": "SEKTION base cabinet",
      "magasin": "IKEA", "prix_unitaire": 224, "qty": 2, "status": "En recherche",
      "lien": "https://...", "notes": "...", "bought": false, "sort_order": 1 }
  ],

  "buyRuns": [
    { "id": "r1", "date": "2026-06-27", "magasin": "Rona", "materialIds": ["m12","m13"], "done": false }
  ],

  "maintenance": [
    { "id": "M-02", "season": "Printemps + automne", "zone": "Extérieur",
      "task": "Nettoyer les gouttieres", "detail": "...", "notes": "...",
      "history": [{ "date": "2026-04-15" }] }     // recurrence: each completion appends a {date}
  ]
}
```

## Derived surfaces (computed by the app, never stored)

Knowing these tells you how a write will surface:
- **Aujourd'hui (work)**: actions where `scheduledDate <= today` and `status != Fait`.
- **Aujourd'hui (buy)** and **Calendrier cart chips**: `buyRuns` on that date, plus their materials.
- **Calendrier work chips**: actions by `scheduledDate`, colored by `priority`.
- **Achats buckets**: "à planifier" (material in no run, `bought` false), "courses planifiées"
  (grouped by run date), "achetés" (`bought` true), "tout".
- **Project materials**: union of `materialIds` across a system's actions.
- **Maintenance due**: tasks whose `season` matches the current season and whose last `history`
  entry is not the current cycle.

## Vocabularies (must match the app, exact strings)

- **Action status**: `À faire`, `En cours`, `Fait`, `Reporté`, `À confirmer`, `Sans objet`.
- **Material status**: `À trouver`, `En recherche`, `Option retenue`, `Commandé`, `Livré`, `Installé`.
- **Priority** (action and system): `Urgent`, `Danger`, `Défaut`, `Avertissement`, `Surveillance`,
  `Info`, `Limité`, `Hors mandat`, `—`.

These are not validated on write, so a typo becomes bad data. Copy them exactly, accents included.

## Id conventions

Match the app's id style and check against the existing document so you never collide:
- Material: `"m" + <timestamp>` (the app uses `m` followed by `Date.now()`). Scan existing
  `materials[].id`; pick a value not already present.
- Buy run: `"r" + <timestamp>` (optionally `"_" + index` when creating several at once).
- Step: `"st" + <timestamp> + "_" + index` within an action's `steps`.
- Systems, actions, and maintenance ids are seeded (`s7`, `a7-4`, `M-02`) and you do not invent new
  ones; you reference them.

A simple safe scheme: take `base = Date.now()` once, then use `m<base>`, `m<base>_1`, `r<base>`,
`st<base>_0`, etc., for everything created in this one write.

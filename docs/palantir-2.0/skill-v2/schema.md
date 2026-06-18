# Palantír 2.0 — Schema Reference (pal_ tables)

The single `palantir_state` JSONB row is replaced by normalized `pal_` tables.
The v1 row is kept frozen as a fallback and `pal_export_state()` still rebuilds the
exact v1 JSON shape (version `1.0`), so the old restore path keeps working until cutover.

**Read** current state with either:
- `SELECT pal_export_state();` — full v1-shaped JSON (use for a weekly full review), or
- direct `pal_` queries scoped to the files in Karl's notes (use for daily deltas, cheaper).

**Write** only through `SELECT pal_apply_update('<package>'::jsonb);` — never `UPDATE`/`INSERT`
the tables directly, and never touch `palantir_state`. See `update-package.md`.

---

## v1 → v2 mapping

| v1 concept | v2 home |
|---|---|
| `files[]` | `pal_files` |
| `deliverables[]` | `pal_outputs` (a file's optional "outputs") |
| `tasks[]` | `pal_tasks` (`source <> 'milestone'`) |
| `files[].milestones[]` | `pal_tasks` with `source = 'milestone'` |
| `files[].risks[]` + `files[].openQuestions[]` | `pal_flags` (`kind` = `risk`/`blocker`/`question`) |
| `files[].log[]` | `pal_events` (`kind = 'log'`) |
| `files[].sharePointLinks[]` | `pal_links` |
| `people[]` | `pal_people` |
| `uiPrefs`, `templates`, `linkTypes`, `deliverableTypes` | `pal_prefs` (key/value) |
| change history | `pal_events` (one stream) |

---

## Tables

### pal_people
| column | type | notes |
|---|---|---|
| id | text PK | `gen_random_uuid()::text` |
| name | text NOT NULL UNIQUE | dedupe key (case-insensitive in code) |
| title | text default `''` | |
| active | boolean default true | |
| created_at / updated_at | timestamptz | |

### pal_files
| column | type | notes |
|---|---|---|
| id | text PK | |
| title | text NOT NULL | |
| status | text NOT NULL default `active` | `active` \| `monitoring` \| `paused` \| `completed` |
| priority | text NOT NULL default `medium` | `urgent` \| `high` \| `medium` \| `low` |
| sensitivity | text default `low` | `low` \| `medium` \| `high` |
| lead_id | text → pal_people(id) | |
| campaign_id | text → pal_campaigns(id) | schema present, UI later |
| memory | text default `''` | HTML, carried as-is from v1. Nullable in DB; do not blank it accidentally |
| archived | boolean default false | NOT-NULL semantics in code; never set to null |
| archived_at | date | |
| created_at / updated_at | timestamptz | |

### pal_outputs  (v1 "deliverables")
| column | type | notes |
|---|---|---|
| id | text PK | |
| file_id | text NOT NULL → pal_files(id) | |
| title | text NOT NULL | |
| type | text default `other` | |
| status | text default `not_started` | |
| owner_id | text → pal_people(id) | |
| due | jsonb | **FlexDate** |
| publication | jsonb | **FlexDate** |
| approval_status | text default `not_required` | |
| sharepoint_url | text default `''` | |
| notes | text default `''` | |
| sort_order | double precision default 0 | |
| created_at / updated_at | timestamptz | |

### pal_tasks
| column | type | notes |
|---|---|---|
| id | text PK | |
| file_id | text → pal_files(id) | |
| output_id | text → pal_outputs(id) | set when the task belongs to an output |
| title | text NOT NULL | |
| status | text NOT NULL default `not_started` | e.g. `not_started` \| `in_progress` \| `completed` |
| due | jsonb | **FlexDate** |
| assignee_ids | text[] default `{}` | resolved from names by the RPC |
| depends_on | text[] default `{}` | |
| notes | text default `''` | |
| gate | text default `''` | |
| source | text default `manual` | `manual` \| `claude_import` \| `template` \| `milestone` \| `capture` |
| sort_order | double precision default 0 | |
| completed_at | date | set automatically when status → completed |
| created_at / updated_at | timestamptz | |

### pal_flags  (v1 risks + open questions)
| column | type | notes |
|---|---|---|
| id | text PK | |
| file_id | text NOT NULL → pal_files(id) | |
| kind | text NOT NULL default `question` | `question` \| `risk` \| `blocker` |
| text | text NOT NULL | the risk/question itself |
| detail | text default `''` | v1 risk description |
| severity | text | `low` \| `medium` \| `high`; null for questions |
| owner_id | text → pal_people(id) | |
| status | text default `open` | `open` \| `resolved` \| `dropped` (+ v1 verbatim: `monitoring`, `answered`) |
| resolution | text default `''` | |
| created_at | timestamptz | |
| resolved_at | date | |

### pal_links
| column | type | notes |
|---|---|---|
| id | text PK | |
| file_id | text NOT NULL → pal_files(id) | |
| label | text default `''` | |
| url | text NOT NULL | |
| type | text default `folder` | |
| created_at | timestamptz | |

### pal_events  (change log + file Log, one stream)
| column | type | notes |
|---|---|---|
| id | text PK | |
| file_id | text | soft ref; survives file deletion |
| entity | text | `file` \| `task` \| `output` \| `flag` \| `link` \| `person` \| `import` |
| entity_id | text | |
| kind | text NOT NULL | `log` \| `create` \| `update` \| `complete` \| `delete` \| `merge` \| `import` \| `archive` |
| summary | text default `''` | |
| actor | text default `karl` | `karl` \| `claude` |
| payload | jsonb | for `delete`/`merge`, carries the archived row or move counts |
| package_id | text | set on every row written by `pal_apply_update` |
| event_date | date default CURRENT_DATE | for migrated log entries that carry their own date |
| created_at | timestamptz | |

### pal_prefs
key (text PK) / value (jsonb) / updated_at. Holds `uiPrefs_v1`, `templates`, `linkTypes`, `deliverableTypes`.

### pal_campaigns
id / title / status (default `active`) / notes / timestamps. Schema only for now; no UI.

---

## FlexDate (jsonb)

`due` and `publication` are FlexDate objects, not plain dates:

```json
{ "precision": "exact", "date": "2026-07-01", "confidence": "confirmed" }
```

- `precision`: `exact` | `week` | `month` | `tbd`
- The RPC's `pal_norm_flexdate()` accepts either a FlexDate object (passed through) **or**
  a plain `"YYYY-MM-DD"` string (auto-wrapped to `precision: exact, confidence: confirmed`).
  Invalid strings normalize to `NULL` rather than erroring.

---

## Idempotency & integrity

- Unique partial index `idx_pal_events_pkg_import` = one `import` event per `package_id`.
  Re-applying the same `packageId` is a safe **noop**.
- Every row a package writes carries that `package_id`, so a package is fully traceable in `pal_events`.
- `pal_apply_update` snapshots **before** applying (trigger `pre_import`) via `pal_snapshot`,
  which writes to `palantir_snapshots` (visible in the app).

---

## Access model (post Session 2 hardening)

- Functions are **SECURITY INVOKER**. `search_path` is pinned to `public, extensions, pg_temp`.
- The work-chat Supabase connector executes as `postgres` (`rolbypassrls`), so it reads/writes
  regardless of RLS. The React app executes as `authenticated`, which the `pal_auth_all`
  policy (USING/CHECK true) permits.
- `anon` has **no** EXECUTE on `pal_apply_update` / `pal_snapshot` / `pal_export_state`;
  `pal_migrate_from_v1` is `service_role` only.

# Palantír 2.0 — Sessions 4 & 5a Report (v2 UI rebuild: scaffold + editing parity, first slice)

Date: 2026-06-19 (Opus, Cowork). Project `ngdbtgsbtyfghdyqbazj`.
Both sessions were run back to back. v2 lives in a parallel tree and route so v1 keeps running
untouched until cutover (Session 6). v1 `src/apps/Palantir/App.jsx` is byte-identical (252,942 bytes,
May 28) throughout.

## 1. Scope delivered

- **Session 4 (read-only scaffold).** The blueprint's App-scaffold milestone: multi-file structure,
  theme, data layer, store + Realtime, and the Files list plus file page READ-ONLY at `/palantir2`.
- **Session 5a (editing parity, first slice).** The file page becomes writable on the app's first
  write path to `pal_`, with the 4.2b interaction primitives (mini calendar, hover pill, selection +
  batch bar, undo-on-toast) and the inline edits that reuse them. Capture, drag, and a few section
  edits are deferred to 5b (section 4).

## 2. Architecture

### 2.1 Structure (`src/apps/Palantir/v2/`)

```
App.jsx            thin shell: nav, font-scale, store provider, toast host + batch bar
theme.js           T tokens, 5-size type scale, rem-style scaling (scoped --pal-scale var), status maps
data/
  client.js        reads: one query per pal_ entity (Promise.all) + Realtime subscribe
  mutations.js     writes: updateRow / getV1UpdatedAt / exportV1 / writeV1
  store.jsx        context: model, Realtime, write actions, undo toasts, selection
  derive.js        ALL selectors (filter, group, fileTree, staleness, portfolio, search blob)
  flexdate.js      FlexDate make / format / compare
components/        primitives, HierarchyList (the one tree renderer), overlay (popover + hover btn),
                   MiniCalendar, PersonPicker, HoverPill, Toasts, BatchBar
views/             Files.jsx, FilePage.jsx
```

Route added in `src/main.jsx`: `/palantir2`. `/palantir` (v1) is unchanged.

### 2.2 Read path (Session 4)

v2 reads the normalized `pal_` tables directly via the app's authenticated Supabase client, builds a
model once per change in `derive.js` (views never filter entities themselves), and renders the
file -> output -> task tree through a single `HierarchyList` so the v1 seven-renderer duplication is
structurally impossible. Realtime is subscribed on all `pal_` tables with a debounced refetch.

### 2.3 Write path (Session 5a) — the load-bearing decision

Pre-cutover, `palantir_state` is still canonical: v1 reads it and the daily chat bridge rebuilds
`pal_` from it on every update. So any `pal_` write the app makes would be lost on the next chat
update unless `palantir_state` also reflects it.

**Chosen model:** optimistic row-level write to the `pal_` row (instant UI), then a debounced sync
that calls `pal_export_state()` and upserts the result into `palantir_state`, guarded by
`updated_at` (if it advanced underneath, the app reloads instead of clobbering). A `selfWriteUntil`
window suppresses the app's own Realtime echo so its writes do not trigger a redundant refetch.

This gives the blueprint's clean row-level writes now, keeps `palantir_state` canonical so v1 and the
bridge keep working and the step stays fully reversible, and uses only authenticated-callable
functions. At cutover (Session 6) the `palantir_state` sync is simply dropped and `pal_` becomes sole
canonical, so the row-write code carries forward with almost no rework.

**ACLs that make this the only sound option** (verified live):

| function | security | authenticated EXECUTE |
|---|---|---|
| `pal_apply_update` | invoker | yes |
| `pal_apply_to_v1` (bridge) | invoker | yes, but internally calls migrate, so it fails for the app |
| `pal_export_state` | invoker | yes |
| `pal_migrate_from_v1` | invoker | **no** (service_role only) |
| `pal_snapshot` | invoker | yes |

Because the bridge calls `pal_migrate_from_v1` (service_role only), the app cannot drive the bridge
directly; row writes + `pal_export_state` is the authenticated-safe path. RLS on `pal_` tables is
`authenticated / ALL / true`; `palantir_state` policy is `auth.uid() = user_id` (the app already
upserts it this way in v1).

## 3. Interaction primitives (4.2b)

- **MiniCalendar** is the universal date picker, replacing v1 `FlexDateInput` app-wide: month grid,
  Today / Tmrw / next Mon / TBD, a `w/o` button per week row (week-of), `m/o` by the month title
  (month-of), and a confirmed / tentative toggle. Emits a real FlexDate.
- **HoverPill** floats on row hover and overlays the right edge with no content shift; opens the
  calendar / person popovers. **AnchoredPopover** handles positioning, flip, and click-outside / Esc.
- **PersonPicker** is the initials strip (multi-toggle for assignees, single for owner / lead).
- **Toasts** give act-now plus Undo for 8 seconds; `window.confirm` does not exist in v2.
- **BatchBar** with one selection model: click rows to select, then date / reassign / done / clear;
  Esc clears.
- Visual rules: status = dot, priority = bar, date = chip; five-size type scale; rem-style font slider.

## 4. Editable now vs deferred to 5b

**Editable (5a):** task complete / reopen and mid-status display, task and output dates, task
assignees, output owner, file header chips (status / priority / lead / sensitivity), Memory (inline
contenteditable, saved on blur); batch date / assign / done; undo on all of it.

**Deferred to 5b:** ghost-row capture with the chip composer and grammar tokens, the drag engine
(reorder, task to/from output, refile, output reorder), the pill's third button (relink to output),
and Flags / Links / History editing (those sections are read-only in 5a).

## 5. Pre-build data step (M2 resync)

Before Session 4, snapshot #27 then `SELECT pal_migrate_from_v1()` so `pal_` matched current canonical:
47 files, 220 tasks (incl. 5 milestones promoted to dated tasks), 15 outputs, 12 people, 9 flags,
10 links, 51 log events; 0 orphans, 0 dup-id remaps. Touches only `pal_`, never `palantir_state`.

## 6. Verification

- **Build:** clean `vite build`, 101 modules, v1 and v2 both bundled; all 5a string markers present.
- **Write path, live and reversible:** on a real Dorval task (`p1778885900146`, `not_started`) wrote
  `pal_tasks.status = completed`, confirmed `pal_export_state` (what the sync pushes to
  `palantir_state`) emitted `completed`, then reverted. Task back to `not_started`, `completed_at`
  null, 220 tasks intact, `palantir_state` never mutated.
- **v1 untouched:** `App.jsx` byte-identical.
- In-browser behavior (hover pills, popovers, Realtime delivery, authenticated writes) is to be
  exercised by Karl at `/palantir2`.

## 7. Host / sandbox desync incident (and the standing rule)

The Cowork host file tools and the build sandbox desynced repeatedly this session: **overwriting an
existing file** (store.jsx, HierarchyList.jsx, FilePage.jsx) or **editing one** (App.jsx, main.jsx)
left a truncated copy in the sandbox build view, while brand-new files synced fine. Each was caught by
the build / `wc -l` and rewritten via a `bash` heredoc, which writes through the sandbox reliably. The
files on disk are now whole and correct. Rule going forward: after host-editing or overwriting an
existing file in this repo, confirm the sandbox sees full content (`wc -l` or a build) before trusting
it; prefer heredoc for overwrites.

## 8. Known caveats

- The 5 former milestones render as dated tasks in v2 but remain milestones in v1; expected, per the
  blueprint, just a difference to know when comparing the two side by side.
- Pre-existing v1 bug found while building, not fixed (out of scope): duplicate `position` key in
  `App.jsx` near line 1058 (KanbanView column header sets `sticky` then `relative`), so that sticky
  header is likely broken. Candidate for a small standalone fix.
- Repo path is `02.Claude Apps/Karl's Apps/kh-tools` (the palantir-dev skill path string omits the
  `Karl's Apps` segment).

## 9. Next

- **Session 5b:** capture (ghost rows + chip composer + grammar tokens), the drag engine, the relink
  pill, and Flags / Links / History editing. 5b mostly applies the primitives 5a invented, so it is
  more mechanical; model choice (Opus vs Sonnet) is Karl's call.
- **Session 6:** Today + Activity, then cutover (M4): route swap and drop the `palantir_state` sync so
  `pal_` becomes sole canonical.

## 10. Git

Committed by Karl. Files: `src/main.jsx` (the `/palantir2` route) and `src/apps/Palantir/v2/` (17 files).

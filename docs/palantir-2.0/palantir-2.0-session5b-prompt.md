# Palantír 2.0 — Session 5b kickoff prompt

Paste the block below into a new Cowork chat to start Session 5b.

---

Start Palantír 2.0 Session 5b: the second editing slice on the v2 file page.

Model: Sonnet is fine for most of 5b since it mainly applies the interaction
primitives 5a already built. The drag engine is the one genuinely fiddly part,
so switch to Opus for that piece if it gets hairy.

Status, do not redo: Sessions 1-3 (pal_ schema, hardened apply engine,
pal_apply_to_v1 bridge, skill v2 installed and live for daily updates) are
complete and live on Supabase ngdbtgsbtyfghdyqbazj, with palantir_state as the
canonical row. Session 4 (read-only v2 scaffold) and Session 5a (editing parity,
first slice) are done and committed: v2 lives at /palantir2 (route in
src/main.jsx), v1 is untouched at /palantir. The v2 write path already exists in
src/apps/Palantir/v2/data/store.jsx + mutations.js: optimistic row-level writes
to pal_ tables, then a debounced pal_export_state() -> palantir_state upsert
(updated_at guarded), reversible, with undo-on-toast. Already editable: task
done/status, task and output dates (MiniCalendar), assignees and owner
(PersonPicker via the hover pill), file header chips, and Memory inline; plus one
selection model and a batch bar.

For this session: load my project memory and the docs in
kh-tools/docs/palantir-2.0/ (palantir-2.0-phase2-blueprint.md and its binding
section 4.2b interaction standard, palantir-2.0-phase1b-interaction-audit.md,
palantir-2.0-mockups.html, and palantir-2.0-session4-5a-report.md). Approve the
kh-tools folder when prompted (it is under "Karl's Apps"). Then read the relevant
v2 source (data/store.jsx, components/HierarchyList.jsx, HoverPill.jsx,
MiniCalendar.jsx, views/FilePage.jsx, Files.jsx) and, before writing any code,
propose the Session 5b scope, sequence, and plan for my approval.

Session 5b scope per the blueprint and 4.2b: ghost-row capture (the chip composer
with grammar tokens like @wa, "w/o jun 15", "> output:", "Q:", parsing live into
removable chips, keyboard fast lane only, never required); the drag engine (task
reorder, task to and from an output, drag a task onto a file card to refile,
output-header reorder); the hover pill's third button (relink a task to an
output); and editing for the Flags, Links, and History sections (resolve a flag,
paste-first add a link, one-line log composer). The mockup's JS has reference
implementations to adapt into React (lineButtons, flexDateScan grammar, the drag
handlers, the meeting-tree drag).

Build rules: keep every v2 pattern from 5a (row-level writes through the store
actions, undo over confirm, the single HierarchyList renderer, inline styles, no
window.confirm). Critical environment note: this repo has a host/sandbox desync
where overwriting or editing an existing file can leave a truncated copy in the
build sandbox while brand-new files sync fine. After any overwrite or edit,
verify the sandbox sees full content (wc -l or a build) before trusting it, and
prefer writing via a bash heredoc for overwrites. Finish with a green vite build
(build to a temp outDir to avoid the dist EPERM), a reversible live round-trip
test of any new write, confirmation that v1 App.jsx is byte-identical, and one
chained git line for me to run.

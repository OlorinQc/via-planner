# Session 1 kickoff prompt (copy-paste into a fresh Cowork session)

Palantír 2.0, Session 1: Foundation. Use Sonnet.

Mount my project folder: C:\Users\KarlH\Documents\02.Claude Apps\kh-tools

Context loading, in order:
1. Project memory (palantir-2-redesign, palantir-environments) has the decisions and status.
2. Read docs/palantir-2.0/palantir-2.0-phase2-blueprint.md: sections 2 (schema and functions), 3 (update loop), 4.2b (binding interaction standard, context only this session), 5 (migration plan), 6 (build plan).
3. Read docs/palantir-2.0/palantir-2.0-session1-draft.sql in full. It is a reviewed-by-me draft, not gospel.

Mission (blueprint Session 1 = migration steps M0, M1, M2):
1. M0 safety: read palantir_state (id=1) from Supabase project ngdbtgsbtyfghdyqbazj, save the full JSON to docs/palantir-2.0/backups/palantir-v1-YYYY-MM-DD.json, and take a manual snapshot labeled "M0 before 2.0 foundation".
2. Review and correct the draft SQL before executing anything. Known gaps to fix: complete the stubbed verbs in pal_apply_update (flagsToCreate, flagsToResolve, outputsToCreate, outputsToUpdate, filesToCreate, filesToUpdate, filesToMerge, linksToCreate, peopleToCreate, all following the same per-item result pattern); clean up the awkward variable in the tasksToDelete block; verify the Realtime publication name before the ALTER PUBLICATION line; double-check RETURNING INTO usage inside loops.
3. M1: apply the corrected schema and functions step by step via apply_migration. Purely additive. Nothing writes palantir_state, ever.
4. M2: run pal_migrate_from_v1() and the full fidelity proof (draft step 7): counts vs the audit numbers (46 files, 208 tasks, 15 deliverables, 12 people, 5 milestones, 2 risks, 7 questions, 40 log entries), zero missing IDs, and a field-level export diff on Dorval (p01), APA (p10), and LDRR (p25).
5. Test pal_apply_update end to end with a tiny real package (create one test task, verify idempotency by applying twice, check per-item results, then delete the test task via tasksToDelete).
6. Report results compactly. Save any corrected SQL back to the docs folder. Give me the git command (one chained line) to commit the docs folder.

Standing rules: summarize your plan and get my approval before executing each migration step. I handle all git. Never use em dashes. v1 (/palantir and palantir_state) must be untouched and fully functional at the end of this session.

const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const BASE = "/sessions/gracious-elegant-cray/mnt/02.Claude Apps/Karl's Apps/kh-tools/docs/palantir-2.0";
const SQL_PATH = BASE + "/palantir-2.0-session1-final.sql";
const BACKUP_PATH = BASE + "/backups/palantir-v1-2026-06-12.json";
const LOG_OUT = "/sessions/gracious-elegant-cray/mnt/outputs/pgtest/session2-test-log.json";

const out = { phases: {}, tests: [] };
function rec(name, pass, detail, extra) {
  out.tests.push({ name, pass, detail: detail || '', extra: extra || null });
  const tag = pass === true ? 'PASS' : pass === false ? 'FAIL' : 'OBS ';
  console.log(tag + '  ' + name + (detail ? '  :: ' + detail : ''));
}

(async () => {
  const db = new PGlite();
  try {
    // ---- phase 1: roles + stub tables + load v1 state ----
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN;
      CREATE TABLE palantir_state (id int PRIMARY KEY, user_id uuid, state jsonb);
      CREATE TABLE palantir_snapshots (id bigserial PRIMARY KEY, user_id uuid, state jsonb, trigger text, label text, created_at timestamptz DEFAULT now());
    `);
    let stateObj = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
    if (!stateObj.files && !stateObj.people && stateObj.state) stateObj = stateObj.state;
    out.phases.stateKeys = Object.keys(stateObj);
    console.log('v1 state keys:', out.phases.stateKeys.join(', '));
    await db.query('INSERT INTO palantir_state(id, user_id, state) VALUES (1, $1::uuid, $2::jsonb)',
      ['00000000-0000-0000-0000-000000000001', JSON.stringify(stateObj)]);

    // ---- phase 2: load canonical SQL, strip realtime publication ----
    let sql = fs.readFileSync(SQL_PATH, 'utf8');
    const stripped = [];
    sql = sql.split('\n').map(l => {
      if (/ALTER\s+PUBLICATION/i.test(l)) { stripped.push(l.trim()); return '-- [stripped] ' + l; }
      return l;
    }).join('\n');
    out.phases.strippedLines = stripped;
    try { await db.exec(sql); out.phases.schema = 'ok'; console.log('schema: loaded OK (stripped ' + stripped.length + ' realtime line[s])'); }
    catch (e) { out.phases.schema = 'ERROR: ' + e.message; console.log('schema FAILED: ' + e.message); fs.writeFileSync(LOG_OUT, JSON.stringify(out, null, 2)); process.exit(1); }

    // ---- phase 3: migrate v1 -> pal_ ----
    out.phases.migrate = (await db.query('SELECT pal_migrate_from_v1() AS r')).rows[0].r;
    const counts = (await db.query(`SELECT
       (SELECT count(*)::int FROM pal_files) files,(SELECT count(*)::int FROM pal_tasks) tasks,
       (SELECT count(*)::int FROM pal_outputs) outputs,(SELECT count(*)::int FROM pal_people) people,
       (SELECT count(*)::int FROM pal_flags) flags,(SELECT count(*)::int FROM pal_links) links,
       (SELECT count(*)::int FROM pal_events) events`)).rows[0];
    out.phases.counts = counts;
    console.log('counts:', JSON.stringify(counts));
    rec('migrate populated (files >= 40)', counts.files >= 40, 'files=' + counts.files + ' tasks=' + counts.tasks + ' outputs=' + counts.outputs);
    const memNN = (await db.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name='pal_files' AND column_name='memory'`)).rows[0];
    out.phases.memory_nullable = memNN ? memNN.is_nullable : 'unknown';
    console.log('pal_files.memory is_nullable =', out.phases.memory_nullable);

    const apply = async (pkg) => {
      try { return { ok: true, r: (await db.query('SELECT pal_apply_update($1::jsonb) AS r', [JSON.stringify(pkg)])).rows[0].r }; }
      catch (e) { return { ok: false, err: e.message }; }
    };
    const q1 = async (sqlText, params) => (await db.query(sqlText, params)).rows[0];
    const res = (r, op) => (r.results || []).filter(x => x.op === op);

    // T0 missing packageId
    { const a = await apply({ summary: 'no id' });
      rec('T0 missing packageId -> status error', a.ok && a.r.status === 'error', a.ok ? a.r.error : 'threw: ' + a.err); }

    // T1 idempotency + people dup-guard
    { const a = await apply({ packageId: 't-idem', peopleToCreate: [{ name: 'Zelda Tester', title: 'QA' }] });
      const b = await apply({ packageId: 't-idem', peopleToCreate: [{ name: 'Zelda Tester', title: 'QA' }] });
      const c = await apply({ packageId: 't-idem-2', peopleToCreate: [{ name: 'Zelda Tester', title: 'QA' }] });
      rec('T1a first apply -> applied + person ok', a.ok && a.r.status === 'applied' && res(a.r,'person.create')[0].result === 'ok');
      rec('T1b same packageId -> noop', b.ok && b.r.status === 'noop', b.r && b.r.reason);
      rec('T1c new pkg same name -> skipped already exists', c.ok && /already exists/.test(res(c.r,'person.create')[0].result)); }

    // T2 unknown top-level key warned
    { const a = await apply({ packageId: 't-unk', bogusKey: [1], peopleToCreate: [] });
      rec('T2 unknown top-level key -> warning', a.ok && (a.r.warnings || []).some(w => /unknown key ignored: bogusKey/.test(w)), JSON.stringify(a.r.warnings)); }

    // T3 filesToCreate + dup + lead-not-found
    { const a = await apply({ packageId: 't-file', filesToCreate: [{ title: 'ZZ Test File', status: 'active', priority: 'high', lead: 'Zelda Tester', memory: 'init' }] });
      const b = await apply({ packageId: 't-file-2', filesToCreate: [{ title: 'ZZ Test File' }] });
      const c = await apply({ packageId: 't-file-3', filesToCreate: [{ title: 'ZZ Lead Missing', lead: 'Nobody XYZ' }] });
      rec('T3a file create ok', a.ok && res(a.r,'file.create')[0].result === 'ok');
      rec('T3b dup title -> skipped', b.ok && /same title exists/.test(res(b.r,'file.create')[0].result));
      rec('T3c lead-not-found -> ok + warn', c.ok && res(c.r,'file.create')[0].result === 'ok' && /lead not found/.test(res(c.r,'file.create')[0].warn || '')); }
    const ztf = (await q1(`SELECT id FROM pal_files WHERE title='ZZ Test File'`)).id;

    // T4 outputsToCreate + owner-not-found + null-due update
    { const a = await apply({ packageId: 't-out', outputsToCreate: [{ fileTitle: 'ZZ Test File', title: 'ZZ Output A', type: 'doc', status: 'not_started', owner: 'Zelda Tester', due: '2026-07-01' }] });
      rec('T4a output create ok', a.ok && res(a.r,'output.create')[0].result === 'ok'); }
    const outA = (await q1(`SELECT id, due FROM pal_outputs WHERE title='ZZ Output A'`));
    rec('T4b output due stored', !!outA.due, JSON.stringify(outA.due));
    { const a = await apply({ packageId: 't-out-null', outputsToUpdate: [{ outputId: outA.id, changes: { due: null } }] });
      const after = (await q1(`SELECT due FROM pal_outputs WHERE id=$1`, [outA.id]));
      rec('T4c explicit-null due clears the date', a.ok && after.due === null, 'due now=' + JSON.stringify(after.due)); }

    // T5 tasksToCreate: ambiguity setup + assignees-not-found
    { const a = await apply({ packageId: 't-task', tasksToCreate: [
        { fileTitle: 'ZZ Test File', title: 'ZZ Dup Task' },
        { fileTitle: 'ZZ Test File', title: 'ZZ Dup Task' },
        { fileTitle: 'ZZ Test File', title: 'ZZ Unique Task', assignees: ['Zelda Tester', 'Ghost'] }] });
      const tc = res(a.r,'task.create');
      rec('T5a three tasks created ok', a.ok && tc.length === 3 && tc.every(x => x.result === 'ok'));
      rec('T5b dup gets similar-open-task warn', /similar open task exists/.test(tc[1].warn || ''), tc[1].warn);
      rec('T5c missing assignee warned', /assignees not found: Ghost/.test(tc[2].warn || ''), tc[2].warn); }

    // T6 ambiguous complete + complete + re-complete
    { const a = await apply({ packageId: 't-amb', tasksToComplete: [{ taskTitle: 'ZZ Dup Task' }] });
      rec('T6a ambiguous title complete -> skipped', a.ok && /no match/.test(res(a.r,'complete')[0].result) && /ambiguous/.test(res(a.r,'complete')[0].warn || ''), res(a.r,'complete')[0].warn);
      const b = await apply({ packageId: 't-cmp', tasksToComplete: [{ taskTitle: 'ZZ Unique Task' }] });
      rec('T6b complete unique -> ok', b.ok && res(b.r,'complete')[0].result === 'ok');
      const c = await apply({ packageId: 't-cmp-2', tasksToComplete: [{ taskTitle: 'ZZ Unique Task' }] });
      rec('T6c re-complete -> already completed', c.ok && /already completed/.test(res(c.r,'complete')[0].warn || ''), res(c.r,'complete')[0].warn); }

    // T7 tasksToUpdate referential check (bad outputId does not abort)
    { const tid = (await q1(`SELECT id FROM pal_tasks WHERE title='ZZ Unique Task' LIMIT 1`)).id;
      const a = await apply({ packageId: 't-upd', tasksToUpdate: [{ taskId: tid, changes: { outputId: 'does-not-exist', notes: 'n2' } }] });
      const notes = (await q1(`SELECT notes, output_id FROM pal_tasks WHERE id=$1`, [tid]));
      rec('T7 bad outputId -> warn, link unchanged, notes still applied', a.ok && res(a.r,'task.update')[0].result === 'ok' && /outputId not found/.test(res(a.r,'task.update')[0].warn || '') && notes.notes === 'n2' && notes.output_id === null, res(a.r,'task.update')[0].warn); }

    // T8 flagsToCreate unknown kind + flagsToResolve by text
    { const a = await apply({ packageId: 't-flag', flagsToCreate: [{ fileTitle: 'ZZ Test File', kind: 'weird', text: 'ZZ Flag One', detail: 'd', severity: 'high' }] });
      rec('T8a unknown kind -> defaulted to question + warn', a.ok && res(a.r,'flag.create')[0].result === 'ok' && /defaulted to question/.test(res(a.r,'flag.create')[0].warn || ''), res(a.r,'flag.create')[0].warn);
      const kind = (await q1(`SELECT kind FROM pal_flags WHERE text='ZZ Flag One'`)).kind;
      rec('T8b flag stored as question', kind === 'question', 'kind=' + kind);
      const b = await apply({ packageId: 't-flag-r', flagsToResolve: [{ fileTitle: 'ZZ Test File', text: 'ZZ Flag One', status: 'resolved', resolution: 'done' }] });
      const st = (await q1(`SELECT status, resolution FROM pal_flags WHERE text='ZZ Flag One'`));
      rec('T8c resolve by text -> resolved', b.ok && res(b.r,'flag.resolve')[0].result === 'ok' && st.status === 'resolved', JSON.stringify(st)); }

    // T9 filesToMerge end-to-end
    { await apply({ packageId: 't-merge-setup', filesToCreate: [{ title: 'ZZ Source' }, { title: 'ZZ Target' }] });
      await apply({ packageId: 't-merge-fill', tasksToCreate: [{ fileTitle: 'ZZ Source', title: 'ZZ Src Task' }], outputsToCreate: [{ fileTitle: 'ZZ Source', title: 'ZZ Src Out' }], flagsToCreate: [{ fileTitle: 'ZZ Source', kind: 'risk', text: 'ZZ Src Risk' }], linksToCreate: [{ fileTitle: 'ZZ Source', url: 'http://x', label: 'L' }] });
      const m = await apply({ packageId: 't-merge', filesToMerge: [{ sourceTitle: 'ZZ Source', targetTitle: 'ZZ Target' }] });
      const mr = res(m.r,'file.merge')[0];
      const tgt = (await q1(`SELECT id FROM pal_files WHERE title='ZZ Target'`)).id;
      const src = (await q1(`SELECT id, archived FROM pal_files WHERE title='ZZ Source'`));
      const moved = (await q1(`SELECT (SELECT count(*)::int FROM pal_tasks WHERE file_id=$1) t,(SELECT count(*)::int FROM pal_outputs WHERE file_id=$1) o,(SELECT count(*)::int FROM pal_flags WHERE file_id=$1) f,(SELECT count(*)::int FROM pal_links WHERE file_id=$1) l`, [tgt]));
      rec('T9a merge ok with moved counts', m.ok && mr.result === 'ok' && mr.moved && mr.moved.tasks === 1 && mr.moved.outputs === 1 && mr.moved.flags === 1 && mr.moved.links === 1, JSON.stringify(mr.moved));
      rec('T9b source archived', src.archived === true);
      rec('T9c target now owns moved rows', moved.t >= 1 && moved.o >= 1 && moved.f >= 1 && moved.l >= 1, JSON.stringify(moved)); }

    // T10 empty/minimal package
    { const a = await apply({ packageId: 't-empty', filesToCreate: [], tasksToCreate: [] });
      rec('T10 empty arrays -> applied cleanly', a.ok && a.r.status === 'applied' && (a.r.results || []).length === 0 && (a.r.warnings || []).length === 0); }

    // ---- ROBUSTNESS PROBES ----
    // R1 malformed boolean in filesToUpdate.archived
    { const a = await apply({ packageId: 'r-bad-bool', filesToUpdate: [{ fileTitle: 'ZZ Test File', changes: { archived: 'definitely-not-a-bool' } }] });
      rec('R1 malformed archived bool', a.ok ? null : false, a.ok ? ('handled, status=' + a.r.status) : ('THREW / aborted txn: ' + a.err), a.ok ? a.r : a.err); }
    // R2 malformed float in sortOrder
    { const a = await apply({ packageId: 'r-bad-float', outputsToUpdate: [{ outputId: outA.id, changes: { sortOrder: 'not-a-number' } }] });
      rec('R2 malformed sortOrder float', a.ok ? null : false, a.ok ? ('handled, status=' + a.r.status) : ('THREW / aborted txn: ' + a.err), a.ok ? a.r : a.err); }
    // R3 poison: one bad cast rolls back the whole package (canary should NOT survive)
    { const a = await apply({ packageId: 'r-poison', tasksToCreate: [{ fileTitle: 'ZZ Test File', title: 'ZZ Poison Canary' }], filesToUpdate: [{ fileTitle: 'ZZ Test File', changes: { archived: 'xxx' } }] });
      const canary = (await q1(`SELECT count(*)::int c FROM pal_tasks WHERE title='ZZ Poison Canary'`)).c;
      rec('R3 one bad cast poisons whole package (canary rolled back)', null, 'apply ' + (a.ok ? 'returned status=' + a.r.status : 'threw') + '; canary rows=' + canary + (canary === 0 ? ' (rolled back)' : ' (survived)'), { applyOk: a.ok, canary }); }
    // R4 memoryUpdates missing newMemory -> NULL into memory column
    { const a = await apply({ packageId: 'r-mem-null', memoryUpdates: [{ fileTitle: 'ZZ Test File' }] });
      rec('R4 memoryUpdate missing newMemory', a.ok ? null : false, a.ok ? ('handled, op result=' + (res(a.r,'memory')[0] && res(a.r,'memory')[0].result)) : ('THREW / aborted txn: ' + a.err), a.ok ? a.r : a.err); }

    // ---- v1 fidelity: export round-trip sanity ----
    { const ex = (await db.query('SELECT pal_export_state() AS s')).rows[0].s;
      rec('export_state returns v1 shape', ex && ex.version === '1.0' && Array.isArray(ex.files) && Array.isArray(ex.tasks), 'version=' + (ex && ex.version) + ' files=' + (ex.files||[]).length); }

    const pass = out.tests.filter(t => t.pass === true).length;
    const fail = out.tests.filter(t => t.pass === false).length;
    const obs = out.tests.filter(t => t.pass === null).length;
    out.summary = { pass, fail, obs, total: out.tests.length };
    console.log('\n==== SUMMARY: ' + pass + ' pass, ' + fail + ' fail, ' + obs + ' observations ====');
    fs.writeFileSync(LOG_OUT, JSON.stringify(out, null, 2));
    console.log('log -> ' + LOG_OUT);
  } catch (e) {
    console.log('HARNESS ERROR:', e.message);
    out.harnessError = e.message;
    fs.writeFileSync(LOG_OUT, JSON.stringify(out, null, 2));
    process.exit(1);
  }
})();

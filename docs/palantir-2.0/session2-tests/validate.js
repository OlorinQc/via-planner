const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const BASE = "/sessions/gracious-elegant-cray/mnt/02.Claude Apps/Karl's Apps/kh-tools/docs/palantir-2.0";
const SQL_PATH = BASE + "/palantir-2.0-session1-final.sql";
const FIXES_PATH = BASE + "/palantir-2.0-session2-fixes.sql";
const BACKUP_PATH = BASE + "/backups/palantir-v1-2026-06-12.json";
const tests = [];
function rec(name, pass, detail) { tests.push({name,pass}); console.log((pass===true?'PASS':pass===false?'FAIL':'OBS ')+'  '+name+(detail?'  :: '+detail:'')); }

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
      CREATE SCHEMA IF NOT EXISTS extensions;
      CREATE TABLE palantir_state (id int PRIMARY KEY, user_id uuid, state jsonb);
      CREATE TABLE palantir_snapshots (id bigserial PRIMARY KEY, user_id uuid, state jsonb, trigger text, label text, created_at timestamptz DEFAULT now());
    `);
    let st = JSON.parse(fs.readFileSync(BACKUP_PATH,'utf8'));
    if (!st.files && !st.people && st.state) st = st.state;
    await db.query('INSERT INTO palantir_state(id,user_id,state) VALUES (1,$1::uuid,$2::jsonb)',['00000000-0000-0000-0000-000000000001', JSON.stringify(st)]);
    let base = fs.readFileSync(SQL_PATH,'utf8').split('\n').filter(l=>!/ALTER\s+PUBLICATION/i.test(l)).join('\n');
    await db.exec(base);
    rec('original schema loads', true);
    await db.exec(fs.readFileSync(FIXES_PATH,'utf8'));
    rec('session2-fixes.sql applies (helpers + patched fn + hardening)', true);
    const mig = (await db.query('SELECT pal_migrate_from_v1() AS r')).rows[0].r;
    rec('migrate works under pinned search_path', !!mig && !mig.error, JSON.stringify(mig).slice(0,80));

    const apply = async (pkg) => { try { return {ok:true, r:(await db.query('SELECT pal_apply_update($1::jsonb) AS r',[JSON.stringify(pkg)])).rows[0].r}; } catch(e){ return {ok:false, err:e.message}; } };
    const q1 = async (t,p)=>(await db.query(t,p)).rows[0];
    const res = (r,op)=>(r.results||[]).filter(x=>x.op===op);

    // setup a file (also proves gen_random_uuid resolves under pinned path)
    const a0 = await apply({packageId:'v-setup', filesToCreate:[{title:'VV File', status:'active'}], peopleToCreate:[{name:'Val Tester'}]});
    rec('create under pinned search_path (gen_random_uuid resolves)', a0.ok && res(a0.r,'file.create')[0].result==='ok');

    // R1 malformed archived -> handled
    const r1 = await apply({packageId:'v-bad-bool', filesToUpdate:[{fileTitle:'VV File', changes:{archived:'definitely-not-a-bool', status:'paused'}}]});
    const f1 = await q1(`SELECT archived, status FROM pal_files WHERE title='VV File'`);
    rec('R1 malformed archived: no throw + warn + file not archived + other change applied',
        r1.ok && r1.r.status==='applied' && /invalid archived value ignored/.test(res(r1.r,'file.update')[0].warn||'') && f1.archived===false && f1.status==='paused',
        r1.ok ? (res(r1.r,'file.update')[0].warn+' | archived='+f1.archived+' status='+f1.status) : 'THREW: '+r1.err);

    // R2 malformed sortOrder -> handled
    const r2 = await apply({packageId:'v-bad-float', outputsToCreate:[{fileTitle:'VV File', title:'VV Out'}]});
    const outId = (await q1(`SELECT id FROM pal_outputs WHERE title='VV Out'`)).id;
    const r2b = await apply({packageId:'v-bad-float2', outputsToUpdate:[{outputId:outId, changes:{sortOrder:'NaNNN', notes:'kept'}}]});
    const o2 = await q1(`SELECT notes FROM pal_outputs WHERE id=$1`,[outId]);
    rec('R2 malformed sortOrder: no throw + warn + sibling change applied',
        r2b.ok && r2b.r.status==='applied' && /invalid sortOrder ignored/.test(res(r2b.r,'output.update')[0].warn||'') && o2.notes==='kept',
        r2b.ok ? (res(r2b.r,'output.update')[0].warn+' | notes='+o2.notes) : 'THREW: '+r2b.err);

    // R3 poison no longer poisons: canary survives
    const r3 = await apply({packageId:'v-poison', tasksToCreate:[{fileTitle:'VV File', title:'VV Canary'}], filesToUpdate:[{fileTitle:'VV File', changes:{archived:'xxx'}}]});
    const canary = (await q1(`SELECT count(*)::int c FROM pal_tasks WHERE title='VV Canary'`)).c;
    rec('R3 one bad cast no longer poisons package (canary survives)', r3.ok && r3.r.status==='applied' && canary===1, 'status='+(r3.ok?r3.r.status:'threw')+' canary='+canary);

    // Regression: valid archived true then false
    const rv1 = await apply({packageId:'v-arch-true', filesToUpdate:[{fileTitle:'VV File', changes:{archived:true}}]});
    const fa = await q1(`SELECT archived FROM pal_files WHERE title='VV File'`);
    const rv2 = await apply({packageId:'v-arch-false', filesToUpdate:[{fileId:(await q1(`SELECT id FROM pal_files WHERE title='VV File'`)).id, changes:{archived:false}}]});
    const fb = await q1(`SELECT archived FROM pal_files WHERE title='VV File'`);
    rec('regression valid archived true->false toggles correctly', rv1.ok && fa.archived===true && rv2.ok && fb.archived===false, 'true='+fa.archived+' false='+fb.archived);

    // Regression: valid sortOrder applies
    const rv3 = await apply({packageId:'v-sort', outputsToUpdate:[{outputId:outId, changes:{sortOrder:'7.5'}}]});
    const so = await q1(`SELECT sort_order FROM pal_outputs WHERE id=$1`,[outId]);
    rec('regression valid sortOrder applies', rv3.ok && Number(so.sort_order)===7.5, 'sort_order='+so.sort_order);

    // search_path pinned on all pal_ functions
    const cfg = await db.query(`SELECT count(*)::int n, count(*) FILTER (WHERE proconfig IS NOT NULL)::int pinned FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace WHERE nsp.nspname='public' AND p.proname ~ '^pal_'`);
    rec('all pal_ functions now have search_path pinned', cfg.rows[0].n===cfg.rows[0].pinned, cfg.rows[0].pinned+'/'+cfg.rows[0].n);

    // EXECUTE ACL: anon removed from write surface; migrate locked to service_role
    const acl = await db.query(`SELECT proname, proacl::text acl FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace WHERE nsp.nspname='public' AND proname IN ('pal_apply_update','pal_migrate_from_v1','pal_snapshot','pal_export_state')`);
    const m = {}; acl.rows.forEach(r=>m[r.proname]=r.acl||'');
    rec('apply_update: anon has NO execute, authenticated YES', !/anon=/.test(m.pal_apply_update) && /authenticated=[^,}]*X/.test(m.pal_apply_update), m.pal_apply_update);
    rec('migrate_from_v1: only service_role (no anon/authenticated)', !/anon=/.test(m.pal_migrate_from_v1) && !/authenticated=/.test(m.pal_migrate_from_v1) && /service_role=[^,}]*X/.test(m.pal_migrate_from_v1), m.pal_migrate_from_v1);
    rec('snapshot kept for authenticated (invoker chain intact)', /authenticated=[^,}]*X/.test(m.pal_snapshot) && !/anon=/.test(m.pal_snapshot), m.pal_snapshot);

    const pass = tests.filter(t=>t.pass===true).length, fail = tests.filter(t=>t.pass===false).length;
    console.log('\n==== VALIDATION: '+pass+' pass, '+fail+' fail ====');
    process.exit(fail>0?1:0);
  } catch(e){ console.log('VALIDATION HARNESS ERROR:', e.message); process.exit(1); }
})();

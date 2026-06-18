const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const BASE = "/sessions/gracious-elegant-cray/mnt/02.Claude Apps/Karl's Apps/kh-tools/docs/palantir-2.0";
const J = JSON.parse(fs.readFileSync(BASE+"/backups/palantir-v1-2026-06-17.json",'utf8'));
const T0='2026-06-17T16:56:11.821+00:00';
const tests=[]; const rec=(n,p,d)=>{tests.push({n,p});console.log((p===true?'PASS':p===false?'FAIL':'OBS ')+'  '+n+(d?'  :: '+d:''));};
const dist=(arr,k)=>{const c={};(arr||[]).forEach(o=>{const v=o&&o[k];if(v!=null&&v!=='')c[v]=(c[v]||0)+1;});return c;};

(async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE SCHEMA IF NOT EXISTS extensions;
      CREATE TABLE palantir_state(id int PRIMARY KEY,user_id uuid,state jsonb,updated_at timestamptz);
      CREATE TABLE palantir_snapshots(id bigserial PRIMARY KEY,user_id uuid,state jsonb,trigger text,label text,created_at timestamptz DEFAULT now());`);
    await db.query('INSERT INTO palantir_state(id,user_id,state,updated_at) VALUES (1,$1::uuid,$2::jsonb,$3::timestamptz)',
      ['00000000-0000-0000-0000-000000000001',JSON.stringify(J),T0]);
    await db.exec(fs.readFileSync(BASE+"/palantir-2.0-session1-final.sql",'utf8').split('\n').filter(l=>!/ALTER\s+PUBLICATION/i.test(l)).join('\n'));
    await db.exec(fs.readFileSync("/sessions/gracious-elegant-cray/mnt/outputs/pgtest/fixes.sql",'utf8'));
    await db.exec(fs.readFileSync(BASE+"/palantir-2.0-session3-priority-patch.sql",'utf8'));
    await db.exec(fs.readFileSync(BASE+"/palantir-2.0-session3-bridge.sql",'utf8'));
    rec('schema + patch + bridge load',true);

    const getState=async()=>(await db.query('SELECT state,updated_at FROM palantir_state WHERE id=1')).rows[0];
    const bridge=async(pkg,exp)=>{try{return {ok:true,r:(await db.query('SELECT pal_apply_to_v1($1::jsonb,$2::timestamptz) AS r',[JSON.stringify(pkg),exp||null])).rows[0].r};}catch(e){return{ok:false,err:e.message};}};
    const fileTitle=J.files.find(f=>!f.archived).title;
    const base=await getState(); const baseTasks=base.state.tasks.length;
    console.log('target file:', JSON.stringify(fileTitle), '| baseline tasks:', baseTasks, '| baseline priority:', JSON.stringify(dist(base.state.tasks,'priority')));

    // A. apply
    const pkgA={packageId:'s3-bridge-1',summary:'bridge test A',tasksToCreate:[{fileTitle,title:'ZZ Bridge Task',status:'in_progress',assignees:['Karl'],due:'2026-07-01'}]};
    const a=await bridge(pkgA,T0);
    const sA=await getState();
    const hasTask=t=> (sA.state.tasks||[]).some(x=>x.title===t);
    rec('A1 apply returns applied+syncedToV1', a.ok && a.r.status==='applied' && a.r.syncedToV1===true, a.ok?JSON.stringify(a.r).slice(0,90):a.err);
    rec('A2 new task present in palantir_state', hasTask('ZZ Bridge Task'));
    rec('A3 task count +1', sA.state.tasks.length===baseTasks+1, baseTasks+' -> '+sA.state.tasks.length);
    rec('A4 updated_at advanced', new Date(sA.updated_at)>new Date(T0));
    rec('A5 existing priorities preserved', JSON.stringify(dist(sA.state.tasks,'priority'))===JSON.stringify({urgent:10,medium:50}), JSON.stringify(dist(sA.state.tasks,'priority')));
    rec('A6 file count unchanged', sA.state.files.length===J.files.length, J.files.length+' -> '+sA.state.files.length);

    // B. idempotency
    const b=await bridge(pkgA, sA.updated_at);
    const sB=await getState();
    rec('B1 re-apply same packageId -> noop', b.ok && b.r.status==='noop', b.ok?b.r.reason:b.err);
    rec('B2 no duplicate task created', (sB.state.tasks||[]).filter(x=>x.title==='ZZ Bridge Task').length===1);

    // C. conflict (stale expected_updated_at)
    const pkgC={packageId:'s3-bridge-2',summary:'should conflict',tasksToCreate:[{fileTitle,title:'ZZ Should Not Exist'}]};
    const c=await bridge(pkgC, T0); // T0 is now stale
    const sC=await getState();
    rec('C1 stale updated_at -> conflict', c.ok && c.r.status==='conflict', c.ok?c.r.reason:c.err);
    rec('C2 conflict wrote nothing', !(sC.state.tasks||[]).some(x=>x.title==='ZZ Should Not Exist'));

    // D. malformed value resilience (carries session2 safe-cast hardening)
    const pkgD={packageId:'s3-bridge-3',summary:'malformed bool',
      filesToUpdate:[{fileTitle, changes:{archived:'definitely-not-bool', status:'monitoring'}}],
      tasksToCreate:[{fileTitle,title:'ZZ Canary Survives'}]};
    const d=await bridge(pkgD, sB.updated_at);
    const sD=await getState();
    const f=(sD.state.files||[]).find(x=>x.title===fileTitle);
    rec('D1 malformed archived did not abort (applied)', d.ok && d.r.status==='applied', d.ok?JSON.stringify(d.r.warnings||[]).slice(0,80):d.err);
    rec('D2 canary task survived', (sD.state.tasks||[]).some(x=>x.title==='ZZ Canary Survives'));
    rec('D3 file not wrongly archived, status applied', f && f.archived===false && f.status==='monitoring', f?('archived='+f.archived+' status='+f.status):'file missing');

    // E. lossless re-export stability: round-trip the NEW state again, priorities stable
    const e=await bridge({packageId:'s3-bridge-4',summary:'noop-ish empty'}, sD.updated_at);
    const sE=await getState();
    rec('E1 empty package applies', e.ok && e.r.status==='applied');
    rec('E2 priorities still intact after 2nd round-trip', JSON.stringify(dist(sE.state.tasks,'priority'))===JSON.stringify({urgent:10,medium:50}), JSON.stringify(dist(sE.state.tasks,'priority')));
    rec('E3 bridge_log has the applied packages', (await db.query("SELECT count(*)::int n FROM pal_bridge_log")).rows[0].n>=3, 'count='+(await db.query("SELECT count(*)::int n FROM pal_bridge_log")).rows[0].n);

    const pass=tests.filter(t=>t.p===true).length, fail=tests.filter(t=>t.p===false).length;
    console.log('\n==== BRIDGE TEST: '+pass+' pass, '+fail+' fail ====');
  }catch(e){console.log('HARNESS ERR',e.message,e.stack);}
})();

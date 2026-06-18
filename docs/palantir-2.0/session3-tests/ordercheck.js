const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const BASE = "/sessions/gracious-elegant-cray/mnt/02.Claude Apps/Karl's Apps/kh-tools/docs/palantir-2.0";
const J = JSON.parse(fs.readFileSync(BASE+"/backups/palantir-v1-2026-06-17.json",'utf8'));
const baseId = id => (id||'').replace(/-\d+$/,'').replace(/-m$/,''); // collapse dup/milestone suffixes

(async()=>{
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE TABLE palantir_state(id int PRIMARY KEY,user_id uuid,state jsonb);
    CREATE TABLE palantir_snapshots(id bigserial PRIMARY KEY,user_id uuid,state jsonb,trigger text,label text,created_at timestamptz DEFAULT now());`);
  await db.query('INSERT INTO palantir_state(id,user_id,state) VALUES (1,$1::uuid,$2::jsonb)',['00000000-0000-0000-0000-000000000001',JSON.stringify(J)]);
  await db.exec(fs.readFileSync(BASE+"/palantir-2.0-session1-final.sql",'utf8').split('\n').filter(l=>!/ALTER\s+PUBLICATION/i.test(l)).join('\n'));
  await db.exec(fs.readFileSync(BASE+"/palantir-2.0-session3-priority-patch.sql",'utf8'));
  await db.query('SELECT pal_migrate_from_v1()');
  const E=(await db.query('SELECT pal_export_state() AS s')).rows[0].s;
  const ef=Object.fromEntries(E.files.map(f=>[f.id,f]));

  // app's visible standalone order for input: use standaloneTaskOrder if non-empty, else global tasks[] order filtered
  let sameOrder=0, diffOrder=0, emptyBoth=0; const examples=[];
  for(const f of J.files){
    const globalOrder = J.tasks.filter(t=>(t.fileId===f.id||t.projectId===f.id)&&!t.deliverableId).map(t=>t.id);
    const inputVisible = (Array.isArray(f.standaloneTaskOrder)&&f.standaloneTaskOrder.length)? f.standaloneTaskOrder : globalOrder;
    const exportOrder = (ef[f.id]&&ef[f.id].standaloneTaskOrder)||[];
    const a=inputVisible.map(baseId), b=exportOrder.map(baseId);
    if(a.length===0&&b.length===0){emptyBoth++; continue;}
    if(JSON.stringify(a)===JSON.stringify(b)) sameOrder++;
    else { diffOrder++; if(examples.length<4) examples.push({file:f.title.slice(0,28), in:a.slice(0,6), out:b.slice(0,6), inSet:[...a].sort(), outSet:[...b].sort()}); }
  }
  console.log('files with standalone tasks: same visible order =', sameOrder, '| different order =', diffOrder, '| empty both =', emptyBoth);
  for(const e of examples){
    const setEq = JSON.stringify(e.inSet)===JSON.stringify(e.outSet);
    console.log('\nDIFF file:', e.file, '| same set, only order?', setEq);
    console.log('  input order :', e.in.join(' '));
    console.log('  export order:', e.out.join(' '));
  }
})().catch(e=>console.log('ERR',e.message));

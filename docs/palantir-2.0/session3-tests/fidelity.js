const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const BASE = "/sessions/gracious-elegant-cray/mnt/02.Claude Apps/Karl's Apps/kh-tools/docs/palantir-2.0";
const SQL_PATH = BASE + "/palantir-2.0-session1-final.sql";
const BACKUP = BASE + "/backups/palantir-v1-2026-06-17.json";
const VOLATILE = new Set(['createdAt','updatedAt','exportedAt','exportedBy','archivedAt','migratedAt']);

const keyUnion = arr => { const s=new Set(); (arr||[]).forEach(o=>Object.keys(o||{}).forEach(k=>s.add(k))); return s; };
const ids = arr => new Set((arr||[]).map(o=>o&&o.id));
const byId = arr => Object.fromEntries((arr||[]).map(o=>[o&&o.id,o]));

(async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE TABLE palantir_state (id int PRIMARY KEY, user_id uuid, state jsonb);
    CREATE TABLE palantir_snapshots (id bigserial PRIMARY KEY, user_id uuid, state jsonb, trigger text, label text, created_at timestamptz DEFAULT now());
  `);
  const J = JSON.parse(fs.readFileSync(BACKUP,'utf8'));
  await db.query('INSERT INTO palantir_state(id,user_id,state) VALUES (1,$1::uuid,$2::jsonb)',
    ['00000000-0000-0000-0000-000000000001', JSON.stringify(J)]);
  let sql = fs.readFileSync(SQL_PATH,'utf8').split('\n').filter(l=>!/ALTER\s+PUBLICATION/i.test(l)).join('\n');
  await db.exec(sql);
  const mig = (await db.query('SELECT pal_migrate_from_v1() AS r')).rows[0].r;
  const E = (await db.query('SELECT pal_export_state() AS s')).rows[0].s;

  console.log('migrate:', JSON.stringify(mig).slice(0,160));
  // top-level keys
  const ik=new Set(Object.keys(J)), ek=new Set(Object.keys(E));
  console.log('\nTOP-LEVEL KEYS');
  console.log('  input-only :', [...ik].filter(k=>!ek.has(k)).join(', ')||'(none)');
  console.log('  export-only:', [...ek].filter(k=>!ik.has(k)).join(', ')||'(none)');
  console.log('  top risks input len:', (J.risks||[]).length, '| top openQuestions input len:', (J.openQuestions||[]).length);

  function entity(name, jArr, eArr){
    jArr=jArr||[]; eArr=eArr||[];
    console.log('\n'+name.toUpperCase()+'  input='+jArr.length+'  export='+eArr.length);
    const ji=ids(jArr), ei=ids(eArr);
    const missing=[...ji].filter(x=>!ei.has(x)); const extra=[...ei].filter(x=>!ji.has(x));
    console.log('  ids missing in export ('+missing.length+'):', missing.slice(0,8).join(', ')||'(none)');
    console.log('  ids extra in export ('+extra.length+'):', extra.slice(0,8).join(', ')||'(none)');
    const jk=keyUnion(jArr), ek2=keyUnion(eArr);
    console.log('  fields DROPPED by export:', [...jk].filter(k=>!ek2.has(k)).join(', ')||'(none)');
    console.log('  fields ADDED by export  :', [...ek2].filter(k=>!jk.has(k)).join(', ')||'(none)');
    // field value diffs on shared ids + shared keys (non-volatile)
    const jm=byId(jArr), em=byId(eArr); const shared=[...ji].filter(x=>ei.has(x));
    const shKeys=[...jk].filter(k=>ek2.has(k)&&!VOLATILE.has(k));
    const mismatch={};
    for(const id of shared){ const a=jm[id],b=em[id]; if(!a||!b)continue;
      for(const k of shKeys){ if(JSON.stringify(a[k])!==JSON.stringify(b[k])){ mismatch[k]=(mismatch[k]||0)+1; } } }
    const ranked=Object.entries(mismatch).sort((x,y)=>y[1]-x[1]);
    console.log('  value mismatches on shared fields:', ranked.length? ranked.map(([k,n])=>k+'='+n).join(', '):'(none)');
    return {missing, extra, ranked};
  }

  const f=entity('files', J.files, E.files);
  const t=entity('tasks', J.tasks, E.tasks);
  const d=entity('deliverables', J.deliverables, E.deliverables);
  const p=entity('people', J.people, E.people);

  // embedded arrays inside files (sum across files), input vs export
  const sum=(arr,k)=>(arr||[]).reduce((a,f)=>a+((f&&f[k]||[]).length),0);
  console.log('\nFILE-EMBEDDED ARRAYS (summed)  input -> export');
  for(const k of ['risks','openQuestions','milestones','log','sharePointLinks','deliverableIds']){
    console.log('  '+k+': '+sum(J.files,k)+' -> '+sum(E.files,k));
  }

  // sample one task mismatch detail if any (dueDate/assignees often)
  if(t.ranked.length){
    const jm=byId(J.tasks), em=byId(E.tasks); const shared=[...ids(J.tasks)].filter(x=>ids(E.tasks).has(x));
    const badKey=t.ranked[0][0];
    for(const id of shared){ if(JSON.stringify(jm[id][badKey])!==JSON.stringify(em[id][badKey])){
      console.log('\nSAMPLE task '+badKey+' diff (id '+id+'):');
      console.log('  input :', JSON.stringify(jm[id][badKey]));
      console.log('  export:', JSON.stringify(em[id][badKey])); break; } }
  }

  const lossless = f.missing.length===0&&t.missing.length===0&&d.missing.length===0&&p.missing.length===0;
  console.log('\n==== id-completeness lossless:', lossless, '====');
})().catch(e=>{console.log('ERR', e.message);});

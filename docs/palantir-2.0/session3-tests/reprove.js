const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const BASE = "/sessions/gracious-elegant-cray/mnt/02.Claude Apps/Karl's Apps/kh-tools/docs/palantir-2.0";
const SQL = BASE + "/palantir-2.0-session1-final.sql";
const PATCH = BASE + "/palantir-2.0-session3-priority-patch.sql";
const BACKUP = BASE + "/backups/palantir-v1-2026-06-17.json";
const VOLATILE = new Set(['createdAt','updatedAt','exportedAt','exportedBy','archivedAt','migratedAt']);
const norm = v => (v===undefined||v===null) ? null : v;
const eq = (a,b) => JSON.stringify(norm(a))===JSON.stringify(norm(b));
const keyUnion = arr => { const s=new Set(); (arr||[]).forEach(o=>Object.keys(o||{}).forEach(k=>s.add(k))); return s; };
const distinctIds = arr => new Set((arr||[]).map(o=>o&&o.id));
const byId = arr => { const m={}; (arr||[]).forEach(o=>{ if(o&&o.id!=null && !(o.id in m)) m[o.id]=o; }); return m; };
const dist = (arr,k) => { const c={}; (arr||[]).forEach(o=>{const v=o&&o[k]; if(v!=null&&v!=='') c[v]=(c[v]||0)+1;}); return c; };

(async () => {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE TABLE palantir_state (id int PRIMARY KEY, user_id uuid, state jsonb);
    CREATE TABLE palantir_snapshots (id bigserial PRIMARY KEY, user_id uuid, state jsonb, trigger text, label text, created_at timestamptz DEFAULT now());`);
  const J = JSON.parse(fs.readFileSync(BACKUP,'utf8'));
  await db.query('INSERT INTO palantir_state(id,user_id,state) VALUES (1,$1::uuid,$2::jsonb)',['00000000-0000-0000-0000-000000000001', JSON.stringify(J)]);
  let base = fs.readFileSync(SQL,'utf8').split('\n').filter(l=>!/ALTER\s+PUBLICATION/i.test(l)).join('\n');
  await db.exec(base);
  await db.exec(fs.readFileSync(PATCH,'utf8'));
  console.log('schema + patch loaded OK');
  const mig=(await db.query('SELECT pal_migrate_from_v1() AS r')).rows[0].r;
  const E=(await db.query('SELECT pal_export_state() AS s')).rows[0].s;

  // 1. priority round-trip (aggregate, robust to duplicate ids)
  const inP=dist(J.tasks,'priority'), exP=dist(E.tasks,'priority');
  console.log('\nPRIORITY distribution  input:', JSON.stringify(inP), ' export:', JSON.stringify(exP));
  const inTpl=(J.tasks||[]).filter(t=>t.templateId).length, exTpl=(E.tasks||[]).filter(t=>t.templateId).length;
  console.log('templateId count  input:', inTpl, ' export:', exTpl);

  // 2. dropped fields now?
  const drop = (jk,ek)=>[...jk].filter(k=>!ek.has(k));
  console.log('\nTASK fields still DROPPED by export:', drop(keyUnion(J.tasks),keyUnion(E.tasks)).join(', ')||'(none)');
  console.log('FILE fields still DROPPED by export:', drop(keyUnion(J.files),keyUnion(E.files)).join(', ')||'(none)');

  // 3. REAL per-id field diffs (undefined==null normalized), excluding known duplicate ids
  const DUP=new Set(['p8001','p8002','p8003','p8004','p8005']);
  function realDiffs(name,jArr,eArr){
    const jm=byId(jArr), em=byId(eArr); const shared=[...distinctIds(jArr)].filter(x=>x in em && !DUP.has(x));
    const jk=keyUnion(jArr), ek=keyUnion(eArr); const shKeys=[...jk].filter(k=>ek.has(k)&&!VOLATILE.has(k));
    const mm={};
    for(const id of shared){ const a=jm[id],b=em[id]; for(const k of shKeys){ if(!eq(a[k],b[k])) mm[k]=(mm[k]||0)+1; } }
    const ranked=Object.entries(mm).sort((x,y)=>y[1]-x[1]);
    console.log('  '+name+' real field diffs:', ranked.length?ranked.map(([k,n])=>k+'='+n).join(', '):'(none)');
    return ranked;
  }
  console.log('\nREAL diffs (null==missing normalized, duplicate ids excluded):');
  const fd=realDiffs('files',J.files,E.files);
  const td=realDiffs('tasks',J.tasks,E.tasks);
  const dd=realDiffs('deliverables',J.deliverables,E.deliverables);

  // 4. specifically: do the 60 priority tasks each match by id (non-dup)?
  const em=byId(E.tasks); let pOk=0,pBad=0,pBadIds=[];
  for(const t of (J.tasks||[])){ if(t.priority&&!DUP.has(t.id)){ const e=em[t.id]; if(e&&e.priority===t.priority) pOk++; else {pBad++; if(pBadIds.length<6)pBadIds.push(t.id);} } }
  console.log('\nPRIORITY per-id (non-dup): matched='+pOk+' mismatched='+pBad, pBadIds.length?'e.g. '+pBadIds.join(','):'');

  // 5. sample remaining task diff (if any beyond order)
  if(td.length){ const k=td[0][0]; const jm=byId(J.tasks); for(const id of Object.keys(em)){ if(jm[id]&&!DUP.has(id)&&!eq(jm[id][k],em[id][k])){ console.log('sample task '+k+' (id '+id+'): in='+JSON.stringify(jm[id][k]).slice(0,80)+' out='+JSON.stringify(em[id][k]).slice(0,80)); break; } } }

  const priorityOk = JSON.stringify(inP)===JSON.stringify(exP);
  const tplOk = inTpl===exTpl;
  console.log('\n==== priority_round_trips:'+priorityOk+'  templateId_round_trips:'+tplOk+'  task_dropped_fields_remaining:'+(drop(keyUnion(J.tasks),keyUnion(E.tasks)).filter(k=>!['blocker','link','priority','dependencies','leadPersonId','approvalChain','supportPersonIds','assignee'].includes(k)).length)+' ====');
})().catch(e=>console.log('ERR',e.message,e.stack));

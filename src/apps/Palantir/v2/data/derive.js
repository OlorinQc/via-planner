// All selection / grouping / shaping lives here. Views never filter entities themselves
// (blueprint 4.3). Build the model once per state change.
import { FILE_PRI_ORDER, isTaskDone } from "../theme";
import { flexToExact, dueState, compareDue } from "./flexdate";

const stripHtml=(h)=>h?String(h).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim():'';
const groupBy=(rows,key)=>{const m={};for(const r of rows){const k=r[key];if(k==null)continue;(m[k]||(m[k]=[])).push(r);}return m;};

export function buildModel(state){
  const people=state.people||[],files=state.files||[],outputs=state.outputs||[],
        tasks=state.tasks||[],flags=state.flags||[],links=state.links||[],events=state.events||[];

  const peopleById={};for(const p of people)peopleById[p.id]=p;
  const fileById={};for(const f of files)fileById[f.id]=f;
  const outputById={};for(const o of outputs)outputById[o.id]=o;
  const karl=people.find(p=>p.name==='Karl');const karlId=karl?karl.id:'per-1';

  const tasksByFile=groupBy(tasks,'file_id');
  const tasksByOutput=groupBy(tasks,'output_id');
  const outputsByFile=groupBy(outputs,'file_id');
  const flagsByFile=groupBy(flags,'file_id');
  const linksByFile=groupBy(links,'file_id');
  const eventsByFile=groupBy(events,'file_id');

  // Per-file search blob + open-task count.
  const blob={},openCount={};
  for(const f of files){
    const ft=tasksByFile[f.id]||[],fo=outputsByFile[f.id]||[],ffl=flagsByFile[f.id]||[];
    openCount[f.id]=ft.filter(t=>!isTaskDone(t)).length;
    blob[f.id]=[f.title,stripHtml(f.memory),...ft.map(t=>t.title),...fo.map(o=>o.title),...ffl.map(x=>x.text)]
      .filter(Boolean).join('  ').toLowerCase();
  }

  return {state,people,files,outputs,tasks,flags,links,events,
    peopleById,fileById,outputById,karlId,
    tasksByFile,tasksByOutput,outputsByFile,flagsByFile,linksByFile,eventsByFile,
    blob,openCount};
}

export const personName=(m,id)=>id?(m.peopleById[id]?.name||id):null;
export const personFirst=(m,id)=>{const n=personName(m,id);return n?n.split(' ')[0]:null;};

// ── Files list ──
export function filterFiles(m,{search='',filter='active_monitoring',mineOnly=false}={}){
  const q=search.trim().toLowerCase();
  return m.files.filter(f=>{
    if(filter==='active_monitoring'){if(f.archived||!(f.status==='active'||f.status==='monitoring'))return false;}
    else if(filter==='active'){if(f.archived||f.status!=='active')return false;}
    else if(filter==='archived'){if(!f.archived)return false;}
    else if(filter==='all'){if(f.archived)return false;}
    if(mineOnly&&f.lead_id!==m.karlId)return false;
    if(q&&!(m.blob[f.id]||'').includes(q))return false;
    return true;
  });
}

export function groupByPriority(files){
  return FILE_PRI_ORDER
    .map(pri=>({pri,files:files.filter(f=>(f.priority||'medium')===pri).sort((a,b)=>(a.title||'').localeCompare(b.title||''))}))
    .filter(g=>g.files.length>0);
}

// Days since a timestamptz; staleness chip color + label.
export function staleness(file){
  const u=file.updated_at?new Date(file.updated_at):null;
  if(!u||isNaN(u))return{days:null,tone:'tx3',label:''};
  const days=Math.floor((Date.now()-u.getTime())/864e5);
  const date=u.toLocaleDateString('en-CA',{month:'short',day:'numeric'});
  if(days<14)return{days,tone:'g',label:date};
  if(days<30)return{days,tone:'y',label:days+'d idle'};
  return{days,tone:'r',label:days+'d idle'};
}

// ── File dossier tree ──
export function fileTree(m,fileId){
  const outs=(m.outputsByFile[fileId]||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const outBlocks=outs.map(o=>{
    const ts=(m.tasksByOutput[o.id]||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    return{output:o,open:ts.filter(t=>!isTaskDone(t)),done:ts.filter(isTaskDone)};
  });
  const fileTasks=(m.tasksByFile[fileId]||[]).filter(t=>!t.output_id).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const open=fileTasks.filter(t=>!isTaskDone(t));
  const done=fileTasks.filter(isTaskDone);
  const openTotal=outBlocks.reduce((n,b)=>n+b.open.length,0)+open.length;
  return{outBlocks,fileOpen:open,fileDone:done,openTotal,outputCount:outs.length};
}

export const fileFlags=(m,fileId)=>(m.flagsByFile[fileId]||[]);
export const fileLinks=(m,fileId)=>(m.linksByFile[fileId]||[]);
export const fileEvents=(m,fileId)=>(m.eventsByFile[fileId]||[]).slice().sort((a,b)=>{
  const ka=(a.event_date||a.created_at||''),kb=(b.event_date||b.created_at||'');
  return ka<kb?1:ka>kb?-1:0;
});

// ── Portfolio digest (empty right pane) ──
export function portfolio(m){
  const active=m.files.filter(f=>!f.archived&&(f.status==='active'||f.status==='monitoring'));
  const urgent=active.filter(f=>(f.priority||'')==='urgent');
  const openTasks=m.tasks.filter(t=>!isTaskDone(t));
  const myOverdue=openTasks.filter(t=>{
    if(!(t.assignee_ids||[]).includes(m.karlId))return false;
    return dueState(flexToExact(t.due))==='overdue';
  });
  const stale=active.filter(f=>staleness(f).days>=30);
  const openFlags=m.flags.filter(f=>f.status!=='resolved'&&f.status!=='dropped');
  const recent=m.events.slice().sort((a,b)=>{
    const ka=a.created_at||'',kb=b.created_at||'';return ka<kb?1:ka>kb?-1:0;
  }).slice(0,6);
  return{activeCount:active.length,urgentCount:urgent.length,openTaskCount:openTasks.length,
    myOverdueCount:myOverdue.length,staleCount:stale.length,openFlagCount:openFlags.length,recent};
}

// ── Today helpers (Session 6) ──
const pad2=(n)=>String(n).padStart(2,'0');
const isoOf=(d)=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const mondayOf=(d)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const off=(x.getDay()+6)%7;x.setDate(x.getDate()-off);return x;};
const DOW=['MON','TUE','WED','THU','FRI','SAT','SUN'];
const byCreatedDesc=(a,b)=>{const ka=a.created_at||'',kb=b.created_at||'';return ka<kb?1:ka>kb?-1:0;};
const priIdx=(f)=>{const i=FILE_PRI_ORDER.indexOf((f&&f.priority)||'medium');return i<0?FILE_PRI_ORDER.length:i;};
const taskSort=(a,b)=>compareDue(a.due,b.due)||(a.sort_order||0)-(b.sort_order||0);

const openMine=(m,mineOnly)=>{
  const open=m.tasks.filter(t=>!isTaskDone(t));
  return mineOnly?open.filter(t=>(t.assignee_ids||[]).includes(m.karlId)):open;
};

// Group a flat task array into [{file, tasks}] ordered by file priority then title.
function groupTasksByFile(m,arr){
  const byFile={};
  for(const t of arr){const k=t.file_id||'__none__';(byFile[k]||(byFile[k]=[])).push(t);}
  return Object.keys(byFile)
    .map(k=>({file:m.fileById[k]||{id:k,title:k==='__none__'?'(no file)':k,priority:'low'},tasks:byFile[k].slice().sort(taskSort)}))
    .sort((a,b)=>priIdx(a.file)-priIdx(b.file)||(a.file.title||'').localeCompare(b.file.title||''));
}

// Cockpit buckets: overdue / today / next 3 days / no date, each grouped by file.
// Tasks dated more than 3 days out live on the strip + Files, not the cockpit.
export function todayBuckets(m,{mineOnly=true}={}){
  const mine=openMine(m,mineOnly);
  const flat={overdue:[],today:[],soon:[],nodate:[]};
  for(const t of mine){
    const ex=flexToExact(t.due);
    const st=ex?dueState(ex):null;
    if(st==='overdue')flat.overdue.push(t);
    else if(st==='today')flat.today.push(t);
    else if(st==='soon')flat.soon.push(t);
    else if(!ex)flat.nodate.push(t);
  }
  return {
    overdue:groupTasksByFile(m,flat.overdue),
    today:groupTasksByFile(m,flat.today),
    soon:groupTasksByFile(m,flat.soon),
    nodate:groupTasksByFile(m,flat.nodate),
    counts:{overdue:flat.overdue.length,today:flat.today.length,soon:flat.soon.length,nodate:flat.nodate.length},
  };
}

// Two-week strip: 14 days from the Monday of the current week. Open tasks whose FlexDate
// resolves to a concrete day (exact/range start/week Monday) land in that day.
export function weekStrip(m,{mineOnly=true}={}){
  const mine=openMine(m,mineOnly);
  const start=mondayOf(new Date());
  const todayIso=isoOf(new Date());
  const days=[];
  for(let i=0;i<14;i++){
    const d=addDays(start,i);
    days.push({iso:isoOf(d),dow:DOW[i%7],dom:d.getDate(),isToday:isoOf(d)===todayIso,week:i<7?0:1,tasks:[]});
  }
  const byIso={};days.forEach(d=>byIso[d.iso]=d);
  for(const t of mine){
    const ex=flexToExact(t.due);
    if(!ex)continue;
    const day=byIso[ex];
    if(day)day.tasks.push(t);
  }
  days.forEach(d=>d.tasks.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)));
  return {days,weeks:[days.slice(0,7),days.slice(7,14)],startIso:isoOf(start)};
}

// Right rail: urgent files, open blocker flags, stale files (14d+), recent events.
export function todayRail(m){
  const active=m.files.filter(f=>!f.archived&&(f.status==='active'||f.status==='monitoring'));
  const urgentFiles=active.filter(f=>(f.priority||'')==='urgent').sort((a,b)=>(a.title||'').localeCompare(b.title||''));
  const openBlockers=m.flags.filter(f=>f.kind==='blocker'&&f.status==='open').map(fl=>({flag:fl,file:m.fileById[fl.file_id]||null}));
  const stale=active.map(f=>({file:f,st:staleness(f)})).filter(x=>x.st.days!=null&&x.st.days>=14).sort((a,b)=>b.st.days-a.st.days);
  const recent=m.events.slice().sort(byCreatedDesc).slice(0,5);
  return {urgentFiles,openBlockers,stale,recent};
}

// ── Activity surface (Session 6) ──
export function activityStream(m,{filter='all',fileId=null}={}){
  let ev=m.events.slice();
  if(fileId)ev=ev.filter(e=>e.file_id===fileId);
  if(filter==='claude')ev=ev.filter(e=>e.actor==='claude');
  else if(filter==='mine')ev=ev.filter(e=>e.actor==='karl');
  ev.sort(byCreatedDesc);
  return ev;
}

const countKinds=(events)=>{
  const c={completed:0,created:0,updated:0,logged:0,other:0};
  for(const e of events){
    const k=String(e.kind||'');
    if(k==='complete'||k==='completed')c.completed++;
    else if(k==='create'||k==='created')c.created++;
    else if(k==='update'||k==='updated')c.updated++;
    else if(k==='log')c.logged++;
    else c.other++;
  }
  return c;
};

// Chronological stream of items: applied packages (grouped by package_id, import event as
// header) and standalone manual events. Newest first.
export function activityItems(m,{filter='all',fileId=null}={}){
  const ev=activityStream(m,{filter,fileId});
  const pkgMap={};const items=[];
  for(const e of ev){
    if(e.package_id){
      let p=pkgMap[e.package_id];
      if(!p){p={type:'package',packageId:e.package_id,actor:e.actor,created_at:e.created_at,header:null,children:[]};pkgMap[e.package_id]=p;items.push(p);}
      if(e.kind==='import')p.header=e;else p.children.push(e);
      if(e.created_at&&(!p.created_at||e.created_at>p.created_at))p.created_at=e.created_at;
    }else{
      items.push({type:'event',event:e,created_at:e.created_at});
    }
  }
  for(const it of items)if(it.type==='package')it.counts=countKinds(it.children);
  items.sort(byCreatedDesc);
  return items;
}

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
      .filter(Boolean).join('  ').toLowerCase();
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

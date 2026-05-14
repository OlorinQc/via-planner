import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

// ─── FONT INJECTION ───────────────────────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:   '#080a10', s1:'#0f1219', s2:'#141824', s3:'#1a1f2e',
  bd:   'rgba(255,255,255,0.06)', bd2:'rgba(255,255,255,0.11)', bd3:'rgba(255,255,255,0.03)',
  tx:   '#dde1ec', tx2:'#7e8a9e', tx3:'#3e4a5a',
  acc:  '#5b9cf6', acc2:'#a8b8d0',
  g:    '#3fb68b', y:'#d4922a', r:'#d95f5f',
  hdr:  '#0a0c14',
  font: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
  serif:"'Cinzel', serif",
};
const FS = {
  active:    {bg:'rgba(91,156,246,0.10)',tx:T.acc, dot:T.acc, label:'Active'},
  monitoring:{bg:'rgba(212,146,42,0.10)',tx:T.y,  dot:T.y,   label:'Monitoring'},
  paused:    {bg:'rgba(62,74,90,0.20)',  tx:T.tx2,dot:T.tx2, label:'On Ice'},
  completed: {bg:'rgba(63,182,139,0.10)',tx:T.g,  dot:T.g,   label:'Completed'},
  archived:  {bg:'rgba(62,74,90,0.10)', tx:T.tx3,dot:T.tx3, label:'Archived'},
};
const FH = {
  on_track: {bg:'rgba(63,182,139,0.10)',tx:T.g,  label:'On Track'},
  at_risk:  {bg:'rgba(212,146,42,0.10)',tx:T.y,  label:'At Risk'},
  blocked:  {bg:'rgba(217,95,95,0.12)', tx:T.r,  label:'Blocked'},
  unknown:  {bg:'rgba(62,74,90,0.15)',  tx:T.tx2,label:'Unknown'},
};
const FP = {
  urgent:{bg:'rgba(217,95,95,0.12)', tx:T.r,  label:'Urgent'},
  high:  {bg:'rgba(212,146,42,0.10)',tx:T.y,  label:'High'},
  medium:{bg:'rgba(91,156,246,0.09)',tx:T.acc,label:'Medium'},
  low:   {bg:'rgba(62,74,90,0.18)', tx:T.tx2,label:'Low'},
};
const TS = {
  not_started: {bg:'rgba(62,74,90,0.18)',  tx:T.tx2,  label:'To Do'},
  in_progress: {bg:'rgba(91,156,246,0.10)',tx:T.acc,  label:'In Progress'},
  waiting:     {bg:'rgba(168,184,208,0.10)',tx:T.acc2,label:'Waiting'},
  blocked:     {bg:'rgba(217,95,95,0.12)', tx:T.r,    label:'Blocked'},
  completed:   {bg:'rgba(63,182,139,0.10)',tx:T.g,    label:'Done'},
  cancelled:   {bg:'rgba(62,74,90,0.10)', tx:T.tx3,  label:'Cancelled'},
  // Legacy
  'Urgent':      {bg:'rgba(217,95,95,0.13)', tx:T.r,   label:'Urgent'},
  'In Progress': {bg:'rgba(91,156,246,0.10)',tx:T.acc, label:'In Progress'},
  'To Plan':     {bg:'rgba(62,74,90,0.18)',  tx:T.tx2, label:'To Do'},
  'Waiting':     {bg:'rgba(168,184,208,0.10)',tx:T.acc2,label:'Waiting'},
  'Done':        {bg:'rgba(63,182,139,0.10)',tx:T.g,   label:'Done'},
};
const DD = {
  overdue:{bg:'rgba(217,95,95,0.14)',  tx:T.r},
  today:  {bg:'rgba(212,146,42,0.14)', tx:T.y},
  soon:   {bg:'rgba(212,186,42,0.10)', tx:'#b8960a'},
  ok:     {bg:'rgba(63,182,139,0.09)', tx:T.g},
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TODAY = new Date();
const toStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const TODAY_STR = toStr(TODAY);
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WD = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FILE_STATUS_OPTS = ["active","monitoring","paused","completed"];
const HEALTH_OPTS      = ["on_track","at_risk","blocked","unknown"];
const PRIORITY_OPTS    = ["urgent","high","medium","low"];
const TASK_STATUS_OPTS = ["not_started","in_progress","waiting","blocked","completed","cancelled"];
const MILESTONE_STATUS = ["not_started","in_progress","completed","delayed","blocked"];
const MS_LABEL = {not_started:'Pending',in_progress:'In Progress',completed:'Done',delayed:'Delayed',blocked:'Blocked'};
const LINK_TYPES = ["folder","draft","approved_document","background","briefing_note","qa","press_release","media_statement","approval","transcript","meeting_notes","other"];

// ─── UTILS ────────────────────────────────────────────────────────────────────
let _u = 8000;
const uid = () => `p${++_u}`;
const pd  = s => { if(!s) return null; const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const ds  = s => { if(!s) return null; const n=Math.floor((pd(s)-TODAY)/864e5); return n<0?"overdue":n===0?"today":n<=3?"soon":"ok"; };
const fmt = s => s ? pd(s).toLocaleDateString("en-CA",{month:"short",day:"numeric"}) : null;
const getMon = d => { const day=d.getDay(),diff=day===0?-6:1-day,m=new Date(d);m.setDate(d.getDate()+diff);return m; };
const weeksOfMonth = (yr,mo) => {
  const first=new Date(yr,mo,1),last=new Date(yr,mo+1,0);
  let mon=getMon(first);const wks=[];
  while(mon<=last){const wk=[];for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);wk.push(d);}wks.push(wk);mon=new Date(mon);mon.setDate(mon.getDate()+7);}
  return wks;
};
const wkDays = d => { const m=getMon(d); return Array.from({length:7},(_,i)=>{const x=new Date(m);x.setDate(m.getDate()+i);return x;}); };
const isDone  = t => ['Done','completed','cancelled'].includes(t.status);
const isBlocked = (task,tasks) => {
  const deps=[...(task.dependsOn||[]),(task.dependencies||[])].flat().filter(Boolean);
  return deps.length>0 && deps.some(id=>{const t=tasks.find(x=>x.id===id);return t&&!isDone(t);});
};
const taskAssignees = t => t.assignees || [];
const isMyTask = t => taskAssignees(t).includes("Karl");
const getFile = (files,id) => files?.find(f=>f.id===id);
const stripHtml = h => h?.replace(/<[^>]+>/g,"").trim()||"";

// ─── MIGRATION ────────────────────────────────────────────────────────────────
const LEGACY_FS = {'Active':'active','Watch':'monitoring','On Ice':'paused','Completed':'completed'};
const LEGACY_TS = {'Urgent':'in_progress','In Progress':'in_progress','To Plan':'not_started','Waiting':'waiting','Done':'completed'};

function migrateFromPlanner(old) {
  const people = (old.teamMembers||[]).map((name,i)=>({id:`per-${i+1}`,name,title:'',active:true}));
  (old.globalContacts||[]).forEach(c=>{if(!people.find(p=>p.name===c.name))people.push({id:c.id||uid(),name:c.name,title:c.title||'',active:true});});

  const files = (old.projects||[]).map(p=>({
    id: p.id, title: p.title,
    status: LEGACY_FS[p.status]||'active',
    priority:'medium', health:'unknown', sensitivity:'normal',
    lead: p.lead||'',
    leadPersonId: people.find(x=>x.name===p.lead)?.id||null,
    supportPersonIds:[],
    memory: p.background||'',
    latestUpdate:'',
    milestones:[], risks:[], openQuestions:[],
    log: (p.updateLog||[]).map(e=>({id:e.id,date:e.date,title:'Update',summary:stripHtml(e.text)||e.text||''})),
    sharePointLinks:(p.links||[]).map(l=>({...l,type:'folder',createdAt:TODAY_STR})),
    deliverableIds:[],
    archived:p.archived||false,
    archivedAt:p.archived?p.updatedAt:null,
    createdAt:p.updatedAt||TODAY_STR,
    updatedAt:p.updatedAt||TODAY_STR,
  }));

  const tasks = (old.tasks||[]).map(t=>({
    ...t,
    fileId: t.projectId,
    status: LEGACY_TS[t.status]||t.status||'not_started',
    leadPersonId: people.find(x=>x.name===t.assignees?.[0])?.id||null,
    supportPersonIds:(t.assignees||[]).slice(1).map(n=>people.find(x=>x.name===n)?.id).filter(Boolean),
    dependencies: t.dependsOn||[],
    priority: t.status==='Urgent'?'urgent':'medium',
    source:'manual', blocker:false,
    createdAt:TODAY_STR,
  }));

  return {
    files, tasks, deliverables:[],
    people, templates:old.templates||[],
    uiPrefs:old.uiPrefs||{},
    version:'1.0', migratedAt:TODAY_STR,
  };
}

// ─── BASE STYLES ──────────────────────────────────────────────────────────────
const ss = {
  inp: {width:'100%',background:T.s2,border:`1px solid ${T.bd2}`,borderRadius:5,color:T.tx,fontSize:12,padding:'5px 8px',outline:'none',fontFamily:T.font},
  sel: {width:'100%',background:T.s2,border:`1px solid ${T.bd2}`,borderRadius:5,color:T.tx,fontSize:12,padding:'5px 8px',outline:'none',fontFamily:T.font},
  btn: {cursor:'pointer',fontSize:11,fontWeight:500,borderRadius:5,padding:'4px 10px',border:`1px solid ${T.bd2}`,background:T.s2,color:T.tx2,fontFamily:T.font},
  btnP:{cursor:'pointer',fontSize:11,fontWeight:600,borderRadius:5,padding:'5px 12px',border:'none',background:T.acc,color:'#fff',fontFamily:T.font},
  lbl: {fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:3,fontFamily:T.font},
  card:{background:T.s1,border:`1px solid ${T.bd}`,borderRadius:8,padding:'10px 12px'},
};

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Chip = ({text,bg,tx,small}) => (
  <span style={{fontSize:small?9:10,fontWeight:600,padding:small?'1px 5px':'2px 8px',borderRadius:10,background:bg,color:tx,whiteSpace:'nowrap',display:'inline-block',fontFamily:T.font}}>{text}</span>
);
const StatusDot = ({map,val}) => {
  const c=map?.[val]; if(!c) return null;
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:10,background:c.bg,color:c.tx}}>
    <span style={{width:5,height:5,borderRadius:'50%',background:c.tx,display:'inline-block',flexShrink:0}}/>
    {c.label}
  </span>;
};
const DueChip = ({date}) => { if(!date) return null; const c=DD[ds(date)]; return <Chip text={fmt(date)} bg={c.bg} tx={c.tx} small/>; };
const Fld = ({label,children,mb=10}) => <div style={{marginBottom:mb}}><span style={ss.lbl}>{label}</span>{children}</div>;
const Inp = ({value,onChange,placeholder,rows,style}) => rows
  ? <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...ss.inp,resize:'vertical',lineHeight:1.5,...style}}/>
  : <input value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...ss.inp,...style}}/>;

const Overlay = ({onClose,children,wide}) => (
  <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:50,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:60}}>
    <div onClick={e=>e.stopPropagation()} style={{background:T.s1,border:`1px solid ${T.bd2}`,borderRadius:10,padding:'1.25rem',width:wide?700:480,maxHeight:'82vh',overflowY:'auto',boxShadow:'0 24px 60px rgba(0,0,0,0.6)'}}>
      {children}
    </div>
  </div>
);
const ModalH = ({title,onClose}) => (
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${T.bd}`}}>
    <span style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.font}}>{title}</span>
    <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18,color:T.tx3,lineHeight:1}}>×</button>
  </div>
);

function ResizeHandle({currentWidth,onResizeLive,onResizeEnd}) {
  const startX=useRef(0),startW=useRef(0);
  const onMouseDown=e=>{
    e.preventDefault();startX.current=e.clientX;startW.current=currentWidth;
    const onMove=e=>{const w=Math.max(180,startW.current+(e.clientX-startX.current));onResizeLive(w);};
    const onUp=e=>{const w=Math.max(180,startW.current+(e.clientX-startX.current));onResizeEnd(w);document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
    document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);
  };
  return <div onMouseDown={onMouseDown} style={{width:5,cursor:'col-resize',flexShrink:0,background:'transparent',transition:'background .15s',zIndex:10}}
    onMouseEnter={e=>e.currentTarget.style.background=T.acc} onMouseLeave={e=>e.currentTarget.style.background='transparent'}/>;
}

function RichTextEditor({value,onChange,minHeight=80}) {
  const ref=useRef(null);const focused=useRef(false);
  useEffect(()=>{if(ref.current&&!focused.current)ref.current.innerHTML=value||"";},[value]);
  const exec=cmd=>{ref.current.focus();document.execCommand(cmd,false,null);setTimeout(()=>onChange(ref.current.innerHTML),10);};
  const btnS={...ss.btn,fontSize:11,padding:'2px 7px',lineHeight:'18px'};
  return (
    <div style={{border:`1px solid ${T.bd2}`,borderRadius:6,background:T.s2,overflow:'hidden'}}>
      <style>{`.pal-rte ul,.pal-rte ol{padding-left:24px;margin:3px 0}.pal-rte li{margin:2px 0}`}</style>
      <div style={{display:'flex',gap:3,padding:'4px 6px',borderBottom:`1px solid ${T.bd}`,background:T.s1,flexWrap:'wrap'}}>
        {[['B','bold'],['I','italic'],['U','underline']].map(([l,c])=><button key={c} onMouseDown={e=>{e.preventDefault();exec(c);}} style={btnS}>{l}</button>)}
        <button onMouseDown={e=>{e.preventDefault();exec('insertUnorderedList');}} style={btnS}>• List</button>
        <button onMouseDown={e=>{e.preventDefault();exec('insertOrderedList');}} style={btnS}>1. List</button>
        <button onMouseDown={e=>{e.preventDefault();exec('indent');}} style={btnS}>→</button>
        <button onMouseDown={e=>{e.preventDefault();exec('outdent');}} style={btnS}>←</button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning className="pal-rte"
        onFocus={()=>{focused.current=true;}}
        onBlur={()=>{focused.current=false;onChange(ref.current.innerHTML);}}
        onInput={()=>onChange(ref.current.innerHTML)}
        style={{minHeight,padding:'8px 10px',fontSize:13,color:T.tx,lineHeight:1.6,outline:'none',overflowY:'auto',fontFamily:T.font}}/>
    </div>
  );
}

// ─── TASK PANEL ───────────────────────────────────────────────────────────────
function TaskPanel({taskId,data,onClose,saveTask,delTask,onOpenTask}) {
  const task=data.tasks.find(t=>t.id===taskId);
  if(!task) return null;
  const file=getFile(data.files,task.fileId||task.projectId);
  const fileTasks=data.tasks.filter(t=>(t.fileId||t.projectId)===(task.fileId||task.projectId)&&t.id!==taskId);
  const blocked=isBlocked(task,data.tasks);
  const upd=ch=>saveTask(taskId,ch);
  const allPeople=[...(data.people||[]).map(p=>p.name),...(data.teamMembers||[])].filter((v,i,a)=>a.indexOf(v)===i);

  return (
    <div style={{width:360,flexShrink:0,borderLeft:`1px solid ${T.bd}`,background:T.s1,overflowY:'auto',maxHeight:'100%'}}>
      <div style={{padding:'12px 14px',borderBottom:`1px solid ${T.bd}`,display:'flex',alignItems:'flex-start',gap:8,position:'sticky',top:0,background:T.s1,zIndex:5}}>
        <div style={{flex:1}}>
          {file&&<div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',marginBottom:3,letterSpacing:'0.5px'}}>{file.title}</div>}
          <textarea value={task.title} onChange={e=>upd({title:e.target.value})} rows={2}
            style={{width:'100%',border:'none',outline:'none',background:'transparent',fontSize:13,fontWeight:600,color:T.tx,resize:'none',lineHeight:1.4,fontFamily:T.font}}/>
        </div>
        <button onClick={onClose} style={{background:'transparent',border:'none',color:T.tx3,cursor:'pointer',fontSize:18,lineHeight:1,padding:2}}>×</button>
      </div>
      <div style={{padding:'12px 14px'}}>
        {blocked&&<div style={{background:'rgba(217,95,95,0.12)',color:T.r,borderRadius:5,padding:'6px 10px',fontSize:11,marginBottom:10,fontWeight:500}}>⛔ Blocked by incomplete dependency</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          <Fld label="Status" mb={0}>
            <select value={task.status} onChange={e=>upd({status:e.target.value})} style={ss.sel}>
              {TASK_STATUS_OPTS.map(s=><option key={s} value={s}>{TS[s]?.label||s}</option>)}
              {!TASK_STATUS_OPTS.includes(task.status)&&<option value={task.status}>{TS[task.status]?.label||task.status}</option>}
            </select>
          </Fld>
          <Fld label="Due Date" mb={0}>
            <input type="date" value={task.dueDate||""} onChange={e=>upd({dueDate:e.target.value||null})} style={ss.sel}/>
          </Fld>
        </div>
        <Fld label="Assignees">
          <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:4}}>
            {taskAssignees(task).map(a=>(
              <span key={a} style={{fontSize:10,padding:'2px 6px',borderRadius:10,background:'rgba(91,156,246,0.12)',color:T.acc,display:'flex',alignItems:'center',gap:3}}>
                {a}<button onClick={()=>upd({assignees:taskAssignees(task).filter(x=>x!==a)})} style={{background:'transparent',border:'none',cursor:'pointer',color:T.acc,padding:0,fontSize:10,lineHeight:1}}>×</button>
              </span>
            ))}
          </div>
          <select value="" onChange={e=>{if(e.target.value&&!taskAssignees(task).includes(e.target.value))upd({assignees:[...taskAssignees(task),e.target.value]});}} style={ss.sel}>
            <option value="">+ Add assignee</option>
            {allPeople.filter(m=>!taskAssignees(task).includes(m)).map(m=><option key={m}>{m}</option>)}
          </select>
        </Fld>
        <Fld label="Dependencies">
          {(task.dependsOn||[]).map(did=>{
            const dep=data.tasks.find(t=>t.id===did);
            return dep?(
              <div key={did} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:`1px solid ${T.bd3}`}}>
                <span style={{fontSize:9,padding:'1px 5px',borderRadius:10,background:isDone(dep)?'rgba(63,182,139,0.12)':'rgba(217,95,95,0.12)',color:isDone(dep)?T.g:T.r}}>{isDone(dep)?'✓':'⏳'}</span>
                {onOpenTask?<button onClick={()=>onOpenTask(did)} style={{flex:1,background:'transparent',border:'none',cursor:'pointer',fontSize:11,color:T.acc,textAlign:'left',padding:0,textDecoration:'underline'}}>{dep.title}</button>
                 :<span style={{flex:1,fontSize:11,color:T.tx2}}>{dep.title}</span>}
                <button onClick={()=>upd({dependsOn:(task.dependsOn||[]).filter(x=>x!==did)})} style={{background:'transparent',border:'none',cursor:'pointer',color:T.tx3,fontSize:13}}>×</button>
              </div>
            ):null;
          })}
          <select value="" onChange={e=>{if(e.target.value&&!(task.dependsOn||[]).includes(e.target.value))upd({dependsOn:[...(task.dependsOn||[]),e.target.value]});}} style={{...ss.sel,marginTop:4}}>
            <option value="">+ Add dependency</option>
            {fileTasks.filter(t=>!(task.dependsOn||[]).includes(t.id)).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Fld>
        <Fld label="Notes"><Inp value={task.notes} onChange={v=>upd({notes:v})} placeholder="Notes…" rows={2}/></Fld>
        <Fld label="Gate / External blocker"><Inp value={task.gate} onChange={v=>upd({gate:v})} placeholder="e.g. Waiting for legal…"/></Fld>
        <button onClick={()=>{if(window.confirm("Delete this task?"))delTask(taskId);}}
          style={{width:'100%',padding:7,background:'transparent',border:`1px solid rgba(217,95,95,0.25)`,borderRadius:5,color:T.r,fontSize:11,cursor:'pointer',marginTop:4,fontFamily:T.font}}>
          Delete task
        </button>
      </div>
    </div>
  );
}

// ─── FILE CARD (dashboard) ────────────────────────────────────────────────────
function FileCard({file,data,onClick,selected}) {
  const openTasks=data.tasks.filter(t=>(t.fileId||t.projectId)===file.id&&!isDone(t));
  const nextTask=openTasks.sort((a,b)=>{if(!a.dueDate&&!b.dueDate)return 0;if(!a.dueDate)return 1;if(!b.dueDate)return-1;return a.dueDate.localeCompare(b.dueDate);})[0];
  const nextMilestone=file.milestones?.filter(m=>m.status!=='completed'&&m.date)[0];
  const health=FH[file.health]||FH.unknown;
  const fs=FS[file.status]||FS.active;
  const fp=FP[file.priority]||FP.medium;

  return (
    <div onClick={onClick} style={{
      background:selected?T.s3:T.s1,
      border:`1px solid ${selected?T.acc:T.bd}`,
      borderRadius:8,padding:'12px 14px',cursor:'pointer',
      transition:'border-color .15s, background .15s',
      boxShadow:selected?`0 0 0 1px ${T.acc}40`:'none',
    }}
    onMouseEnter={e=>{if(!selected){e.currentTarget.style.borderColor=T.bd2;e.currentTarget.style.background=T.s2;}}}
    onMouseLeave={e=>{if(!selected){e.currentTarget.style.borderColor=T.bd;e.currentTarget.style.background=T.s1;}}}>
      {/* Health bar */}
      <div style={{height:2,background:health.tx,borderRadius:1,marginBottom:10,opacity:0.7}}/>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:600,color:T.tx,lineHeight:1.3,marginBottom:4}}>{file.title}</div>
        <div style={{fontSize:11,color:T.tx2}}>{file.lead||'—'}</div>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
        <StatusDot map={FS} val={file.status}/>
        {file.health!=='unknown'&&<StatusDot map={FH} val={file.health}/>}
        {file.priority!=='medium'&&<StatusDot map={FP} val={file.priority}/>}
      </div>
      {nextTask&&<div style={{fontSize:11,color:T.tx2,background:T.s2,borderRadius:4,padding:'4px 8px',marginBottom:6,borderLeft:`2px solid ${T.acc}40`}}>
        <span style={{color:T.tx3,fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>Next task · </span>{nextTask.title.slice(0,50)}
        {nextTask.dueDate&&<span style={{float:'right'}}><DueChip date={nextTask.dueDate}/></span>}
      </div>}
      {nextMilestone&&!nextTask&&<div style={{fontSize:11,color:T.tx2,background:T.s2,borderRadius:4,padding:'4px 8px',marginBottom:6,borderLeft:`2px solid ${T.y}40`}}>
        <span style={{color:T.tx3,fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>Milestone · </span>{nextMilestone.title}
      </div>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:10,color:T.tx3}}>{openTasks.length} open task{openTasks.length!==1?'s':''}</span>
        <span style={{fontSize:10,color:T.tx3}}>{file.updatedAt?fmt(file.updatedAt):'—'}</span>
      </div>
    </div>
  );
}

// ─── FILE PAGE ────────────────────────────────────────────────────────────────
function FilePage({file,data,onClose,saveFile,saveTask,delTask,newTask,addLogEntry,allPeople}) {
  const [tab,setTab]=useState('memory');
  const [selTask,setSelTask]=useState(null);
  const [addingTask,setAddingTask]=useState(false);
  const [newTaskTitle,setNTT]=useState("");
  const [addingLog,setAddingLog]=useState(false);
  const [logText,setLogText]=useState("");
  const [logTitle,setLogTitle]=useState("");
  const [addingMilestone,setAddingMilestone]=useState(false);
  const [newMilestone,setNM]=useState({title:'',status:'not_started',date:''});
  const [addingLink,setAddingLink]=useState(false);
  const [newLink,setNL]=useState({label:'',url:'',type:'folder'});
  const [editingTitle,setEditingTitle]=useState(false);
  const [titleVal,setTitleVal]=useState(file.title);

  const fileTasks=data.tasks.filter(t=>(t.fileId||t.projectId)===file.id);
  const openTasks=fileTasks.filter(t=>!isDone(t));
  const fs=FS[file.status]||FS.active;

  const TABS=[
    {id:'memory',label:'Memory'},
    {id:'tasks', label:`Tasks (${openTasks.length})`},
    {id:'milestones',label:'Milestones'},
    {id:'links',label:'Links'},
    {id:'log',  label:`Log (${(file.log||[]).length})`},
  ];

  const tabBtn = id => ({
    padding:'6px 12px',fontSize:11,fontWeight:600,border:'none',cursor:'pointer',
    color:tab===id?T.acc:T.tx3,borderBottom:`2px solid ${tab===id?T.acc:'transparent'}`,
    background:'transparent',transition:'color .1s',fontFamily:T.font,
  });

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'14px 16px',borderBottom:`1px solid ${T.bd}`,background:T.hdr,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
          <div style={{flex:1}}>
            {editingTitle
              ? <input autoFocus value={titleVal} onChange={e=>setTitleVal(e.target.value)}
                  onBlur={()=>{saveFile(file.id,{title:titleVal});setEditingTitle(false);}}
                  onKeyDown={e=>{if(e.key==='Enter'){saveFile(file.id,{title:titleVal});setEditingTitle(false);}if(e.key==='Escape')setEditingTitle(false);}}
                  style={{...ss.inp,fontSize:16,fontWeight:700,background:'transparent',borderColor:T.acc}}/>
              : <h2 onClick={()=>setEditingTitle(true)} style={{fontSize:16,fontWeight:700,color:T.tx,margin:0,cursor:'text',lineHeight:1.2}} title="Click to edit">{file.title}</h2>
            }
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:20,color:T.tx3,lineHeight:1,padding:0}}>×</button>
        </div>
        {/* Badge row */}
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          <StatusDot map={FS} val={file.status}/>
          <StatusDot map={FH} val={file.health}/>
          <StatusDot map={FP} val={file.priority}/>
          {file.lead&&<span style={{fontSize:10,color:T.tx2,padding:'2px 7px',borderRadius:10,background:T.s2,border:`1px solid ${T.bd}`}}>👤 {file.lead}</span>}
        </div>
        {/* Editable meta row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
          <Fld label="Status" mb={0}>
            <select value={file.status} onChange={e=>saveFile(file.id,{status:e.target.value})} style={ss.sel}>
              {FILE_STATUS_OPTS.map(s=><option key={s} value={s}>{FS[s]?.label||s}</option>)}
            </select>
          </Fld>
          <Fld label="Health" mb={0}>
            <select value={file.health||'unknown'} onChange={e=>saveFile(file.id,{health:e.target.value})} style={ss.sel}>
              {HEALTH_OPTS.map(s=><option key={s} value={s}>{FH[s]?.label||s}</option>)}
            </select>
          </Fld>
          <Fld label="Priority" mb={0}>
            <select value={file.priority||'medium'} onChange={e=>saveFile(file.id,{priority:e.target.value})} style={ss.sel}>
              {PRIORITY_OPTS.map(s=><option key={s} value={s}>{FP[s]?.label||s}</option>)}
            </select>
          </Fld>
        </div>
      </div>
      {/* Tabs */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${T.bd}`,background:T.s1,flexShrink:0,paddingLeft:6}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={tabBtn(t.id)}>{t.label}</button>)}
      </div>
      {/* Tab content */}
      <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>

        {/* ── MEMORY ── */}
        {tab==='memory'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={ss.lbl}>CURRENT FILE STATE</span>
              <button onClick={()=>setAddingLog(true)} style={{...ss.btn,fontSize:10}}>+ Log entry</button>
            </div>
            <RichTextEditor value={file.memory||""} onChange={v=>saveFile(file.id,{memory:v})} minHeight={200}/>
            {file.latestUpdate&&<div style={{marginTop:10,padding:'8px 10px',background:T.s2,borderRadius:5,borderLeft:`2px solid ${T.acc}50`}}>
              <span style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',display:'block',marginBottom:2}}>Latest update</span>
              <span style={{fontSize:12,color:T.tx2}}>{file.latestUpdate}</span>
            </div>}
            {addingLog&&(
              <div style={{marginTop:14,border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px'}}>
                <Fld label="Entry title"><Inp value={logTitle} onChange={setLogTitle} placeholder="What changed?"/></Fld>
                <Fld label="Summary" mb={6}><Inp value={logText} onChange={setLogText} placeholder="Describe what changed and who confirmed it…" rows={3}/></Fld>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>{if(logText.trim()){addLogEntry(file.id,logText,logTitle||'Update');setLogText('');setLogTitle('');setAddingLog(false);}}} style={ss.btnP}>Add entry</button>
                  <button onClick={()=>{setAddingLog(false);setLogText('');setLogTitle('');}} style={ss.btn}>Cancel</button>
                </div>
              </div>
            )}
            <button onClick={()=>setTab('log')} style={{...ss.btn,marginTop:10,fontSize:10,color:T.tx3}}>View log ({(file.log||[]).length} entries) →</button>
          </div>
        )}

        {/* ── TASKS ── */}
        {tab==='tasks'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontSize:11,color:T.tx2}}>{openTasks.length} open · {fileTasks.filter(isDone).length} done</span>
              <button onClick={()=>setAddingTask(true)} style={ss.btnP}>+ Add task</button>
            </div>
            {addingTask&&(
              <div style={{display:'flex',gap:4,marginBottom:10}}>
                <input autoFocus value={newTaskTitle} onChange={e=>setNTT(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&newTaskTitle.trim()){newTask({title:newTaskTitle.trim(),fileId:file.id,projectId:file.id,assignees:['Karl'],status:'not_started',dueDate:null,dependsOn:[],dependencies:[],gate:'',notes:'',link:null,approvalChain:[],source:'manual',createdAt:TODAY_STR});setNTT('');setAddingTask(false);}if(e.key==='Escape')setAddingTask(false);}}
                  placeholder="Task title…" style={{...ss.inp,flex:1}}/>
                <button onClick={()=>setAddingTask(false)} style={ss.btn}>Cancel</button>
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {fileTasks.filter(t=>!isDone(t)).map(task=>{
                const blocked=isBlocked(task,data.tasks);
                return (
                  <div key={task.id} onClick={()=>setSelTask(selTask===task.id?null:task.id)}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',background:selTask===task.id?T.s3:'transparent',borderRadius:4}}
                    onMouseEnter={e=>{if(selTask!==task.id)e.currentTarget.style.background=T.s2;}}
                    onMouseLeave={e=>{if(selTask!==task.id)e.currentTarget.style.background='transparent';}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:T.tx,fontWeight:500,lineHeight:1.3,marginBottom:3}}>{task.title}</div>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                        <StatusDot map={TS} val={task.status}/>
                        {blocked&&<Chip text="⛔ Blocked" bg="rgba(217,95,95,0.12)" tx={T.r} small/>}
                        {task.dueDate&&<DueChip date={task.dueDate}/>}
                        {taskAssignees(task).map(a=><Chip key={a} text={a} bg="rgba(91,156,246,0.10)" tx={T.acc} small/>)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {fileTasks.filter(isDone).length>0&&(
                <details style={{marginTop:8}}>
                  <summary style={{fontSize:10,color:T.tx3,cursor:'pointer',padding:'4px 0'}}>Completed tasks ({fileTasks.filter(isDone).length})</summary>
                  {fileTasks.filter(isDone).map(task=>(
                    <div key={task.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderBottom:`1px solid ${T.bd3}`,opacity:0.5}}>
                      <span style={{fontSize:11,color:T.tx3,textDecoration:'line-through'}}>{task.title}</span>
                      <StatusDot map={TS} val={task.status}/>
                    </div>
                  ))}
                </details>
              )}
            </div>
            {selTask&&<div style={{marginTop:10,border:`1px solid ${T.bd}`,borderRadius:8,overflow:'hidden'}}>
              <TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>
            </div>}
          </div>
        )}

        {/* ── MILESTONES ── */}
        {tab==='milestones'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={ss.lbl}>KEY MILESTONES & DATES</span>
              <button onClick={()=>setAddingMilestone(true)} style={ss.btnP}>+ Add milestone</button>
            </div>
            {addingMilestone&&(
              <div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <Fld label="Title" mb={0}><Inp value={newMilestone.title} onChange={v=>setNM(x=>({...x,title:v}))} placeholder="Milestone name"/></Fld>
                  <Fld label="Date (optional)" mb={0}><input type="date" value={newMilestone.date} onChange={e=>setNM(x=>({...x,date:e.target.value}))} style={ss.inp}/></Fld>
                </div>
                <Fld label="Status" mb={8}>
                  <select value={newMilestone.status} onChange={e=>setNM(x=>({...x,status:e.target.value}))} style={ss.sel}>
                    {MILESTONE_STATUS.map(s=><option key={s} value={s}>{MS_LABEL[s]}</option>)}
                  </select>
                </Fld>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>{if(newMilestone.title.trim()){saveFile(file.id,{milestones:[...(file.milestones||[]),{id:uid(),...newMilestone}]});setNM({title:'',status:'not_started',date:''});setAddingMilestone(false);}}} style={ss.btnP}>Add</button>
                  <button onClick={()=>setAddingMilestone(false)} style={ss.btn}>Cancel</button>
                </div>
              </div>
            )}
            {(file.milestones||[]).length===0&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic'}}>No milestones yet.</div>}
            {(file.milestones||[]).map(m=>(
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderBottom:`1px solid ${T.bd3}`}}>
                <span style={{flex:1,fontSize:12,color:m.status==='completed'?T.tx3:T.tx,textDecoration:m.status==='completed'?'line-through':'none'}}>{m.title}</span>
                {m.date&&<DueChip date={m.date}/>}
                <select value={m.status} onChange={e=>saveFile(file.id,{milestones:(file.milestones||[]).map(x=>x.id===m.id?{...x,status:e.target.value}:x)})} style={{...ss.sel,width:'auto',fontSize:10,padding:'2px 6px'}}>
                  {MILESTONE_STATUS.map(s=><option key={s} value={s}>{MS_LABEL[s]}</option>)}
                </select>
                <button onClick={()=>saveFile(file.id,{milestones:(file.milestones||[]).filter(x=>x.id!==m.id)})} style={{background:'transparent',border:'none',cursor:'pointer',color:T.tx3,fontSize:13}}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* ── LINKS ── */}
        {tab==='links'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={ss.lbl}>SHAREPOINT LINKS</span>
              <button onClick={()=>setAddingLink(true)} style={ss.btnP}>+ Add link</button>
            </div>
            {addingLink&&(
              <div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <Fld label="Label" mb={0}><Inp value={newLink.label} onChange={v=>setNL(x=>({...x,label:v}))} placeholder="e.g. SharePoint folder"/></Fld>
                  <Fld label="Type" mb={0}>
                    <select value={newLink.type} onChange={e=>setNL(x=>({...x,type:e.target.value}))} style={ss.sel}>
                      {LINK_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                    </select>
                  </Fld>
                </div>
                <Fld label="URL" mb={8}><Inp value={newLink.url} onChange={v=>setNL(x=>({...x,url:v}))} placeholder="https://viarailonline.sharepoint.com/…"/></Fld>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>{if(newLink.url.trim()){saveFile(file.id,{sharePointLinks:[...(file.sharePointLinks||[]),{id:uid(),createdAt:TODAY_STR,...newLink}]});setNL({label:'',url:'',type:'folder'});setAddingLink(false);}}} style={ss.btnP}>Add</button>
                  <button onClick={()=>setAddingLink(false)} style={ss.btn}>Cancel</button>
                </div>
              </div>
            )}
            {(file.sharePointLinks||[]).length===0&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic'}}>No links yet. Add SharePoint folder or document links here.</div>}
            {(file.sharePointLinks||[]).map(lnk=>(
              <div key={lnk.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:`1px solid ${T.bd}`,borderRadius:5,marginBottom:5,background:T.s2}}>
                <div style={{flex:1,minWidth:0}}>
                  <a href={lnk.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:T.acc,fontWeight:500,display:'block',marginBottom:2}}>{lnk.label||lnk.url}</a>
                  <span style={{fontSize:9,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.4px'}}>{(lnk.type||'folder').replace(/_/g,' ')}</span>
                </div>
                <button onClick={()=>saveFile(file.id,{sharePointLinks:(file.sharePointLinks||[]).filter(l=>l.id!==lnk.id)})} style={{background:'transparent',border:'none',cursor:'pointer',color:T.tx3,fontSize:13}}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* ── LOG ── */}
        {tab==='log'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={ss.lbl}>CHANGE LOG</span>
              <button onClick={()=>setAddingLog(true)} style={ss.btnP}>+ Add entry</button>
            </div>
            {addingLog&&(
              <div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:12}}>
                <Fld label="Title"><Inp value={logTitle} onChange={setLogTitle} placeholder="What changed?"/></Fld>
                <Fld label="Summary" mb={6}><Inp value={logText} onChange={setLogText} placeholder="Describe what changed and who confirmed it…" rows={3}/></Fld>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>{if(logText.trim()){addLogEntry(file.id,logText,logTitle||'Update');setLogText('');setLogTitle('');setAddingLog(false);}}} style={ss.btnP}>Add</button>
                  <button onClick={()=>{setAddingLog(false);setLogText('');setLogTitle('');}} style={ss.btn}>Cancel</button>
                </div>
              </div>
            )}
            {(file.log||[]).length===0&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic'}}>No log entries yet.</div>}
            {(file.log||[]).map(entry=>(
              <div key={entry.id} style={{padding:'10px 0',borderBottom:`1px solid ${T.bd3}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
                  <span style={{fontSize:11,fontWeight:600,color:T.tx}}>{entry.title||'Update'}</span>
                  <span style={{fontSize:10,color:T.tx3,fontFamily:T.mono}}>{fmt(entry.date)}</span>
                </div>
                <p style={{margin:0,fontSize:12,color:T.tx2,lineHeight:1.6}}>{entry.summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({data,saveFile,saveTask,delTask,newTask,addLogEntry}) {
  const [filter,setFilter]=useState('active');
  const [selFile,setSelFile]=useState(null);
  const [splitW,setSplitW]=useState(460);
  const [liveW,setLiveW]=useState(null);
  const w=liveW??splitW;

  const files=data.files.filter(f=>!f.archived);
  const filtered=filter==='all'?files:filter==='mine'?files.filter(f=>f.lead==='Karl'):files.filter(f=>f.status===filter);
  const activeFile=selFile?data.files.find(f=>f.id===selFile):null;
  const allPeople=(data.people||[]);

  const FILTERS=[
    {k:'all',label:'All'},
    {k:'active',label:'Active'},
    {k:'monitoring',label:'Monitoring'},
    {k:'mine',label:'My Files'},
  ];

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{width:w,flexShrink:0,overflowY:'auto',padding:'12px',borderRight:`1px solid ${T.bd}`}}>
        {/* Filter bar */}
        <div style={{display:'flex',gap:5,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          {FILTERS.map(f=><button key={f.k} onClick={()=>setFilter(f.k)} style={{...ss.btn,background:filter===f.k?T.acc:'transparent',color:filter===f.k?'#fff':T.tx2,border:`1px solid ${filter===f.k?T.acc:T.bd}`}}>{f.label}</button>)}
          <span style={{marginLeft:'auto',fontSize:11,color:T.tx3}}>{filtered.length} file{filtered.length!==1?'s':''}</span>
        </div>
        {/* Urgency buckets */}
        {['urgent','high'].map(pri=>{
          const bucket=filtered.filter(f=>f.priority===pri);
          if(!bucket.length) return null;
          return <div key={pri} style={{marginBottom:10}}>
            <div style={{fontSize:9,fontWeight:700,color:FP[pri].tx,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:6,paddingLeft:2}}>{FP[pri].label} ({bucket.length})</div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {bucket.map(f=><FileCard key={f.id} file={f} data={data} onClick={()=>setSelFile(selFile===f.id?null:f.id)} selected={selFile===f.id}/>)}
            </div>
          </div>;
        })}
        {/* Rest */}
        <div style={{marginBottom:6}}>
          {filtered.filter(f=>!['urgent','high'].includes(f.priority)).length>0&&(
            <div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:6,paddingLeft:2}}>Other</div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {filtered.filter(f=>!['urgent','high'].includes(f.priority)).map(f=>(
              <FileCard key={f.id} file={f} data={data} onClick={()=>setSelFile(selFile===f.id?null:f.id)} selected={selFile===f.id}/>
            ))}
          </div>
        </div>
      </div>
      <ResizeHandle currentWidth={w} onResizeLive={setLiveW} onResizeEnd={v=>{setLiveW(null);setSplitW(v);}}/>
      {activeFile
        ? <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <FilePage file={activeFile} data={data} onClose={()=>setSelFile(null)}
              saveFile={saveFile} saveTask={saveTask} delTask={delTask} newTask={newTask}
              addLogEntry={addLogEntry} allPeople={data.people||[]}/>
          </div>
        : <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}>
            <div style={{fontSize:32,opacity:0.12}}>⬡</div>
            <span style={{fontSize:13,color:T.tx3,fontStyle:'italic'}}>Select a file to view</span>
          </div>
      }
    </div>
  );
}

// ─── FILES VIEW ───────────────────────────────────────────────────────────────
function FilesView({data,saveFile,saveTask,delTask,newTask,addLogEntry,showAddFile}) {
  const [search,setSearch]=useState('');
  const [statusF,setStatusF]=useState('all');
  const [selFile,setSelFile]=useState(null);
  const [splitW,setSplitW]=useState(320);
  const [liveW,setLiveW]=useState(null);
  const w=liveW??splitW;

  const files=data.files.filter(f=>!f.archived)
    .filter(f=>statusF==='all'||f.status===statusF)
    .filter(f=>!search||f.title.toLowerCase().includes(search.toLowerCase())||f.lead?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{const po={urgent:0,high:1,medium:2,low:3};return (po[a.priority]||2)-(po[b.priority]||2);});

  const activeFile=selFile?data.files.find(f=>f.id===selFile):null;

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{width:w,flexShrink:0,borderRight:`1px solid ${T.bd}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Search + filter */}
        <div style={{padding:'10px 12px',borderBottom:`1px solid ${T.bd}`,background:T.s1,flexShrink:0}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…" style={{...ss.inp,marginBottom:6}}/>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {['all',...FILE_STATUS_OPTS].map(s=>(
              <button key={s} onClick={()=>setStatusF(s)} style={{...ss.btn,fontSize:10,padding:'2px 8px',background:statusF===s?T.acc:'transparent',color:statusF===s?'#fff':T.tx2,border:`1px solid ${statusF===s?T.acc:T.bd}`}}>
                {s==='all'?'All':FS[s]?.label||s}
              </button>
            ))}
          </div>
        </div>
        {/* File list */}
        <div style={{flex:1,overflowY:'auto'}}>
          {files.map(f=>{
            const fs=FS[f.status]||FS.active;
            const openT=data.tasks.filter(t=>(t.fileId||t.projectId)===f.id&&!isDone(t)).length;
            return (
              <div key={f.id} onClick={()=>setSelFile(selFile===f.id?null:f.id)}
                style={{padding:'10px 12px',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',background:selFile===f.id?T.s3:'transparent',borderLeft:`3px solid ${selFile===f.id?T.acc:FS[f.status]?.dot||T.tx3}`}}
                onMouseEnter={e=>{if(selFile!==f.id)e.currentTarget.style.background=T.s2;}}
                onMouseLeave={e=>{if(selFile!==f.id)e.currentTarget.style.background='transparent';}}>
                <div style={{fontSize:12,fontWeight:600,color:T.tx,marginBottom:3,lineHeight:1.3}}>{f.title}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    <StatusDot map={FS} val={f.status}/>
                    {f.priority!=='medium'&&<StatusDot map={FP} val={f.priority}/>}
                  </div>
                  <span style={{fontSize:10,color:T.tx3}}>{openT} task{openT!==1?'s':''}</span>
                </div>
                {f.lead&&<div style={{fontSize:10,color:T.tx3,marginTop:2}}>👤 {f.lead}</div>}
              </div>
            );
          })}
        </div>
        <div style={{padding:'8px 12px',borderTop:`1px solid ${T.bd}`,background:T.s1,flexShrink:0}}>
          <button onClick={showAddFile} style={{...ss.btnP,width:'100%',textAlign:'center'}}>+ New file</button>
        </div>
      </div>
      <ResizeHandle currentWidth={w} onResizeLive={setLiveW} onResizeEnd={v=>{setLiveW(null);setSplitW(v);}}/>
      {activeFile
        ? <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <FilePage file={activeFile} data={data} onClose={()=>setSelFile(null)}
              saveFile={saveFile} saveTask={saveTask} delTask={delTask} newTask={newTask}
              addLogEntry={addLogEntry} allPeople={data.people||[]}/>
          </div>
        : <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}>
            <div style={{fontSize:32,opacity:0.12}}>⬡</div>
            <span style={{fontSize:13,color:T.tx3,fontStyle:'italic'}}>Select a file to open</span>
          </div>
      }
    </div>
  );
}

// ─── TODAY / MY WEEK VIEW ─────────────────────────────────────────────────────
function TodayView({data,saveTask,delTask,saveUiPref}) {
  const [selTask,setSelTask]=useState(null);
  const [dragId,setDragId]=useState(null);
  const [dragOverId,setDragOverId]=useState(null);

  const savedOrder=data.uiPrefs?.todayOrder||[];

  const allMyTasks=data.tasks.filter(t=>isMyTask(t)&&!isDone(t));
  const overdue=allMyTasks.filter(t=>t.dueDate&&ds(t.dueDate)==='overdue');
  const todayRaw=allMyTasks.filter(t=>t.dueDate&&ds(t.dueDate)==='today');
  const today=[...savedOrder.map(id=>todayRaw.find(t=>t.id===id)).filter(Boolean),...todayRaw.filter(t=>!savedOrder.includes(t.id))];
  const thisWeek=allMyTasks.filter(t=>t.dueDate&&ds(t.dueDate)==='soon');
  const noDate=allMyTasks.filter(t=>!t.dueDate);

  const handleDrop=(targetId)=>{
    if(!dragId||dragId===targetId) return;
    const list=[...today];
    const fromIdx=list.findIndex(t=>t.id===dragId);
    const toIdx=list.findIndex(t=>t.id===targetId);
    if(fromIdx===-1||toIdx===-1) return;
    const moved=list.splice(fromIdx,1)[0];
    list.splice(toIdx,0,moved);
    saveUiPref('todayOrder',list.map(t=>t.id));
    setDragId(null);setDragOverId(null);
  };

  const TaskRow=({task,draggable:isDraggable})=>{
    const file=getFile(data.files,task.fileId||task.projectId);
    const blocked=isBlocked(task,data.tasks);
    const isDragOver=dragOverId===task.id;
    return (
      <div
        draggable={isDraggable}
        onDragStart={()=>setDragId(task.id)}
        onDragEnd={()=>{setDragId(null);setDragOverId(null);}}
        onDragOver={e=>{e.preventDefault();setDragOverId(task.id);}}
        onDrop={()=>handleDrop(task.id)}
        onClick={()=>setSelTask(selTask===task.id?null:task.id)}
        style={{
          display:'flex',alignItems:'center',gap:8,padding:'8px 10px',
          borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',
          background:selTask===task.id?T.s3:isDragOver?T.s3:'transparent',
          borderTop:isDragOver?`2px solid ${T.acc}`:'2px solid transparent',
          opacity:dragId===task.id?0.4:1,
          transition:'opacity .1s',
        }}
        onMouseEnter={e=>{if(selTask!==task.id&&!isDragOver)e.currentTarget.style.background=T.s2;}}
        onMouseLeave={e=>{if(selTask!==task.id&&!isDragOver)e.currentTarget.style.background='transparent';}}>
        {isDraggable&&<span style={{color:T.tx3,fontSize:12,cursor:'grab',flexShrink:0}}>⠿</span>}
        <div style={{flex:1,minWidth:0}}>
          {file&&<div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:1}}>{file.title}</div>}
          <div style={{fontSize:12,color:T.tx,fontWeight:500,lineHeight:1.3}}>{task.title}</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center',marginTop:3}}>
            <StatusDot map={TS} val={task.status}/>
            {blocked&&<Chip text="⛔ Blocked" bg="rgba(217,95,95,0.12)" tx={T.r} small/>}
            {task.dueDate&&<DueChip date={task.dueDate}/>}
          </div>
        </div>
        <button onClick={e=>{e.stopPropagation();saveTask(task.id,{status:'completed'});}} style={{...ss.btn,fontSize:10,padding:'2px 7px',color:T.g,borderColor:'rgba(63,182,139,0.3)'}}>✓ Done</button>
      </div>
    );
  };

  const Section=({title,tasks,draggable,accent})=>{
    if(!tasks.length) return null;
    return (
      <div style={{marginBottom:16}}>
        <div style={{fontSize:9,fontWeight:700,color:accent||T.tx3,textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:4,paddingLeft:2}}>
          {title} <span style={{opacity:0.6}}>({tasks.length})</span>
        </div>
        <div style={{border:`1px solid ${T.bd}`,borderRadius:6,overflow:'hidden',background:T.s1}}>
          {tasks.map(t=><TaskRow key={t.id} task={t} draggable={draggable}/>)}
        </div>
      </div>
    );
  };

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto',padding:'14px 16px',maxWidth:640}}>
        <div style={{marginBottom:14}}>
          <h3 style={{margin:'0 0 2px',fontSize:16,fontWeight:700,color:T.tx,fontFamily:T.font}}>
            {new Date().toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}
          </h3>
          <div style={{fontSize:11,color:T.tx3}}>{allMyTasks.length} open tasks · {overdue.length} overdue</div>
        </div>
        <Section title="Overdue" tasks={overdue} accent={T.r}/>
        <Section title="Today" tasks={today} draggable accent={T.y}/>
        {today.length===0&&overdue.length===0&&<div style={{padding:'14px',border:`1px solid ${T.bd}`,borderRadius:6,background:T.s1,marginBottom:14,fontSize:12,color:T.tx3,fontStyle:'italic',textAlign:'center'}}>Nothing due today or overdue.</div>}
        <Section title="Next 3 days" tasks={thisWeek} accent={T.acc}/>
        <Section title="No date" tasks={noDate}/>
      </div>
      {selTask&&<TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}
    </div>
  );
}

// ─── CALENDAR VIEW (adapted) ──────────────────────────────────────────────────
function CalendarView({data,calMode,setCalMode,saveTask,delTask}) {
  const [refDate,setRefDate]=useState(TODAY);
  const [selTask,setSelTask]=useState(null);
  const yr=refDate.getFullYear(),mo=refDate.getMonth();

  const tasksByDate=useMemo(()=>{
    const map={};
    data.tasks.filter(t=>t.dueDate&&!isDone(t)).forEach(t=>{if(!map[t.dueDate])map[t.dueDate]=[];map[t.dueDate].push(t);});
    return map;
  },[data.tasks]);

  const fileForTask=t=>getFile(data.files,t.fileId||t.projectId);

  if(calMode==='weekly'){
    const days=wkDays(refDate);
    return (
      <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{flex:1,padding:12,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexShrink:0}}>
          <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setDate(d.getDate()-7);return x;})} style={ss.btn}>‹</button>
          <span style={{fontSize:13,fontWeight:600,color:T.tx}}>Week of {fmt(toStr(days[0]))} – {fmt(toStr(days[6]))}</span>
          <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setDate(d.getDate()+7);return x;})} style={ss.btn}>›</button>
          <button onClick={()=>setRefDate(TODAY)} style={{...ss.btn,fontSize:10}}>Today</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5,flex:1,minHeight:0,overflow:'auto'}}>
          {days.map((day,di)=>{
            const dStr=toStr(day),isToday=dStr===TODAY_STR;
            const dayTasks=tasksByDate[dStr]||[];
            return (
              <div key={di} style={{background:isToday?'rgba(91,156,246,0.06)':T.s1,border:`1px solid ${isToday?T.acc:T.bd}`,borderRadius:6,padding:'8px',display:'flex',flexDirection:'column'}}>
                <div style={{fontSize:11,fontWeight:700,color:isToday?T.acc:T.tx2,marginBottom:5,flexShrink:0}}>{WD[di]}<br/><span style={{fontSize:14}}>{day.getDate()}</span></div>
                <div style={{flex:1,overflowY:'auto',minHeight:0}}>
                  {dayTasks.map(t=>{
                    const file=fileForTask(t);const ts=TS[t.status];
                    return (
                      <div key={t.id} onClick={()=>setSelTask(selTask===t.id?null:t.id)} style={{background:selTask===t.id?T.s3:T.s2,border:`1px solid ${selTask===t.id?T.acc:T.bd}`,borderRadius:4,padding:'4px 6px',marginBottom:4,cursor:'pointer'}}>
                        {file&&<div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',marginBottom:1}}>{file.title?.slice(0,20)}</div>}
                        <div style={{fontSize:11,color:T.tx,lineHeight:1.3}}>{t.title}</div>
                        <StatusDot map={TS} val={t.status}/>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selTask&&<TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}
      </div>
    );
  }

  // Monthly view
  const wks=weeksOfMonth(yr,mo);
  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
    <div style={{flex:1,padding:12,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexShrink:0}}>
        <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setMonth(d.getMonth()-1);return x;})} style={ss.btn}>‹</button>
        <span style={{fontSize:13,fontWeight:600,color:T.tx}}>{MONTHS_FULL[mo]} {yr}</span>
        <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setMonth(d.getMonth()+1);return x;})} style={ss.btn}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,marginBottom:2,flexShrink:0}}>
        {WD.map(d=><div key={d} style={{fontSize:10,fontWeight:700,color:T.tx3,textAlign:'center',padding:'3px 0'}}>{d}</div>)}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:1,overflow:'auto'}}>
        {wks.map((wk,wi)=>(
          <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,flex:1}}>
            {wk.map((day,di)=>{
              const dStr=toStr(day),isToday=dStr===TODAY_STR,inMonth=day.getMonth()===mo;
              const dayTasks=(tasksByDate[dStr]||[]).slice(0,3);
              return (
                <div key={di} style={{padding:'3px 4px',background:isToday?'rgba(91,156,246,0.06)':inMonth?T.s1:T.s2,border:`1px solid ${isToday?T.acc:T.bd3}`,borderRadius:3,minHeight:52,overflow:'hidden'}}>
                  <div style={{fontSize:11,fontWeight:isToday?700:400,color:inMonth?T.tx2:T.tx3,marginBottom:2}}>{day.getDate()}</div>
                  {dayTasks.map(t=>{
                    const file=fileForTask(t);const ts=TS[t.status];
                    return (
                      <div key={t.id} onClick={()=>setSelTask(selTask===t.id?null:t.id)}
                        style={{fontSize:10,background:ts?.bg||T.s2,color:ts?.tx||T.tx2,borderRadius:2,padding:'2px 4px',marginBottom:2,cursor:'pointer',lineHeight:1.3,wordBreak:'break-word'}}>
                        {file&&<span style={{opacity:0.6,marginRight:2}}>{file.title?.slice(0,10)}·</span>}{t.title}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
    {selTask&&<TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}
    </div>
  );
}

// ─── PEOPLE VIEW ──────────────────────────────────────────────────────────────
function PeopleView({data}) {
  const [selPerson,setSelPerson]=useState(null);
  const people=(data.people||[]).filter(p=>p.active!==false);

  const getWorkload=name=>({
    filesLed:   data.files.filter(f=>f.lead===name&&!f.archived),
    filesSupp:  data.files.filter(f=>(f.supportPersonIds||[]).includes(name)&&!f.archived),
    tasksOpen:  data.tasks.filter(t=>isMyTask({assignees:[name],...t})&&taskAssignees(t).includes(name)&&!isDone(t)),
    overdue:    data.tasks.filter(t=>taskAssignees(t).includes(name)&&!isDone(t)&&t.dueDate&&ds(t.dueDate)==='overdue'),
  });

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{width:240,flexShrink:0,borderRight:`1px solid ${T.bd}`,overflowY:'auto'}}>
        {people.map(p=>{
          const wl=getWorkload(p.name);
          const load=wl.filesLed.length+wl.tasksOpen.length;
          return (
            <div key={p.id} onClick={()=>setSelPerson(selPerson===p.id?null:p.id)}
              style={{padding:'10px 12px',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',background:selPerson===p.id?T.s3:'transparent'}}
              onMouseEnter={e=>{if(selPerson!==p.id)e.currentTarget.style.background=T.s2;}}
              onMouseLeave={e=>{if(selPerson!==p.id)e.currentTarget.style.background='transparent';}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:2}}>
                <span style={{fontSize:13,fontWeight:600,color:T.tx}}>{p.name}</span>
                {wl.overdue.length>0&&<span style={{fontSize:10,color:T.r,fontWeight:600}}>{wl.overdue.length} overdue</span>}
              </div>
              {p.title&&<div style={{fontSize:11,color:T.tx3,marginBottom:4}}>{p.title}</div>}
              <div style={{display:'flex',gap:6}}>
                <span style={{fontSize:10,color:T.tx2}}>{wl.filesLed.length} file{wl.filesLed.length!==1?'s':''} led</span>
                <span style={{fontSize:10,color:T.tx3}}>·</span>
                <span style={{fontSize:10,color:T.tx2}}>{wl.tasksOpen.length} task{wl.tasksOpen.length!==1?'s':''}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>
        {selPerson?(()=>{
          const p=people.find(x=>x.id===selPerson);
          if(!p) return null;
          const wl=getWorkload(p.name);
          return (
            <div>
              <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:T.tx,fontFamily:T.font}}>{p.name}</h3>
              {p.title&&<div style={{fontSize:12,color:T.tx2,marginBottom:14}}>{p.title}</div>}
              {wl.filesLed.length>0&&<div style={{marginBottom:14}}>
                <div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:6}}>Files Led ({wl.filesLed.length})</div>
                {wl.filesLed.map(f=><div key={f.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:`1px solid ${T.bd3}`}}>
                  <span style={{fontSize:12,color:T.tx,flex:1}}>{f.title}</span>
                  <StatusDot map={FS} val={f.status}/>
                  <StatusDot map={FH} val={f.health}/>
                </div>)}
              </div>}
              {wl.tasksOpen.length>0&&<div style={{marginBottom:14}}>
                <div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:6}}>Open Tasks ({wl.tasksOpen.length})</div>
                {wl.tasksOpen.map(t=>{const file=getFile(data.files,t.fileId||t.projectId);return (
                  <div key={t.id} style={{padding:'5px 0',borderBottom:`1px solid ${T.bd3}`}}>
                    {file&&<div style={{fontSize:9,color:T.tx3,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.3px'}}>{file.title}</div>}
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:12,color:T.tx,flex:1}}>{t.title}</span>
                      <StatusDot map={TS} val={t.status}/>
                      {t.dueDate&&<DueChip date={t.dueDate}/>}
                    </div>
                  </div>
                );})}
              </div>}
            </div>
          );
        })():<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:T.tx3,fontSize:13,fontStyle:'italic'}}>Select a person</div>}
      </div>
    </div>
  );
}

// ─── CLAUDE VIEW ──────────────────────────────────────────────────────────────
const CLAUDE_SYSTEM_PROMPT = `You are helping me manage communications files using Palantír, my file-control app.

CONTEXT: I will paste the current Palantír state JSON, followed by my notes (meeting notes, transcripts, or bullet points from my week).

YOUR TASK:
1. Read the current state carefully.
2. Parse my notes. Identify: completed tasks, new tasks, memory updates, log entries, changed dates, milestone updates, new SharePoint links, status/health changes.
3. Walk me through proposed changes FILE BY FILE. Ask clarifying questions when needed.
4. Once I confirm, produce a final JSON update package.

RULES:
- Only create a separate task when it has a distinct owner, deadline, approval, dependency, or follow-up.
- Put supporting details in notes, not as separate tasks.
- Memory = current live state. Log = what changed and who confirmed it (e.g. "Train frequencies confirmed by William-Antoine").
- Always group tasks under their file.
- Use FlexibleDate language for uncertain dates ("week of June 10", "in June", "TBD").
- Final output must be a single valid JSON block using the import schema below.

IMPORT SCHEMA:
{
  "importType": "palantir_update_package",
  "version": "1.0",
  "sourceDate": "YYYY-MM-DD",
  "summary": "one-line description",
  "filesToCreate": [],
  "filesToUpdate": [{"fileId":"...","fileTitle":"...","changes":{}}],
  "memoryUpdates": [{"fileId":"...","fileTitle":"...","newMemory":"...","reasonForChange":"..."}],
  "logEntriesToCreate": [{"fileId":"...","fileTitle":"...","date":"YYYY-MM-DD","title":"...","summary":"..."}],
  "tasksToCreate": [{"fileId":"...","title":"...","assignees":["Karl"],"status":"not_started","dueDate":null,"notes":""}],
  "tasksToUpdate": [{"taskId":"...","taskTitle":"...","changes":{}}],
  "tasksToComplete": [{"taskId":"...","taskTitle":"..."}],
  "milestonesToCreate": [{"fileId":"...","fileTitle":"...","title":"...","status":"not_started","date":null}],
  "warnings": []
}`;

function ClaudeView({data,onImport}) {
  const [tab,setTab]=useState('export');
  const [exportScope,setExportScope]=useState('active');
  const [incLogs,setIncLogs]=useState(false);
  const [copied,setCopied]=useState(false);
  const [importJson,setImportJson]=useState('');
  const [importErr,setImportErr]=useState('');
  const [preview,setPreview]=useState(null);
  const [applied,setApplied]=useState(false);

  const generateExport=()=>{
    const files=data.files.filter(f=>!f.archived&&(exportScope==='active'?f.status==='active':exportScope==='mine'?f.lead==='Karl':true));
    return JSON.stringify({
      exportType:'palantir_export',version:'1.0',exportedAt:TODAY_STR,
      systemPrompt:CLAUDE_SYSTEM_PROMPT,
      currentState:{
        files:files.map(f=>({
          id:f.id,title:f.title,status:f.status,health:f.health,priority:f.priority,lead:f.lead,
          memory:stripHtml(f.memory||''),
          milestones:(f.milestones||[]).map(m=>({title:m.title,status:m.status,date:m.date||null})),
          openTasks:data.tasks.filter(t=>(t.fileId||t.projectId)===f.id&&!isDone(t)).map(t=>({id:t.id,title:t.title,status:TS[t.status]?.label||t.status,dueDate:t.dueDate,assignees:taskAssignees(t),notes:t.notes||''})),
          sharePointLinks:(f.sharePointLinks||[]).map(l=>({label:l.label,url:l.url,type:l.type})),
          ...(incLogs&&{recentLog:(f.log||[]).slice(0,3).map(e=>({date:e.date,title:e.title,summary:e.summary}))}),
        })),
        people:(data.people||[]).map(p=>({id:p.id,name:p.name,title:p.title})),
      }
    },null,2);
  };

  const copyExport=()=>{
    navigator.clipboard.writeText(generateExport()).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});
  };

  const parseImport=(jsonStr)=>{
    try {
      const imp=JSON.parse(jsonStr);
      const changes=[];
      if(imp.memoryUpdates?.length) changes.push(`${imp.memoryUpdates.length} memory update(s)`);
      if(imp.logEntriesToCreate?.length) changes.push(`${imp.logEntriesToCreate.length} log entry(ies)`);
      if(imp.tasksToComplete?.length) changes.push(`${imp.tasksToComplete.length} task(s) completed`);
      if(imp.tasksToCreate?.length) changes.push(`${imp.tasksToCreate.length} new task(s)`);
      if(imp.tasksToUpdate?.length) changes.push(`${imp.tasksToUpdate.length} task update(s)`);
      if(imp.filesToCreate?.length) changes.push(`${imp.filesToCreate.length} new file(s)`);
      if(imp.filesToUpdate?.length) changes.push(`${imp.filesToUpdate.length} file update(s)`);
      if(imp.milestonesToCreate?.length) changes.push(`${imp.milestonesToCreate.length} milestone(s)`);
      if(changes.length===0) changes.push('No recognised changes found.');
      setPreview({imp,changes,summary:imp.summary||'No summary provided.'});
      setImportErr('');
    } catch(e) {
      setImportErr('Invalid JSON — check the format and try again.');
      setPreview(null);
    }
  };

  const tabS=id=>({padding:'6px 12px',fontSize:11,fontWeight:600,border:'none',cursor:'pointer',color:tab===id?T.acc:T.tx3,borderBottom:`2px solid ${tab===id?T.acc:'transparent'}`,background:'transparent',fontFamily:T.font});

  return (
    <div style={{height:'100%',overflow:'auto',padding:'14px 20px',maxWidth:720}}>
      <div style={{marginBottom:14}}>
        <h3 style={{margin:'0 0 2px',fontSize:16,fontWeight:700,color:T.tx,fontFamily:T.serif}}>Claude</h3>
        <p style={{margin:0,fontSize:12,color:T.tx2}}>Export current state for review, then import Claude's structured update package.</p>
      </div>
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${T.bd}`,marginBottom:14}}>
        <button onClick={()=>setTab('export')} style={tabS('export')}>Export</button>
        <button onClick={()=>setTab('import')} style={tabS('import')}>Import</button>
        <button onClick={()=>setTab('help')} style={tabS('help')}>How to use</button>
      </div>

      {tab==='export'&&(
        <div>
          <Fld label="Export scope">
            <select value={exportScope} onChange={e=>setExportScope(e.target.value)} style={{...ss.sel,width:'auto'}}>
              <option value="active">Active files only</option>
              <option value="mine">My files only</option>
              <option value="all">All files</option>
            </select>
          </Fld>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <input type="checkbox" id="inclogs" checked={incLogs} onChange={e=>setIncLogs(e.target.checked)}/>
            <label htmlFor="inclogs" style={{fontSize:12,color:T.tx2,cursor:'pointer'}}>Include recent log entries</label>
          </div>
          <button onClick={copyExport} style={{...ss.btnP,marginBottom:10}}>
            {copied?'✓ Copied!':'Copy export to clipboard'}
          </button>
          <div style={{fontSize:11,color:T.tx3,lineHeight:1.6}}>
            Paste this into Claude chat, then paste your meeting notes or week's notes. Claude will compare them and propose structured updates.
          </div>
        </div>
      )}

      {tab==='import'&&(
        <div>
          {!preview?(
            <>
              <Fld label="Paste Claude's update package JSON here">
                <textarea value={importJson} onChange={e=>setImportJson(e.target.value)} rows={12}
                  placeholder='{"importType":"palantir_update_package","version":"1.0",...}' style={{...ss.inp,resize:'vertical',fontFamily:T.mono,fontSize:11}}/>
              </Fld>
              {importErr&&<div style={{color:T.r,fontSize:11,marginBottom:8}}>{importErr}</div>}
              <button onClick={()=>parseImport(importJson)} style={ss.btnP}>Validate & Preview</button>
            </>
          ):(
            <div>
              {applied?(
                <div style={{padding:'16px',background:'rgba(63,182,139,0.08)',border:`1px solid rgba(63,182,139,0.2)`,borderRadius:6,textAlign:'center'}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.g,marginBottom:4}}>✓ Import applied</div>
                  <button onClick={()=>{setPreview(null);setImportJson('');setApplied(false);}} style={ss.btn}>Import another</button>
                </div>
              ):(
                <>
                  <div style={{padding:'12px',background:T.s2,borderRadius:6,marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.tx,marginBottom:4}}>Summary: {preview.summary}</div>
                    {preview.changes.map((c,i)=><div key={i} style={{fontSize:11,color:T.tx2,padding:'2px 0',borderBottom:`1px solid ${T.bd3}`}}>· {c}</div>)}
                    {(preview.imp.warnings||[]).map((w,i)=><div key={i} style={{fontSize:11,color:T.y,marginTop:4}}>⚠ {w}</div>)}
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>{onImport(preview.imp);setApplied(true);}} style={ss.btnP}>Apply changes</button>
                    <button onClick={()=>{setPreview(null);setImportJson('');}} style={ss.btn}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab==='help'&&(
        <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
          <div style={{marginBottom:10,fontWeight:600,color:T.tx}}>Workflow</div>
          {['1. Go to Export tab and copy the current state.','2. Open a new Claude chat (or your Palantír Claude Project).','3. Paste the export, then paste your weekly notes or meeting transcript.','4. Claude walks you through changes file by file and asks questions.','5. Once confirmed, Claude produces a JSON update package.','6. Come back here, go to Import tab, paste the JSON.','7. Review the preview and click Apply.'].map((s,i)=>(
            <div key={i} style={{padding:'5px 0',borderBottom:`1px solid ${T.bd3}`}}>{s}</div>
          ))}
          <div style={{marginTop:12,padding:'10px',background:T.s2,borderRadius:5,fontSize:11,color:T.tx3}}>
            The system prompt included in your export tells Claude exactly how Palantír works and what format to use for the import package.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADD FILE MODAL ───────────────────────────────────────────────────────────
function AddFileModal({data,onClose,onCreate}) {
  const [form,setForm]=useState({title:'',status:'active',priority:'medium',health:'unknown',lead:'Karl',memory:''});
  const allPeople=(data.people||[]).map(p=>p.name);
  return (
    <Overlay onClose={onClose}>
      <ModalH title="New File" onClose={onClose}/>
      <Fld label="Title"><Inp value={form.title} onChange={v=>setForm(x=>({...x,title:v}))} placeholder="File name"/></Fld>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Fld label="Status" mb={8}><select value={form.status} onChange={e=>setForm(x=>({...x,status:e.target.value}))} style={ss.sel}>{FILE_STATUS_OPTS.map(s=><option key={s} value={s}>{FS[s]?.label||s}</option>)}</select></Fld>
        <Fld label="Priority" mb={8}><select value={form.priority} onChange={e=>setForm(x=>({...x,priority:e.target.value}))} style={ss.sel}>{PRIORITY_OPTS.map(s=><option key={s} value={s}>{FP[s]?.label||s}</option>)}</select></Fld>
        <Fld label="Lead" mb={8}><select value={form.lead} onChange={e=>setForm(x=>({...x,lead:e.target.value}))} style={ss.sel}><option value="">—</option>{allPeople.map(m=><option key={m}>{m}</option>)}</select></Fld>
        <Fld label="Health" mb={8}><select value={form.health} onChange={e=>setForm(x=>({...x,health:e.target.value}))} style={ss.sel}>{HEALTH_OPTS.map(s=><option key={s} value={s}>{FH[s]?.label||s}</option>)}</select></Fld>
      </div>
      <Fld label="Initial memory / context (optional)"><Inp value={form.memory} onChange={v=>setForm(x=>({...x,memory:v}))} placeholder="Brief context…" rows={3}/></Fld>
      <button onClick={()=>{if(form.title.trim()){onCreate(form);onClose();}}} style={{...ss.btnP,width:'100%',marginTop:4}}>Create file</button>
    </Overlay>
  );
}

// ─── TEAM MODAL ───────────────────────────────────────────────────────────────
function TeamModal({data,onClose,setData}) {
  const [newName,setNewName]=useState('');
  const [newTitle,setNewTitle]=useState('');
  const people=data.people||[];
  return (
    <Overlay onClose={onClose} wide>
      <ModalH title="People & Team" onClose={onClose}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div>
          <div style={ss.lbl}>TEAM MEMBERS</div>
          <div style={{marginBottom:10}}>
            {people.map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',padding:'6px 0',borderBottom:`1px solid ${T.bd3}`}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:T.tx,fontWeight:500}}>{p.name}</div>
                  {p.title&&<div style={{fontSize:10,color:T.tx3}}>{p.title}</div>}
                </div>
                {p.name!=='Karl'&&<button onClick={()=>setData(d=>({...d,people:d.people.map(x=>x.id===p.id?{...x,active:!x.active}:x)}))} style={{...ss.btn,fontSize:10,padding:'2px 7px',color:p.active!==false?T.tx2:T.r}}>{p.active!==false?'Active':'Inactive'}</button>}
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:4}}>
            <Inp value={newName} onChange={setNewName} placeholder="Name"/>
            <Inp value={newTitle} onChange={setNewTitle} placeholder="Title / Role"/>
          </div>
          <button onClick={()=>{if(newName.trim()&&!people.find(p=>p.name===newName.trim())){setData(d=>({...d,people:[...(d.people||[]),{id:uid(),name:newName.trim(),title:newTitle.trim(),active:true}]}));setNewName('');setNewTitle('');}}} style={ss.btnP}>Add person</button>
        </div>
        <div>
          <div style={ss.lbl}>QUICK WORKLOAD SUMMARY</div>
          {people.filter(p=>p.active!==false).map(p=>{
            const led=data.files.filter(f=>f.lead===p.name&&!f.archived).length;
            const tasks=data.tasks.filter(t=>taskAssignees(t).includes(p.name)&&!isDone(t)).length;
            const overdue=data.tasks.filter(t=>taskAssignees(t).includes(p.name)&&!isDone(t)&&t.dueDate&&ds(t.dueDate)==='overdue').length;
            return (
              <div key={p.id} style={{padding:'6px 0',borderBottom:`1px solid ${T.bd3}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,color:T.tx,fontWeight:500}}>{p.name}</span>
                  <div style={{display:'flex',gap:6}}>
                    <span style={{fontSize:10,color:T.tx2}}>{led} files</span>
                    <span style={{fontSize:10,color:overdue>0?T.r:T.tx2}}>{tasks} tasks{overdue>0?` (${overdue} overdue)`:''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Overlay>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data,setData]=useState(null);
  const [view,setView]=useState('dashboard');
  const [calMode,setCalMode]=useState('monthly');
  const [saved,setSaved]=useState(true);
  const [modal,setModal]=useState(null);
  const saveRef=useRef(null);
  const navigate=useNavigate();

  // Inject fonts
  useEffect(()=>{
    const link=document.createElement('link');
    link.href=FONT_LINK;link.rel='stylesheet';
    document.head.appendChild(link);
    return ()=>{if(document.head.contains(link))document.head.removeChild(link);};
  },[]);

  // Load or migrate state
  useEffect(()=>{
    (async()=>{
      try {
        // Try palantir_state first
        const {data:row}=await supabase.from('palantir_state').select('state').eq('id',1).maybeSingle();
        if(row?.state&&Object.keys(row.state).length>0){setData(row.state);return;}
        // Fall back to migrating from planner_state
        const {data:oldRow}=await supabase.from('planner_state').select('state').eq('id',1).maybeSingle();
        if(oldRow?.state&&Object.keys(oldRow.state).length>0){
          const migrated=migrateFromPlanner(oldRow.state);
          setData(migrated);
        } else {
          setData({files:[],tasks:[],deliverables:[],people:[{id:'per-1',name:'Karl',title:'',active:true}],templates:[],uiPrefs:{},version:'1.0'});
        }
      } catch(e) {
        console.error('Load error',e);
        setData({files:[],tasks:[],deliverables:[],people:[{id:'per-1',name:'Karl',title:'',active:true}],templates:[],uiPrefs:{},version:'1.0'});
      }
    })();
  },[]);

  // Auto-save
  useEffect(()=>{
    if(!data) return;
    setSaved(false);
    if(saveRef.current) clearTimeout(saveRef.current);
    saveRef.current=setTimeout(async()=>{
      try {
        const {data:{user}}=await supabase.auth.getUser();
        await supabase.from('palantir_state').upsert({id:1,state:data,updated_at:new Date().toISOString(),user_id:user?.id});
        setSaved(true);
      } catch(e){console.error('Save error',e);}
    },800);
  },[data]);

  // Core mutators
  const saveFile=(id,ch)=>setData(d=>({...d,files:d.files.map(f=>f.id===id?{...f,...ch,updatedAt:TODAY_STR}:f)}));
  const saveTask=(id,ch)=>setData(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,...ch}:t)}));
  const delTask=id=>setData(d=>({...d,tasks:d.tasks.filter(t=>t.id!==id)}));
  const newTask=t=>setData(d=>({...d,tasks:[...d.tasks,{id:uid(),approvalChain:[],dependsOn:[],dependencies:[],assignees:[],link:null,notes:'',gate:'',source:'manual',createdAt:TODAY_STR,...t}]}));
  const addLogEntry=(fileId,summary,title='Update')=>setData(d=>({...d,files:d.files.map(f=>f.id===fileId?{...f,log:[{id:uid(),date:TODAY_STR,title,summary},...(f.log||[])],updatedAt:TODAY_STR}:f)}));
  const saveUiPref=(key,val)=>setData(d=>({...d,uiPrefs:{...(d.uiPrefs||{}),[key]:val}}));

  // Claude import handler
  const applyClaudeImport=imp=>{
    setData(d=>{
      const nd=JSON.parse(JSON.stringify(d)); // deep clone
      (imp.memoryUpdates||[]).forEach(u=>{const f=nd.files.find(x=>x.id===u.fileId||x.title===u.fileTitle);if(f){f.memory=u.newMemory;f.updatedAt=TODAY_STR;}});
      (imp.logEntriesToCreate||[]).forEach(e=>{const f=nd.files.find(x=>x.id===e.fileId||x.title===e.fileTitle);if(f){f.log=[{id:uid(),date:e.date||TODAY_STR,title:e.title||'Update',summary:e.summary},...(f.log||[])];f.updatedAt=TODAY_STR;}});
      (imp.tasksToComplete||[]).forEach(tc=>{const t=nd.tasks.find(x=>x.id===tc.taskId||x.title===tc.taskTitle);if(t){t.status='completed';t.completedAt=TODAY_STR;}});
      (imp.tasksToCreate||[]).forEach(t=>{nd.tasks.push({id:uid(),fileId:t.fileId,projectId:t.fileId,title:t.title,assignees:t.assignees||['Karl'],status:t.status||'not_started',dueDate:t.dueDate||null,dependsOn:[],dependencies:[],notes:t.notes||'',gate:'',link:null,approvalChain:[],source:'claude_import',createdAt:TODAY_STR});});
      (imp.tasksToUpdate||[]).forEach(tu=>{const t=nd.tasks.find(x=>x.id===tu.taskId||x.title===tu.taskTitle);if(t&&tu.changes)Object.assign(t,tu.changes);});
      (imp.filesToUpdate||[]).forEach(fu=>{const f=nd.files.find(x=>x.id===fu.fileId||x.title===fu.fileTitle);if(f&&fu.changes)Object.assign(f,fu.changes);});
      (imp.filesToCreate||[]).forEach(fc=>{nd.files.push({id:uid(),title:fc.title,status:fc.status||'active',priority:fc.priority||'medium',health:'unknown',lead:fc.lead||'Karl',memory:fc.memory||'',milestones:[],log:[],sharePointLinks:[],deliverableIds:[],archived:false,createdAt:TODAY_STR,updatedAt:TODAY_STR});});
      (imp.milestonesToCreate||[]).forEach(m=>{const f=nd.files.find(x=>x.id===m.fileId||x.title===m.fileTitle);if(f){f.milestones=[...(f.milestones||[]),{id:uid(),title:m.title,status:m.status||'not_started',date:m.date||''}];}});
      return nd;
    });
  };

  // Claude import bridge
  const handleClaudeImport=imp=>{applyClaudeImport(imp);};

  const createFile=form=>setData(d=>({...d,files:[...d.files,{id:uid(),title:form.title,status:form.status||'active',priority:form.priority||'medium',health:form.health||'unknown',lead:form.lead||'Karl',memory:form.memory||'',milestones:[],log:[],sharePointLinks:[],deliverableIds:[],archived:false,createdAt:TODAY_STR,updatedAt:TODAY_STR}]}));

  if(!data) return (
    <div style={{height:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.font}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:20,fontFamily:T.serif,color:T.acc2,marginBottom:8,letterSpacing:'0.05em'}}>Palantír</div>
        <div style={{fontSize:12,color:T.tx3}}>Loading…</div>
      </div>
    </div>
  );

  const urgentFiles=data.files.filter(f=>!f.archived&&(f.priority==='urgent'||f.health==='blocked'||f.health==='at_risk')).length;
  const overdueCount=data.tasks.filter(t=>isMyTask(t)&&!isDone(t)&&t.dueDate&&ds(t.dueDate)==='overdue').length;

  const NAV=[
    {id:'dashboard',label:'Dashboard'},
    {id:'files',    label:'Files'},
    {id:'today',    label:'Today'},
    {id:'calendar', label:'Calendar'},
    {id:'people',   label:'People'},
  ];

  return (
    <div style={{fontFamily:T.font,height:'100vh',display:'flex',flexDirection:'column',background:T.bg,overflow:'hidden',color:T.tx}}>
      {/* ── HEADER ── */}
      <div style={{background:T.hdr,borderBottom:`1px solid ${T.bd}`,padding:'0 14px',display:'flex',alignItems:'center',height:44,flexShrink:0,gap:0}}>
        {/* KarlOS back button */}
        <button onClick={()=>navigate('/')} style={{background:'rgba(91,156,246,0.12)',border:`1px solid rgba(91,156,246,0.2)`,borderRadius:5,padding:'3px 10px',fontSize:10,fontWeight:700,color:T.acc,cursor:'pointer',marginRight:12,fontFamily:T.font,letterSpacing:'0.02em'}}>KarlOS</button>
        {/* App title */}
        <span style={{fontFamily:T.serif,fontSize:15,fontWeight:600,color:T.acc2,letterSpacing:'0.06em',marginRight:18}}>Palantír</span>
        {/* Nav */}
        <div style={{display:'flex',gap:0}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)} style={{padding:'4px 12px',fontSize:12,fontWeight:500,border:'none',background:'transparent',cursor:'pointer',color:view===n.id?T.acc:T.tx2,borderBottom:`2px solid ${view===n.id?T.acc:'transparent'}`,borderRadius:0,fontFamily:T.font,transition:'color .1s'}}>
              {n.label}
            </button>
          ))}
        </div>
        {/* Calendar sub-nav */}
        {view==='calendar'&&(
          <div style={{display:'flex',gap:3,marginLeft:10}}>
            {['monthly','weekly'].map(m=><button key={m} onClick={()=>setCalMode(m)} style={{...ss.btn,fontSize:10,background:calMode===m?T.acc:'transparent',color:calMode===m?'#fff':T.tx2,border:`1px solid ${calMode===m?T.acc:T.bd}`,textTransform:'capitalize'}}>{m}</button>)}
          </div>
        )}
        {/* Right side */}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6}}>
          {urgentFiles>0&&<span style={{fontSize:10,background:'rgba(217,95,95,0.15)',color:T.r,borderRadius:10,padding:'1px 8px',fontWeight:600}}>{urgentFiles} urgent</span>}
          {overdueCount>0&&<span style={{fontSize:10,background:'rgba(212,146,42,0.15)',color:T.y,borderRadius:10,padding:'1px 8px',fontWeight:600}}>{overdueCount} overdue</span>}
          <button onClick={()=>setView('claude')} style={{...ss.btn,fontSize:11,color:view==='claude'?T.acc:T.tx2,background:view==='claude'?'rgba(91,156,246,0.10)':'transparent',border:`1px solid ${view==='claude'?T.acc:T.bd}`}}>Claude</button>
          <button onClick={()=>setModal('team')} style={{...ss.btn,fontSize:11}}>Team</button>
          <span style={{fontSize:10,color:saved?T.g:T.tx3,fontFamily:T.mono,marginLeft:4}}>{saved?'✓':'…'}</span>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {view==='dashboard'&&<Dashboard data={data} saveFile={saveFile} saveTask={saveTask} delTask={delTask} newTask={newTask} addLogEntry={addLogEntry}/>}
        {view==='files'   &&<FilesView data={data} saveFile={saveFile} saveTask={saveTask} delTask={delTask} newTask={newTask} addLogEntry={addLogEntry} showAddFile={()=>setModal('addFile')}/>}
        {view==='today'   &&<TodayView data={data} saveTask={saveTask} delTask={delTask} saveUiPref={saveUiPref}/>}
        {view==='calendar'&&<CalendarView data={data} calMode={calMode} setCalMode={setCalMode} saveTask={saveTask} delTask={delTask}/>}
        {view==='people'  &&<PeopleView data={data}/>}
        {view==='claude'  &&<ClaudeView data={data} onImport={handleClaudeImport}/>}
      </div>

      {/* ── MODALS ── */}
      {modal==='addFile'&&<AddFileModal data={data} onClose={()=>setModal(null)} onCreate={f=>{createFile(f);setModal(null);}}/>}
      {modal==='team'   &&<TeamModal data={data} onClose={()=>setModal(null)} setData={setData}/>}
    </div>
  );
}

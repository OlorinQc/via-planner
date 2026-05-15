import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

// ─── FONT ─────────────────────────────────────────────────────────────────────
const FONT_LINK="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T={
  bg:'#080a10',s1:'#0f1219',s2:'#141824',s3:'#1a1f2e',
  bd:'rgba(255,255,255,0.06)',bd2:'rgba(255,255,255,0.11)',bd3:'rgba(255,255,255,0.03)',
  tx:'#dde1ec',tx2:'#7e8a9e',tx3:'#3e4a5a',
  acc:'#5b9cf6',acc2:'#a8b8d0',
  g:'#3fb68b',y:'#d4922a',r:'#d95f5f',
  hdr:'#0a0c14',
  font:"'IBM Plex Sans', system-ui, sans-serif",
  mono:"'IBM Plex Mono', monospace",
  serif:"'Cinzel', serif",
};
const FS={active:{bg:'rgba(91,156,246,0.10)',tx:T.acc,dot:T.acc,label:'Active'},monitoring:{bg:'rgba(212,146,42,0.10)',tx:T.y,dot:T.y,label:'Monitoring'},paused:{bg:'rgba(62,74,90,0.20)',tx:T.tx2,dot:T.tx2,label:'On Ice'},completed:{bg:'rgba(63,182,139,0.10)',tx:T.g,dot:T.g,label:'Completed'},archived:{bg:'rgba(62,74,90,0.10)',tx:T.tx3,dot:T.tx3,label:'Archived'}};
const FH={on_track:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'On Track'},at_risk:{bg:'rgba(212,146,42,0.10)',tx:T.y,label:'At Risk'},blocked:{bg:'rgba(217,95,95,0.12)',tx:T.r,label:'Blocked'},unknown:{bg:'rgba(62,74,90,0.15)',tx:T.tx2,label:'Unknown'}};
const FP={urgent:{bg:'rgba(217,95,95,0.12)',tx:T.r,label:'Urgent'},high:{bg:'rgba(212,146,42,0.10)',tx:T.y,label:'High'},medium:{bg:'rgba(91,156,246,0.09)',tx:T.acc,label:'Medium'},low:{bg:'rgba(62,74,90,0.18)',tx:T.tx2,label:'Low'}};
const TS={not_started:{bg:'rgba(62,74,90,0.18)',tx:T.tx2,label:'To Do'},in_progress:{bg:'rgba(91,156,246,0.10)',tx:T.acc,label:'In Progress'},waiting:{bg:'rgba(168,184,208,0.10)',tx:T.acc2,label:'Waiting'},blocked:{bg:'rgba(217,95,95,0.12)',tx:T.r,label:'Blocked'},completed:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Done'},cancelled:{bg:'rgba(62,74,90,0.10)',tx:T.tx3,label:'Cancelled'},'Urgent':{bg:'rgba(217,95,95,0.13)',tx:T.r,label:'Urgent'},'In Progress':{bg:'rgba(91,156,246,0.10)',tx:T.acc,label:'In Progress'},'To Plan':{bg:'rgba(62,74,90,0.18)',tx:T.tx2,label:'To Do'},'Waiting':{bg:'rgba(168,184,208,0.10)',tx:T.acc2,label:'Waiting'},'Done':{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Done'}};
const DD={overdue:{bg:'rgba(217,95,95,0.14)',tx:T.r},today:{bg:'rgba(212,146,42,0.14)',tx:T.y},soon:{bg:'rgba(212,186,42,0.10)',tx:'#b8960a'},ok:{bg:'rgba(63,182,139,0.09)',tx:T.g}};
const DVS={not_started:{bg:'rgba(62,74,90,0.18)',tx:T.tx2,label:'Not Started'},in_progress:{bg:'rgba(91,156,246,0.10)',tx:T.acc,label:'In Progress'},in_review:{bg:'rgba(168,184,208,0.12)',tx:T.acc2,label:'In Review'},in_approval:{bg:'rgba(212,146,42,0.12)',tx:T.y,label:'In Approval'},approved:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Approved'},published:{bg:'rgba(63,182,139,0.18)',tx:T.g,label:'Published'},completed:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Completed'},blocked:{bg:'rgba(217,95,95,0.12)',tx:T.r,label:'Blocked'},cancelled:{bg:'rgba(62,74,90,0.10)',tx:T.tx3,label:'Cancelled'}};
const RISK_SEV={low:{bg:'rgba(62,74,90,0.18)',tx:T.tx2,label:'Low'},medium:{bg:'rgba(212,146,42,0.10)',tx:T.y,label:'Medium'},high:{bg:'rgba(217,95,95,0.12)',tx:T.r,label:'High'},critical:{bg:'rgba(217,95,95,0.22)',tx:'#ff4444',label:'Critical'}};
const RISK_ST={open:{bg:'rgba(217,95,95,0.10)',tx:T.r,label:'Open'},monitoring:{bg:'rgba(212,146,42,0.10)',tx:T.y,label:'Monitoring'},resolved:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Resolved'}};
const SENS_C={normal:{label:'Normal',color:T.tx3},sensitive:{label:'Sensitive',color:T.y},legal:{label:'Legal',color:T.r},executive:{label:'Executive',color:T.acc},public:{label:'Public',color:T.g},confidential:{label:'Confidential',color:T.r}};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TODAY=new Date();
const toStr=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const TODAY_STR=toStr(TODAY);
const MONTHS_FULL=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WD=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FILE_STATUS_OPTS=["active","monitoring","paused","completed"];
const HEALTH_OPTS=["on_track","at_risk","blocked","unknown"];
const PRIORITY_OPTS=["urgent","high","medium","low"];
const SENSITIVITY_OPTS=["normal","sensitive","legal","executive","public","confidential"];
const TASK_STATUS_OPTS=["not_started","in_progress","waiting","blocked","completed","cancelled"];
const MILESTONE_STATUS=["not_started","in_progress","completed","delayed","blocked"];
const MS_LABEL={not_started:'Pending',in_progress:'In Progress',completed:'Done',delayed:'Delayed',blocked:'Blocked'};
const LINK_TYPES=["folder","draft","approved_document","background","briefing_note","qa","press_release","media_statement","approval","transcript","meeting_notes","other"];
const DELIVERABLE_STATUS_OPTS=["not_started","in_progress","in_review","in_approval","approved","published","completed","blocked","cancelled"];
const DELIVERABLE_TYPES=[{value:'communication_plan',label:'Communication Plan'},{value:'press_release',label:'Press Release'},{value:'media_statement',label:'Media Statement'},{value:'qa',label:'Q&A'},{value:'message_map',label:'Message Map'},{value:'briefing_note',label:'Briefing Note'},{value:'internal_comms',label:'Internal Communication'},{value:'employee_comms',label:'Employee Communication'},{value:'passenger_comms',label:'Passenger Communication'},{value:'stakeholder_comms',label:'Stakeholder Note'},{value:'social_content',label:'Social Content'},{value:'speech',label:'Speech'},{value:'board_document',label:'Board Document'},{value:'website_publication',label:'Website Publication'},{value:'newswire',label:'Newswire Release'},{value:'video',label:'Video'},{value:'report',label:'Report'},{value:'other',label:'Other'}];
const dvLabel=v=>DELIVERABLE_TYPES.find(d=>d.value===v)?.label||v;

// ─── FLEXIBLE DATES ───────────────────────────────────────────────────────────
const FLEX_PRECISION=[{value:'exact',label:'Exact date'},{value:'range',label:'Date range'},{value:'week',label:'Week of'},{value:'month',label:'Month'},{value:'tbd',label:'TBD'}];
const FLEX_CONFIDENCE=[{value:'confirmed',label:'Confirmed'},{value:'tentative',label:'Tentative'},{value:'unknown',label:'Unknown'}];
function mkFlexDate(precision='exact',vals={}){return{precision,date:null,startDate:null,endDate:null,year:null,month:null,weekStartDate:null,label:'',confidence:'tentative',...vals};}
function fmtFlex(fd){if(!fd)return null;if(typeof fd==='string')return fmt(fd);const{precision,date,startDate,endDate,year,month,weekStartDate,label,confidence}=fd;const conf=confidence==='tentative'?'~':'';if(precision==='tbd')return label||'TBD';if(precision==='exact'&&date)return conf+fmt(date);if(precision==='range'&&startDate&&endDate)return conf+fmt(startDate)+' – '+fmt(endDate);if(precision==='week'&&weekStartDate){const d=pd(weekStartDate);return conf+'Week of '+MONTHS_SHORT[d.getMonth()]+' '+d.getDate();}if(precision==='month'&&year&&month!=null)return conf+MONTHS_SHORT[month-1]+' '+year;return label||'—';}
function flexToExact(fd){if(!fd)return null;if(typeof fd==='string')return fd;if(fd.precision==='exact')return fd.date;if(fd.precision==='range')return fd.startDate;if(fd.precision==='week')return fd.weekStartDate;return null;}
function dsFromFlex(fd){const s=flexToExact(fd);return s?ds(s):null;}
function flexDueColor(fd){const st=dsFromFlex(fd);return st?DD[st]:null;}

// ─── BUILT-IN TEMPLATES ───────────────────────────────────────────────────────
const FOUNDATIONAL_TASKS=[
  {title:'Confirm mandate and briefing',notes:'Clarify objective, audience, business owner, target timing, external partners, quote needs, bilingual needs, sensitivities, and approval path.',offsetDays:-14,requiresApproval:false},
  {title:'Gather source material and operational facts',notes:'Collect background documents, confirm facts with business owner, identify required source documents, and add relevant SharePoint links.',offsetDays:-10,requiresApproval:false},
  {title:'Prepare key messages',notes:'Prepare the core message, supporting messages, proof points, and sensitive issue framing.',offsetDays:-7,requiresApproval:false},
  {title:'Validate key messages',notes:'Secure approval of the key messages with the appropriate internal stakeholders.',offsetDays:-4,requiresApproval:true},
];
const BUILT_IN_TEMPLATES=[
  {id:'tpl-foundational',name:'Foundational Phase',description:'Common starting phase for all communications files: mandate, source material, key messages, validation.',deliverableType:'foundational_phase',defaultDurationDays:14,taskTemplates:FOUNDATIONAL_TASKS},
  {id:'tpl-press-release',name:'Press Release',description:'Full press release cycle including foundational phase, drafting, quote approvals, and publication.',deliverableType:'press_release',defaultDurationDays:21,includesFoundational:true,taskTemplates:[...FOUNDATIONAL_TASKS,{title:'Draft press release',notes:'Prepare first draft using approved key messages and confirmed facts.',offsetDays:-7,requiresApproval:false},{title:'Secure quote approvals',notes:'Confirm internal and external quotes, names, titles, and bilingual alignment.',offsetDays:-4,requiresApproval:false},{title:'Secure final content approval',notes:'Coordinate approval by file lead, director, executive, and external partner where required.',offsetDays:-3,requiresApproval:true},{title:'Prepare website publication',notes:'Prepare online version including title, body, metadata, and final approved content.',offsetDays:-2,requiresApproval:false},{title:'Prepare newswire version',notes:'Prepare newswire-ready version, confirm timing, distribution settings, and final approval.',offsetDays:-1,requiresApproval:false},{title:'Publish',notes:'Coordinate final publication through website and newswire channels.',offsetDays:0,requiresApproval:false},{title:'Monitor pickup and follow-up questions',notes:'Track media pickup, stakeholder reaction, follow-up questions, and required responses.',offsetDays:1,requiresApproval:false}]},
  {id:'tpl-media-statement',name:'Media Statement',description:'Reactive or proactive media statement: draft, validate, approve, finalize.',deliverableType:'media_statement',defaultDurationDays:7,taskTemplates:[{title:'Draft media statement',notes:'Prepare draft using approved key messages and confirmed facts.',offsetDays:-5,requiresApproval:false},{title:'Validate facts and positioning',notes:'Confirm accuracy of all claims with business owner.',offsetDays:-3,requiresApproval:false},{title:'Secure approval',notes:'Coordinate approval by file lead and appropriate executive.',offsetDays:-2,requiresApproval:true},{title:'Finalize and share approved version',notes:'Prepare final version for distribution. Add to SharePoint.',offsetDays:0,requiresApproval:false}]},
  {id:'tpl-qa',name:'Q&A',description:'Question and answer document: draft, validate, approve, finalize.',deliverableType:'qa',defaultDurationDays:10,taskTemplates:[{title:'Draft Q&A',notes:'Prepare anticipated questions and draft answers using approved key messages.',offsetDays:-7,requiresApproval:false},{title:'Validate facts and positioning',notes:'Verify accuracy of all answers with business owner and subject matter experts.',offsetDays:-4,requiresApproval:false},{title:'Secure approval',notes:'Coordinate approval by file lead and appropriate stakeholders.',offsetDays:-2,requiresApproval:true},{title:'Finalize and link SharePoint version',notes:'Prepare final version and add SharePoint link to the deliverable.',offsetDays:0,requiresApproval:false}]},
  {id:'tpl-internal-comms',name:'Internal Communication',description:'Internal email or article: draft, approve, distribute.',deliverableType:'internal_comms',defaultDurationDays:7,taskTemplates:[{title:'Draft internal communication',notes:'Prepare draft using approved key messages. Confirm audience and channel.',offsetDays:-5,requiresApproval:false},{title:'Approve internal communication',notes:'Coordinate approval with appropriate leadership.',offsetDays:-3,requiresApproval:true},{title:'Prepare publication or distribution',notes:'Finalize distribution list, format, and timing.',offsetDays:-1,requiresApproval:false},{title:'Publish or send',notes:'Distribute through confirmed channel.',offsetDays:0,requiresApproval:false}]},
  {id:'tpl-employee-comms',name:'Employee Communication',description:'Employee-facing communication: draft, approve, distribute.',deliverableType:'employee_comms',defaultDurationDays:7,taskTemplates:[{title:'Draft employee communication',notes:'Prepare draft for employee audience using approved messaging.',offsetDays:-5,requiresApproval:false},{title:'Approve employee communication',notes:'Coordinate approval with HR and appropriate leadership.',offsetDays:-3,requiresApproval:true},{title:'Prepare distribution',notes:'Confirm channel, distribution list, timing, and bilingual requirements.',offsetDays:-1,requiresApproval:false},{title:'Send or publish',notes:'Distribute through confirmed channel.',offsetDays:0,requiresApproval:false}]},
  {id:'tpl-passenger-comms',name:'Passenger Communication',description:'Passenger-facing communication: draft, approve, coordinate, publish.',deliverableType:'passenger_comms',defaultDurationDays:7,taskTemplates:[{title:'Draft passenger communication',notes:'Prepare draft for passenger audience. Confirm language and channel.',offsetDays:-5,requiresApproval:false},{title:'Approve passenger communication',notes:'Coordinate approval with Operations and appropriate leadership.',offsetDays:-3,requiresApproval:true},{title:'Coordinate channel publication',notes:'Confirm timing with web, digital, and station teams.',offsetDays:-1,requiresApproval:false},{title:'Publish or send',notes:'Execute final publication across confirmed channels.',offsetDays:0,requiresApproval:false}]},
  {id:'tpl-stakeholder-comms',name:'Stakeholder Note',description:'Stakeholder note or briefing: draft, approve, send.',deliverableType:'stakeholder_comms',defaultDurationDays:7,taskTemplates:[{title:'Draft stakeholder note',notes:'Prepare note for target stakeholder audience.',offsetDays:-4,requiresApproval:false},{title:'Approve stakeholder note',notes:'Coordinate approval with file lead and appropriate executive.',offsetDays:-2,requiresApproval:true},{title:'Prepare distribution list',notes:'Confirm recipient list and any personalization required.',offsetDays:-1,requiresApproval:false},{title:'Send note',notes:'Distribute to stakeholders.',offsetDays:0,requiresApproval:false}]},
  {id:'tpl-social',name:'Social Content',description:'Social media content: draft, approve, schedule/publish.',deliverableType:'social_content',defaultDurationDays:5,taskTemplates:[{title:'Draft social copy',notes:'Prepare social content aligned with key messages. Confirm platforms and formats.',offsetDays:-3,requiresApproval:false},{title:'Approve social copy',notes:'Coordinate approval with appropriate lead and confirm imagery.',offsetDays:-2,requiresApproval:true},{title:'Schedule or publish social copy',notes:'Schedule or publish on confirmed platforms and timing.',offsetDays:0,requiresApproval:false}]},
  {id:'tpl-message-map',name:'Message Map',description:'Core messaging framework for a file or initiative.',deliverableType:'message_map',defaultDurationDays:10,taskTemplates:[{title:'Draft key messages',notes:'Draft core message, supporting messages, proof points, and anticipated opposition.',offsetDays:-7,requiresApproval:false},{title:'Validate key messages',notes:'Review with business owner and subject matter experts.',offsetDays:-4,requiresApproval:false},{title:'Secure approval',notes:'Confirm final message map with appropriate leadership.',offsetDays:-2,requiresApproval:true},{title:'Finalize and add to SharePoint',notes:'Store final approved version in SharePoint and link to file.',offsetDays:0,requiresApproval:false}]},
];

// ─── UTILS ────────────────────────────────────────────────────────────────────
let _u=8000;
const uid=()=>`p${++_u}`;
const pd=s=>{if(!s)return null;const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
const ds=s=>{if(!s)return null;const n=Math.floor((pd(s)-TODAY)/864e5);return n<0?"overdue":n===0?"today":n<=3?"soon":"ok";};
const fmt=s=>s?pd(s).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):null;
const getMon=d=>{const day=d.getDay(),diff=day===0?-6:1-day,m=new Date(d);m.setDate(d.getDate()+diff);return m;};
const weeksOfMonth=(yr,mo)=>{const first=new Date(yr,mo,1),last=new Date(yr,mo+1,0);let mon=getMon(first);const wks=[];while(mon<=last){const wk=[];for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);wk.push(d);}wks.push(wk);mon=new Date(mon);mon.setDate(mon.getDate()+7);}return wks;};
const wkDays=d=>{const m=getMon(d);return Array.from({length:7},(_,i)=>{const x=new Date(m);x.setDate(m.getDate()+i);return x;});};
const isDone=t=>['Done','completed','cancelled'].includes(t.status);
const isDoneDV=d=>['completed','published','cancelled'].includes(d.status);
const isBlocked=(task,tasks)=>{const deps=[...(task.dependsOn||[]),(task.dependencies||[])].flat().filter(Boolean);return deps.length>0&&deps.some(id=>{const t=tasks.find(x=>x.id===id);return t&&!isDone(t);});};
const taskAssignees=t=>t.assignees||[];
const isMyTask=t=>taskAssignees(t).includes("Karl");
const getFile=(files,id)=>files?.find(f=>f.id===id);
const getDV=(deliverables,id)=>deliverables?.find(d=>d.id===id);
const stripHtml=h=>h?.replace(/<[^>]+>/g,"").trim()||"";
const addDays=(dateStr,n)=>{if(!dateStr)return null;const d=pd(dateStr);d.setDate(d.getDate()+n);return toStr(d);};
const allPeopleFrom=data=>[...(data.people||[]).map(p=>p.name),...(data.teamMembers||[])].filter((v,i,a)=>a.indexOf(v)===i);

// ─── MIGRATION ────────────────────────────────────────────────────────────────
const LEGACY_FS={'Active':'active','Watch':'monitoring','On Ice':'paused','Completed':'completed'};
const LEGACY_TS={'Urgent':'in_progress','In Progress':'in_progress','To Plan':'not_started','Waiting':'waiting','Done':'completed'};
function migrateFromPlanner(old){
  const people=(old.teamMembers||[]).map((name,i)=>({id:`per-${i+1}`,name,title:'',active:true}));
  (old.globalContacts||[]).forEach(c=>{if(!people.find(p=>p.name===c.name))people.push({id:c.id||uid(),name:c.name,title:c.title||'',active:true});});
  const files=(old.projects||[]).map(p=>({id:p.id,title:p.title,status:LEGACY_FS[p.status]||'active',priority:'medium',health:'unknown',sensitivity:'normal',lead:p.lead||'',leadPersonId:people.find(x=>x.name===p.lead)?.id||null,supportPersonIds:[],memory:p.background||'',latestUpdate:'',milestones:[],risks:[],openQuestions:[],log:(p.updateLog||[]).map(e=>({id:e.id,date:e.date,title:'Update',summary:stripHtml(e.text)||e.text||''})),sharePointLinks:(p.links||[]).map(l=>({...l,type:'folder',createdAt:TODAY_STR})),deliverableIds:[],archived:p.archived||false,archivedAt:p.archived?p.updatedAt:null,createdAt:p.updatedAt||TODAY_STR,updatedAt:p.updatedAt||TODAY_STR}));
  const tasks=(old.tasks||[]).map(t=>({...t,fileId:t.projectId,status:LEGACY_TS[t.status]||t.status||'not_started',leadPersonId:people.find(x=>x.name===t.assignees?.[0])?.id||null,supportPersonIds:(t.assignees||[]).slice(1).map(n=>people.find(x=>x.name===n)?.id).filter(Boolean),dependencies:t.dependsOn||[],priority:t.status==='Urgent'?'urgent':'medium',source:'manual',blocker:false,createdAt:TODAY_STR}));
  return{files,tasks,deliverables:[],people,templates:[],uiPrefs:old.uiPrefs||{},version:'1.0',migratedAt:TODAY_STR};
}

// ─── BASE STYLES ──────────────────────────────────────────────────────────────
const ss={
  inp:{width:'100%',background:T.s2,border:`1px solid ${T.bd2}`,borderRadius:5,color:T.tx,fontSize:12,padding:'5px 8px',outline:'none',fontFamily:T.font},
  sel:{width:'100%',background:T.s2,border:`1px solid ${T.bd2}`,borderRadius:5,color:T.tx,fontSize:12,padding:'5px 8px',outline:'none',fontFamily:T.font},
  btn:{cursor:'pointer',fontSize:11,fontWeight:500,borderRadius:5,padding:'4px 10px',border:`1px solid ${T.bd2}`,background:T.s2,color:T.tx2,fontFamily:T.font},
  btnP:{cursor:'pointer',fontSize:11,fontWeight:600,borderRadius:5,padding:'5px 12px',border:'none',background:T.acc,color:'#fff',fontFamily:T.font},
  lbl:{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:3,fontFamily:T.font},
};
// Text truncation helpers
const trunc={overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'};
const wrap2={overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',wordBreak:'break-word'};

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Chip=({text,bg,tx,small})=>(<span style={{fontSize:small?9:10,fontWeight:600,padding:small?'1px 5px':'2px 8px',borderRadius:10,background:bg,color:tx,whiteSpace:'nowrap',display:'inline-block',fontFamily:T.font,flexShrink:0}}>{text}</span>);
const StatusDot=({map,val})=>{const c=map?.[val];if(!c)return null;return<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:10,background:c.bg,color:c.tx,whiteSpace:'nowrap',flexShrink:0}}><span style={{width:5,height:5,borderRadius:'50%',background:c.tx,display:'inline-block',flexShrink:0}}/>{c.label}</span>;};
const DueChip=({date})=>{if(!date)return null;const c=DD[ds(date)];return<Chip text={fmt(date)} bg={c.bg} tx={c.tx} small/>;};
const FlexChip=({fd})=>{if(!fd)return null;const c=flexDueColor(fd);const label=fmtFlex(fd);if(!label||label==='—')return null;const style=c?{bg:c.bg,tx:c.tx}:{bg:'rgba(62,74,90,0.18)',tx:T.tx2};return<Chip text={label} bg={style.bg} tx={style.tx} small/>;};
const Fld=({label,children,mb=10})=><div style={{marginBottom:mb}}><span style={ss.lbl}>{label}</span>{children}</div>;
const Inp=({value,onChange,placeholder,rows,style})=>rows?<textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...ss.inp,resize:'vertical',lineHeight:1.5,...style}}/>:<input value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...ss.inp,...style}}/>;
const Overlay=({onClose,children,wide,extraWide})=>(<div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:50,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:60}}><div onClick={e=>e.stopPropagation()} style={{background:T.s1,border:`1px solid ${T.bd2}`,borderRadius:10,padding:'1.25rem',width:extraWide?860:wide?700:480,maxHeight:'82vh',overflowY:'auto',boxShadow:'0 24px 60px rgba(0,0,0,0.6)'}}>{children}</div></div>);
const ModalH=({title,onClose})=>(<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${T.bd}`}}><span style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.font}}>{title}</span><button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18,color:T.tx3,lineHeight:1}}>×</button></div>);

function ResizeHandle({currentWidth,onResizeLive,onResizeEnd}){
  const startX=useRef(0),startW=useRef(0);
  const onMouseDown=e=>{e.preventDefault();startX.current=e.clientX;startW.current=currentWidth;const onMove=e=>{const w=Math.max(180,startW.current+(e.clientX-startX.current));onResizeLive(w);};const onUp=e=>{const w=Math.max(180,startW.current+(e.clientX-startX.current));onResizeEnd(w);document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);};
  return<div onMouseDown={onMouseDown} style={{width:5,cursor:'col-resize',flexShrink:0,background:'transparent',transition:'background .15s',zIndex:10}} onMouseEnter={e=>e.currentTarget.style.background=T.acc} onMouseLeave={e=>e.currentTarget.style.background='transparent'}/>;
}

function RichTextEditor({value,onChange,minHeight=80}){
  const ref=useRef(null);const focused=useRef(false);
  useEffect(()=>{if(ref.current&&!focused.current)ref.current.innerHTML=value||"";},[value]);
  const exec=cmd=>{ref.current.focus();document.execCommand(cmd,false,null);setTimeout(()=>onChange(ref.current.innerHTML),10);};
  const btnS={...ss.btn,fontSize:11,padding:'2px 7px',lineHeight:'18px'};
  return(<div style={{border:`1px solid ${T.bd2}`,borderRadius:6,background:T.s2,overflow:'hidden'}}><style>{`.pal-rte ul,.pal-rte ol{padding-left:24px;margin:3px 0}.pal-rte li{margin:2px 0}`}</style><div style={{display:'flex',gap:3,padding:'4px 6px',borderBottom:`1px solid ${T.bd}`,background:T.s1,flexWrap:'wrap'}}>{[['B','bold'],['I','italic'],['U','underline']].map(([l,c])=><button key={c} onMouseDown={e=>{e.preventDefault();exec(c);}} style={btnS}>{l}</button>)}<button onMouseDown={e=>{e.preventDefault();exec('insertUnorderedList');}} style={btnS}>• List</button><button onMouseDown={e=>{e.preventDefault();exec('insertOrderedList');}} style={btnS}>1. List</button><button onMouseDown={e=>{e.preventDefault();exec('indent');}} style={btnS}>→</button><button onMouseDown={e=>{e.preventDefault();exec('outdent');}} style={btnS}>←</button></div><div ref={ref} contentEditable suppressContentEditableWarning className="pal-rte" onFocus={()=>{focused.current=true;}} onBlur={()=>{focused.current=false;onChange(ref.current.innerHTML);}} onInput={()=>onChange(ref.current.innerHTML)} style={{minHeight,padding:'8px 10px',fontSize:13,color:T.tx,lineHeight:1.6,outline:'none',overflowY:'auto',fontFamily:T.font}}/></div>);
}

function FlexDateInput({value,onChange,label}){
  const fd=value&&typeof value==='object'?value:null;
  const precision=fd?.precision||'exact';
  const confidence=fd?.confidence||'tentative';
  const upd=ch=>onChange({...(fd||mkFlexDate(precision)),precision,...ch});
  const inputStyle={...ss.inp,width:'auto',flex:1};
  return(<div>{label&&<span style={ss.lbl}>{label}</span>}<div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}><select value={precision} onChange={e=>{const p=e.target.value;onChange(mkFlexDate(p,{confidence}));}} style={{...ss.sel,width:'auto',flex:'0 0 110px',fontSize:11}}>{FLEX_PRECISION.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select>{precision==='exact'&&<input type="date" value={fd?.date||''} onChange={e=>upd({date:e.target.value||null})} style={inputStyle}/>}{precision==='range'&&<><input type="date" value={fd?.startDate||''} onChange={e=>upd({startDate:e.target.value||null})} style={inputStyle}/><span style={{color:T.tx3,fontSize:11}}>to</span><input type="date" value={fd?.endDate||''} onChange={e=>upd({endDate:e.target.value||null})} style={inputStyle}/></>}{precision==='week'&&<input type="date" value={fd?.weekStartDate||''} onChange={e=>upd({weekStartDate:e.target.value||null})} style={inputStyle} title="Select the Monday of the week"/>}{precision==='month'&&<><select value={fd?.month||1} onChange={e=>upd({month:parseInt(e.target.value)})} style={{...ss.sel,width:'auto',fontSize:11}}>{MONTHS_SHORT.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select><input type="number" value={fd?.year||new Date().getFullYear()} onChange={e=>upd({year:parseInt(e.target.value)||null})} style={{...inputStyle,width:70}} min={2024} max={2030}/></>}{precision==='tbd'&&<input value={fd?.label||''} onChange={e=>upd({label:e.target.value})} placeholder="Optional note…" style={inputStyle}/>}<select value={confidence} onChange={e=>upd({confidence:e.target.value})} style={{...ss.sel,width:'auto',fontSize:11,flex:'0 0 100px'}}>{FLEX_CONFIDENCE.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div></div>);
}

// ─── TASK PANEL ───────────────────────────────────────────────────────────────
function TaskPanel({taskId,data,onClose,saveTask,delTask,onOpenTask}){
  const task=data.tasks.find(t=>t.id===taskId);
  if(!task)return null;
  const file=getFile(data.files,task.fileId||task.projectId);
  const dv=getDV(data.deliverables,task.deliverableId);
  const fileTasks=data.tasks.filter(t=>(t.fileId||t.projectId)===(task.fileId||task.projectId)&&t.id!==taskId);
  const blocked=isBlocked(task,data.tasks);
  const upd=ch=>saveTask(taskId,ch);
  const people=allPeopleFrom(data);
  return(
    <div style={{width:360,flexShrink:0,borderLeft:`1px solid ${T.bd}`,background:T.s1,overflowY:'auto',maxHeight:'100%'}}>
      <div style={{padding:'12px 14px',borderBottom:`1px solid ${T.bd}`,display:'flex',alignItems:'flex-start',gap:8,position:'sticky',top:0,background:T.s1,zIndex:5}}>
        <div style={{flex:1,minWidth:0}}>
          {file&&<div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',marginBottom:1,letterSpacing:'0.5px',...trunc}}>{file.title}</div>}
          {dv&&<div style={{fontSize:9,color:T.acc,marginBottom:2,...trunc}}>↳ {dv.title}</div>}
          <textarea value={task.title} onChange={e=>upd({title:e.target.value})} rows={2} style={{width:'100%',border:'none',outline:'none',background:'transparent',fontSize:13,fontWeight:600,color:T.tx,resize:'none',lineHeight:1.4,fontFamily:T.font,wordBreak:'break-word'}}/>
        </div>
        <button onClick={onClose} style={{background:'transparent',border:'none',color:T.tx3,cursor:'pointer',fontSize:18,lineHeight:1,padding:2,flexShrink:0}}>×</button>
      </div>
      <div style={{padding:'12px 14px'}}>
        {blocked&&<div style={{background:'rgba(217,95,95,0.12)',color:T.r,borderRadius:5,padding:'6px 10px',fontSize:11,marginBottom:10,fontWeight:500}}>⛔ Blocked by incomplete dependency</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          <Fld label="Status" mb={0}><select value={task.status} onChange={e=>upd({status:e.target.value})} style={ss.sel}>{TASK_STATUS_OPTS.map(s=><option key={s} value={s}>{TS[s]?.label||s}</option>)}{!TASK_STATUS_OPTS.includes(task.status)&&<option value={task.status}>{TS[task.status]?.label||task.status}</option>}</select></Fld>
          <Fld label="Due Date" mb={0}><input type="date" value={task.dueDate||""} onChange={e=>upd({dueDate:e.target.value||null})} style={ss.sel}/></Fld>
        </div>
        <Fld label="Assignees"><div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:4}}>{taskAssignees(task).map(a=>(<span key={a} style={{fontSize:10,padding:'2px 6px',borderRadius:10,background:'rgba(91,156,246,0.12)',color:T.acc,display:'flex',alignItems:'center',gap:3,maxWidth:120,...trunc}}>{a}<button onClick={()=>upd({assignees:taskAssignees(task).filter(x=>x!==a)})} style={{background:'transparent',border:'none',cursor:'pointer',color:T.acc,padding:0,fontSize:10,lineHeight:1,flexShrink:0}}>×</button></span>))}</div><select value="" onChange={e=>{if(e.target.value&&!taskAssignees(task).includes(e.target.value))upd({assignees:[...taskAssignees(task),e.target.value]});}} style={ss.sel}><option value="">+ Add assignee</option>{people.filter(m=>!taskAssignees(task).includes(m)).map(m=><option key={m}>{m}</option>)}</select></Fld>
        <Fld label="Dependencies">{(task.dependsOn||[]).map(did=>{const dep=data.tasks.find(t=>t.id===did);return dep?(<div key={did} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:`1px solid ${T.bd3}`}}><span style={{fontSize:9,padding:'1px 5px',borderRadius:10,background:isDone(dep)?'rgba(63,182,139,0.12)':'rgba(217,95,95,0.12)',color:isDone(dep)?T.g:T.r,flexShrink:0}}>{isDone(dep)?'✓':'⏳'}</span>{onOpenTask?<button onClick={()=>onOpenTask(did)} style={{flex:1,background:'transparent',border:'none',cursor:'pointer',fontSize:11,color:T.acc,textAlign:'left',padding:0,textDecoration:'underline',...trunc}}>{dep.title}</button>:<span style={{flex:1,fontSize:11,color:T.tx2,...trunc}}>{dep.title}</span>}<button onClick={()=>upd({dependsOn:(task.dependsOn||[]).filter(x=>x!==did)})} style={{background:'transparent',border:'none',cursor:'pointer',color:T.tx3,fontSize:13,flexShrink:0}}>×</button></div>):null;})}<select value="" onChange={e=>{if(e.target.value&&!(task.dependsOn||[]).includes(e.target.value))upd({dependsOn:[...(task.dependsOn||[]),e.target.value]});}} style={{...ss.sel,marginTop:4}}><option value="">+ Add dependency</option>{fileTasks.filter(t=>!(task.dependsOn||[]).includes(t.id)).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></Fld>
        <Fld label="Notes"><Inp value={task.notes} onChange={v=>upd({notes:v})} placeholder="Notes…" rows={2}/></Fld>
        <Fld label="Gate / External blocker"><Inp value={task.gate} onChange={v=>upd({gate:v})} placeholder="e.g. Waiting for legal…"/></Fld>
        <button onClick={()=>{if(window.confirm("Delete this task?"))delTask(taskId);}} style={{width:'100%',padding:7,background:'transparent',border:`1px solid rgba(217,95,95,0.25)`,borderRadius:5,color:T.r,fontSize:11,cursor:'pointer',marginTop:4,fontFamily:T.font}}>Delete task</button>
      </div>
    </div>
  );
}

// ─── DELIVERABLE PANEL ────────────────────────────────────────────────────────
function DeliverablePanel({dvId,data,onClose,saveDeliverable,delDeliverable,saveTask,delTask,newTask}){
  const dv=data.deliverables?.find(d=>d.id===dvId);
  if(!dv)return null;
  const file=getFile(data.files,dv.fileId);
  const dvTasksAll=data.tasks.filter(t=>t.deliverableId===dvId);
  const [selTask,setSelTask]=useState(null);
  const [addingTask,setAddingTask]=useState(false);
  const [newTaskTitle,setNTT]=useState('');
  const [panelDragId,setPanelDragId]=useState(null);
  const [panelDragOver,setPanelDragOver]=useState(null);
  const upd=ch=>saveDeliverable(dvId,ch);
  const people=allPeopleFrom(data);

  // Ordered open tasks using dv.taskIds as the authority
  const openDvTasks=useMemo(()=>{
    const open=dvTasksAll.filter(t=>!isDone(t));
    const ord=dv.taskIds||[];
    return[...ord.map(id=>open.find(t=>t.id===id)).filter(Boolean),...open.filter(t=>!ord.includes(t.id))];
  },[dvTasksAll,dv.taskIds]);

  const dropPanelTask=(toTaskId)=>{
    if(!panelDragId||panelDragId===toTaskId)return;
    const base=[...new Set([...(dv.taskIds||[]),...dvTasksAll.map(t=>t.id)])];
    const fi=base.indexOf(panelDragId),ti=base.indexOf(toTaskId);
    if(fi!==-1&&ti!==-1){base.splice(fi,1);base.splice(ti,0,panelDragId);}
    saveDeliverable(dvId,{taskIds:base});
    setPanelDragId(null);setPanelDragOver(null);
  };
  return(
    <div style={{width:400,flexShrink:0,borderLeft:`1px solid ${T.bd}`,background:T.s1,overflowY:'auto',maxHeight:'100%',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'12px 14px',borderBottom:`1px solid ${T.bd}`,position:'sticky',top:0,background:T.s1,zIndex:5}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            {file&&<div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',marginBottom:2,letterSpacing:'0.5px',...trunc}}>{file.title}</div>}
            <textarea value={dv.title} onChange={e=>upd({title:e.target.value})} rows={2} style={{width:'100%',border:'none',outline:'none',background:'transparent',fontSize:13,fontWeight:600,color:T.tx,resize:'none',lineHeight:1.4,fontFamily:T.font}}/>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:T.tx3,cursor:'pointer',fontSize:18,lineHeight:1,padding:2,flexShrink:0}}>×</button>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}><StatusDot map={DVS} val={dv.status}/>{dv.type&&<Chip text={dvLabel(dv.type)} bg={T.s3} tx={T.acc2} small/>}</div>
      </div>
      <div style={{padding:'12px 14px',flex:1,overflowY:'auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          <Fld label="Type" mb={0}><select value={dv.type||'other'} onChange={e=>upd({type:e.target.value})} style={ss.sel}>{DELIVERABLE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></Fld>
          <Fld label="Status" mb={0}><select value={dv.status||'not_started'} onChange={e=>upd({status:e.target.value})} style={ss.sel}>{DELIVERABLE_STATUS_OPTS.map(s=><option key={s} value={s}>{DVS[s]?.label||s}</option>)}</select></Fld>
        </div>
        <Fld label="Owner"><select value={dv.ownerName||''} onChange={e=>upd({ownerName:e.target.value})} style={ss.sel}><option value="">—</option>{people.map(m=><option key={m}>{m}</option>)}</select></Fld>
        <Fld label="Due Date"><FlexDateInput value={dv.dueDate} onChange={v=>upd({dueDate:v})}/></Fld>
        <Fld label="Publication Date"><FlexDateInput value={dv.publicationDate} onChange={v=>upd({publicationDate:v})}/></Fld>
        <Fld label="Approval Status"><select value={dv.approvalStatus||'not_required'} onChange={e=>upd({approvalStatus:e.target.value})} style={ss.sel}><option value="not_required">Not required</option><option value="pending">Pending</option><option value="partially_approved">Partially approved</option><option value="approved">Approved</option><option value="changes_requested">Changes requested</option></select></Fld>
        <Fld label="SharePoint Link"><Inp value={dv.sharePointUrl||''} onChange={v=>upd({sharePointUrl:v})} placeholder="https://viarailonline.sharepoint.com/…"/></Fld>
        <Fld label="Notes"><Inp value={dv.notes||''} onChange={v=>upd({notes:v})} placeholder="Notes…" rows={2}/></Fld>
        <div style={{borderTop:`1px solid ${T.bd}`,paddingTop:10,marginTop:4}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={ss.lbl}>TASKS ({openDvTasks.length} open)</span><button onClick={()=>setAddingTask(true)} style={{...ss.btn,fontSize:10}}>+ Add task</button></div>
          {addingTask&&<div style={{display:'flex',gap:4,marginBottom:8}}><input autoFocus value={newTaskTitle} onChange={e=>setNTT(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&newTaskTitle.trim()){const newId=`p${Date.now()}`;newTask({id:newId,title:newTaskTitle.trim(),fileId:dv.fileId,projectId:dv.fileId,deliverableId:dvId,assignees:['Karl'],status:'not_started',dueDate:null,dependsOn:[],dependencies:[],gate:'',notes:'',link:null,approvalChain:[],source:'manual',createdAt:TODAY_STR});upd({taskIds:[...(dv.taskIds||[]),newId]});setNTT('');setAddingTask(false);}if(e.key==='Escape')setAddingTask(false);}} placeholder="Task title…" style={{...ss.inp,flex:1}}/><button onClick={()=>setAddingTask(false)} style={ss.btn}>Cancel</button></div>}
          {openDvTasks.map(t=>{
            const isOver=panelDragOver===t.id&&panelDragId!==t.id;
            return(
              <div key={t.id} style={{borderTop:isOver?`2px solid ${T.acc}`:'2px solid transparent',opacity:panelDragId===t.id?0.4:1}}>
                <div style={{display:'flex',alignItems:'center',gap:4,padding:'6px 0',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer'}}
                  onDragOver={e=>{e.preventDefault();setPanelDragOver(t.id);}}
                  onDragLeave={()=>setPanelDragOver(null)}
                  onDrop={e=>{e.preventDefault();dropPanelTask(t.id);}}
                >
                  <span draggable onDragStart={e=>{e.stopPropagation();setPanelDragId(t.id);}} onDragEnd={()=>{setPanelDragId(null);setPanelDragOver(null);}} style={{color:T.tx3,fontSize:12,cursor:'grab',flexShrink:0,userSelect:'none',padding:'0 2px'}}>⠿</span>
                  <div style={{flex:1,minWidth:0}} onClick={()=>setSelTask(selTask===t.id?null:t.id)}>
                    <div style={{fontSize:11,color:isDone(t)?T.tx3:T.tx,textDecoration:isDone(t)?'line-through':'none',lineHeight:1.3,...wrap2}}>{t.title}</div>
                    <div style={{display:'flex',gap:3,marginTop:2,flexWrap:'wrap'}}><StatusDot map={TS} val={t.status}/>{t.dueDate&&<DueChip date={t.dueDate}/>}</div>
                  </div>
                  {!isDone(t)&&<button onClick={e=>{e.stopPropagation();saveTask(t.id,{status:'completed'});upd({taskIds:(dv.taskIds||[]).filter(id=>id!==t.id)});}} style={{...ss.btn,fontSize:9,padding:'2px 6px',color:T.g,borderColor:'rgba(63,182,139,0.25)',flexShrink:0}}>✓</button>}
                </div>
              </div>
            );
          })}
          {selTask&&<div style={{marginTop:8,border:`1px solid ${T.bd}`,borderRadius:8,overflow:'hidden'}}><TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);upd({taskIds:(dv.taskIds||[]).filter(tid=>tid!==id)});setSelTask(null);}} onOpenTask={setSelTask}/></div>}
        </div>
        <button onClick={()=>{if(window.confirm(`Delete "${dv.title}"?`)){delDeliverable(dvId);onClose();}}} style={{width:'100%',padding:7,background:'transparent',border:`1px solid rgba(217,95,95,0.25)`,borderRadius:5,color:T.r,fontSize:11,cursor:'pointer',marginTop:12,fontFamily:T.font}}>Delete deliverable</button>
      </div>
    </div>
  );
}

// ─── APPLY TEMPLATE MODAL ─────────────────────────────────────────────────────
function ApplyTemplateModal({file,data,onClose,onApply}){
  const [step,setStep]=useState(1);
  const [selTpl,setSelTpl]=useState(null);
  const [targetDate,setTargetDate]=useState(mkFlexDate('exact',{confidence:'tentative'}));
  const [ownerName,setOwnerName]=useState('Karl');
  const [skipFoundational,setSkipFoundational]=useState(false);
  const [preview,setPreview]=useState(null);
  const people=allPeopleFrom(data);
  const tpl=BUILT_IN_TEMPLATES.find(t=>t.id===selTpl);

  // Is this the foundational template itself?
  const tplIsFoundational=tpl?.id==='tpl-foundational';
  // Does this template already embed foundational tasks?
  const tplHasFoundational=!tplIsFoundational&&tpl?.taskTemplates.some(tt=>FOUNDATIONAL_TASKS.find(ft=>ft.title===tt.title));
  // Show skip toggle for every template except the foundational phase itself
  const showSkipToggle=tpl&&!tplIsFoundational;

  // Build the ordered task list, respecting skipFoundational
  const buildTaskSources=()=>{
    if(!tpl)return[];
    if(tplIsFoundational)return tpl.taskTemplates;
    if(tplHasFoundational){
      // template already embeds foundational (e.g. press release) — optionally remove them
      return skipFoundational?tpl.taskTemplates.filter(tt=>!FOUNDATIONAL_TASKS.find(ft=>ft.title===tt.title)):tpl.taskTemplates;
    }
    // template has no foundational tasks — optionally prepend them
    return skipFoundational?tpl.taskTemplates:[...FOUNDATIONAL_TASKS,...tpl.taskTemplates];
  };

  const buildPreview=()=>{
    const sources=buildTaskSources();
    const exactDate=flexToExact(targetDate);
    const tasks=sources.map((tt,i)=>({id:`preview-${i}`,title:tt.title,notes:tt.notes,dueDate:exactDate?addDays(exactDate,tt.offsetDays):null,status:'not_started',assignees:[ownerName],requiresApproval:tt.requiresApproval}));
    setPreview(tasks);setStep(3);
  };

  const handleApply=()=>{
    if(!tpl)return;
    const sources=buildTaskSources();
    const exactDate=flexToExact(targetDate);
    const dvId=uid();
    const deliverable={id:dvId,fileId:file.id,title:tpl.name+(file.title?` — ${file.title}`:''),type:tpl.deliverableType==='foundational_phase'?'other':tpl.deliverableType,ownerName,supportNames:[],status:'not_started',priority:'medium',dueDate:targetDate,publicationDate:null,approvalStatus:'not_required',approverNames:[],taskIds:[],sharePointUrl:'',templateId:tpl.id,notes:'',createdAt:TODAY_STR,updatedAt:TODAY_STR};
    const tasks=sources.map(tt=>({id:uid(),title:tt.title,notes:tt.notes||'',fileId:file.id,projectId:file.id,deliverableId:dvId,dueDate:exactDate?addDays(exactDate,tt.offsetDays):null,status:'not_started',assignees:[ownerName],dependsOn:[],dependencies:[],gate:'',link:null,approvalChain:[],source:'template',templateId:tpl.id,createdAt:TODAY_STR}));
    deliverable.taskIds=tasks.map(t=>t.id);
    onApply(deliverable,tasks);onClose();
  };

  return(
    <Overlay onClose={onClose} wide>
      <ModalH title={`Apply Template — ${file.title}`} onClose={onClose}/>
      {step===1&&(<div><p style={{fontSize:12,color:T.tx2,margin:'0 0 14px'}}>Select a template to generate a deliverable and its tasks.</p><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>{BUILT_IN_TEMPLATES.map(t=>(<div key={t.id} onClick={()=>{setSelTpl(t.id);setSkipFoundational(false);}} style={{padding:'10px 12px',border:`1.5px solid ${selTpl===t.id?T.acc:T.bd}`,borderRadius:7,cursor:'pointer',background:selTpl===t.id?T.s3:T.s2}}><div style={{fontSize:12,fontWeight:600,color:T.tx,marginBottom:2,...trunc}}>{t.name}</div><div style={{fontSize:10,color:T.tx3,lineHeight:1.4,marginBottom:4,...wrap2}}>{t.description}</div><div style={{fontSize:9,color:T.acc}}>{t.taskTemplates.length} tasks</div></div>))}</div><div style={{marginTop:14,display:'flex',justifyContent:'flex-end'}}><button onClick={()=>{if(selTpl)setStep(2);}} disabled={!selTpl} style={{...ss.btnP,opacity:selTpl?1:0.4}}>Configure →</button></div></div>)}
      {step===2&&tpl&&(<div><div style={{marginBottom:12,padding:'8px 10px',background:T.s2,borderRadius:5,border:`1px solid ${T.bd}`}}><div style={{fontSize:11,fontWeight:600,color:T.tx,marginBottom:2}}>{tpl.name}</div><div style={{fontSize:10,color:T.tx3}}>{tpl.taskTemplates.length} tasks · {tpl.defaultDurationDays} day default timeline</div></div><Fld label="Target date (due date or publication date)"><FlexDateInput value={targetDate} onChange={setTargetDate}/></Fld><Fld label="Deliverable owner"><select value={ownerName} onChange={e=>setOwnerName(e.target.value)} style={ss.sel}>{people.map(m=><option key={m}>{m}</option>)}</select></Fld>{showSkipToggle&&(<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:T.s2,borderRadius:5,border:`1px solid ${T.bd}`,marginBottom:10}}><input type="checkbox" id="skipf" checked={skipFoundational} onChange={e=>setSkipFoundational(e.target.checked)}/><label htmlFor="skipf" style={{fontSize:12,color:T.tx2,cursor:'pointer',lineHeight:1.4}}>Skip foundational phase — mandate, source material, key messages and validation already done for this file</label></div>)}<div style={{display:'flex',gap:6,justifyContent:'space-between',marginTop:4}}><button onClick={()=>setStep(1)} style={ss.btn}>← Back</button><button onClick={buildPreview} style={ss.btnP}>Preview tasks →</button></div></div>)}
      {step===3&&preview&&(<div><div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:600,color:T.tx,marginBottom:4}}>Tasks to be created ({preview.length})</div><div style={{fontSize:10,color:T.tx3,marginBottom:8}}>Dates are calculated backward from your target date. You can edit them after creating.</div></div><div style={{border:`1px solid ${T.bd}`,borderRadius:6,overflow:'hidden',marginBottom:12}}>{preview.map((t,i)=>{const isFoundational=!!FOUNDATIONAL_TASKS.find(ft=>ft.title===t.title);return(<div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderBottom:`1px solid ${T.bd3}`,background:i%2===0?T.s1:T.s2}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,color:T.tx,fontWeight:500,...wrap2}}>{t.title}</div>{t.notes&&<div style={{fontSize:10,color:T.tx3,marginTop:1,...trunc}}>{t.notes}</div>}</div><div style={{display:'flex',gap:4,flexShrink:0,alignItems:'center'}}>{isFoundational&&<Chip text="Foundational" bg="rgba(91,156,246,0.09)" tx={T.acc2} small/>}{t.dueDate?<DueChip date={t.dueDate}/>:<span style={{fontSize:9,color:T.tx3}}>No date</span>}{t.requiresApproval&&<Chip text="Approval" bg="rgba(212,146,42,0.12)" tx={T.y} small/>}</div></div>);})}</div><div style={{display:'flex',gap:6,justifyContent:'space-between'}}><button onClick={()=>setStep(2)} style={ss.btn}>← Back</button><button onClick={handleApply} style={ss.btnP}>✓ Create deliverable & tasks</button></div></div>)}
    </Overlay>
  );
}

// ─── SHARED TASK ROW ──────────────────────────────────────────────────────────
function TaskRow({task,data,selTask,setSelTask,saveTask}){
  const blocked=isBlocked(task,data.tasks);
  return(
    <div onClick={()=>setSelTask(selTask===task.id?null:task.id)} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 10px',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',background:selTask===task.id?T.s3:'transparent',borderRadius:4}} onMouseEnter={e=>{if(selTask!==task.id)e.currentTarget.style.background=T.s2;}} onMouseLeave={e=>{if(selTask!==task.id)e.currentTarget.style.background='transparent';}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:T.tx,fontWeight:500,lineHeight:1.3,marginBottom:3,...wrap2}}>{task.title}</div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
          <StatusDot map={TS} val={task.status}/>
          {blocked&&<Chip text="⛔ Blocked" bg="rgba(217,95,95,0.12)" tx={T.r} small/>}
          {task.dueDate&&<DueChip date={task.dueDate}/>}
          {taskAssignees(task).map(a=><Chip key={a} text={a} bg="rgba(91,156,246,0.10)" tx={T.acc} small/>)}
        </div>
      </div>
      {!isDone(task)&&<button onClick={e=>{e.stopPropagation();saveTask(task.id,{status:'completed'});}} style={{...ss.btn,fontSize:9,padding:'2px 6px',color:T.g,borderColor:'rgba(63,182,139,0.25)',flexShrink:0,marginTop:1}}>✓</button>}
    </div>
  );
}

// ─── FILE PAGE ────────────────────────────────────────────────────────────────
function FilePage({file,data,onClose,saveFile,saveTask,delTask,newTask,addLogEntry,saveDeliverable,delDeliverable,newDeliverable,applyTemplate}){
  const [open,setOpen]=useState(()=>new Set(['memory','deliverables','tasks','issues','milestones','links','log']));
  const toggle=id=>setOpen(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const isOpen=id=>open.has(id);
  const [selTask,setSelTask]=useState(null);
  const [selDv,setSelDv]=useState(null);
  const [addingTask,setAddingTask]=useState(false);
  const [newTaskTitle,setNTT]=useState('');
  const [addingLog,setAddingLog]=useState(false);
  const [logText,setLogText]=useState('');
  const [logTitle,setLogTitle]=useState('');
  const [addingMilestone,setAddingMilestone]=useState(false);
  const [newMilestone,setNM]=useState({title:'',status:'not_started',date:''});
  const [addingLink,setAddingLink]=useState(false);
  const [newLink,setNL]=useState({label:'',url:'',type:'folder'});
  const [editingTitle,setEditingTitle]=useState(false);
  const [titleVal,setTitleVal]=useState(file.title);
  const [addingDv,setAddingDv]=useState(false);
  const [newDvForm,setNewDvForm]=useState({title:'',type:'press_release',ownerName:'Karl',status:'not_started'});
  const [showTemplateModal,setShowTemplateModal]=useState(false);
  // Risks & Questions
  const [addingRisk,setAddingRisk]=useState(false);
  const [newRisk,setNewRisk]=useState({title:'',description:'',severity:'medium',status:'open',ownerName:'',notes:''});
  const [addingQ,setAddingQ]=useState(false);
  const [newQ,setNewQ]=useState({question:'',ownerName:'',status:'open',answer:'',notes:''});
  const [expandedRisk,setExpandedRisk]=useState(null);
  const [expandedQ,setExpandedQ]=useState(null);

  const fileTasks=data.tasks.filter(t=>(t.fileId||t.projectId)===file.id);
  const openTasks=fileTasks.filter(t=>!isDone(t));
  const fileDeliverables=(data.deliverables||[]).filter(d=>d.fileId===file.id);
  const openDVs=fileDeliverables.filter(d=>!isDoneDV(d));
  const risks=file.risks||[];
  const openRisks=risks.filter(r=>r.status!=='resolved');
  const questions=file.openQuestions||[];
  const openQs=questions.filter(q=>q.status==='open');
  const people=allPeopleFrom(data);
  const sens=SENS_C[file.sensitivity||'normal'];

  // ── DRAG STATE ─────────────────────────────────────────────────────────────
  const [dragInfo,setDragInfo]=useState(null); // {type:'task'|'deliverable', id, fromDvId}
  const [dragOver,setDragOver]=useState(null); // {id} — item being hovered
  const stopDrag=()=>{setDragInfo(null);setDragOver(null);};

  // ── ORDERED LISTS (use stored order arrays, fall back to natural order) ────
  const orderedDvList=useMemo(()=>{
    const open=fileDeliverables.filter(d=>!isDoneDV(d));
    const ord=file.deliverableOrder||[];
    return[...ord.map(id=>open.find(d=>d.id===id)).filter(Boolean),...open.filter(d=>!ord.includes(d.id))];
  },[fileDeliverables,file.deliverableOrder]);

  const orderedStandalone=useMemo(()=>{
    const tasks=fileTasks.filter(t=>!isDone(t)&&!t.deliverableId);
    const ord=file.standaloneTaskOrder||[];
    return[...ord.map(id=>tasks.find(t=>t.id===id)).filter(Boolean),...tasks.filter(t=>!ord.includes(t.id))];
  },[fileTasks,file.standaloneTaskOrder]);

  const getOrderedDvTasks=dv=>{
    const dvTasks=fileTasks.filter(t=>t.deliverableId===dv.id&&!isDone(t));
    const ord=dv.taskIds||[];
    return[...ord.map(id=>dvTasks.find(t=>t.id===id)).filter(Boolean),...dvTasks.filter(t=>!ord.includes(t.id))];
  };

  // ── DROP HANDLERS ──────────────────────────────────────────────────────────
  // Reorder tasks within same scope (dv-to-dv or standalone-to-standalone)
  const dropOnTask=(toTaskId,toDvId)=>{
    if(!dragInfo||dragInfo.type!=='task'||dragInfo.id===toTaskId||dragInfo.fromDvId!==toDvId){stopDrag();return;}
    if(toDvId){
      const dv=(data.deliverables||[]).find(d=>d.id===toDvId);
      const dvTasks=fileTasks.filter(t=>t.deliverableId===toDvId);
      const base=[...new Set([...(dv?.taskIds||[]),...dvTasks.map(t=>t.id)])];
      const fi=base.indexOf(dragInfo.id),ti=base.indexOf(toTaskId);
      if(fi!==-1&&ti!==-1){base.splice(fi,1);base.splice(ti,0,dragInfo.id);}
      saveDeliverable(toDvId,{taskIds:base});
    } else {
      const tasks=fileTasks.filter(t=>!isDone(t)&&!t.deliverableId);
      const base=[...new Set([...(file.standaloneTaskOrder||[]),...tasks.map(t=>t.id)])];
      const fi=base.indexOf(dragInfo.id),ti=base.indexOf(toTaskId);
      if(fi!==-1&&ti!==-1){base.splice(fi,1);base.splice(ti,0,dragInfo.id);}
      saveFile(file.id,{standaloneTaskOrder:base});
    }
    stopDrag();
  };

  // Reorder deliverables OR link a task to a deliverable
  const dropOnDeliverable=(toDvId)=>{
    if(!dragInfo){stopDrag();return;}
    if(dragInfo.type==='deliverable'&&dragInfo.id!==toDvId){
      const open=fileDeliverables.filter(d=>!isDoneDV(d)).map(d=>d.id);
      const base=[...new Set([...(file.deliverableOrder||[]),...open])];
      const fi=base.indexOf(dragInfo.id),ti=base.indexOf(toDvId);
      if(fi!==-1&&ti!==-1){base.splice(fi,1);base.splice(ti,0,dragInfo.id);}
      saveFile(file.id,{deliverableOrder:base});
    } else if(dragInfo.type==='task'&&dragInfo.fromDvId!==toDvId){
      // Unlink from source
      if(dragInfo.fromDvId){
        const srcDv=(data.deliverables||[]).find(d=>d.id===dragInfo.fromDvId);
        if(srcDv)saveDeliverable(dragInfo.fromDvId,{taskIds:(srcDv.taskIds||[]).filter(id=>id!==dragInfo.id)});
      } else {
        saveFile(file.id,{standaloneTaskOrder:(file.standaloneTaskOrder||[]).filter(id=>id!==dragInfo.id)});
      }
      // Link to target
      const toDv=(data.deliverables||[]).find(d=>d.id===toDvId);
      if(toDv)saveDeliverable(toDvId,{taskIds:[...(toDv.taskIds||[]),dragInfo.id]});
      saveTask(dragInfo.id,{deliverableId:toDvId});
    }
    stopDrag();
  };

  const saveRisk=(rid,ch)=>saveFile(file.id,{risks:risks.map(r=>r.id===rid?{...r,...ch}:r)});
  const delRisk=rid=>saveFile(file.id,{risks:risks.filter(r=>r.id!==rid)});
  const saveQ=(qid,ch)=>saveFile(file.id,{openQuestions:questions.map(q=>q.id===qid?{...q,...ch}:q)});
  const delQ=qid=>saveFile(file.id,{openQuestions:questions.filter(q=>q.id!==qid)});

  // Accordion header
  const AHead=({id,label,badge,badgeColor,action})=>(
    <div onClick={()=>toggle(id)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',cursor:'pointer',background:isOpen(id)?T.s2:T.s1,borderBottom:`1px solid ${T.bd}`,position:'sticky',top:0,zIndex:4,userSelect:'none',flexShrink:0}}>
      <span style={{fontSize:8,color:T.tx3,display:'inline-block',transform:isOpen(id)?'rotate(90deg)':'rotate(0deg)',transition:'transform .15s',flexShrink:0}}>▶</span>
      <span style={{fontSize:12,fontWeight:600,color:isOpen(id)?T.acc:T.tx,flex:1,fontFamily:T.font}}>{label}</span>
      {badge!=null&&<span style={{fontSize:10,color:badgeColor||T.tx3,flexShrink:0}}>{badge}</span>}
      {action&&<div onClick={e=>e.stopPropagation()} style={{display:'flex',gap:4,flexShrink:0}}>{action}</div>}
    </div>
  );

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'11px 14px',borderBottom:`1px solid ${T.bd}`,background:T.hdr,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:7}}>
          <div style={{flex:1,minWidth:0}}>
            {editingTitle
              ?<input autoFocus value={titleVal} onChange={e=>setTitleVal(e.target.value)} onBlur={()=>{saveFile(file.id,{title:titleVal});setEditingTitle(false);}} onKeyDown={e=>{if(e.key==='Enter'){saveFile(file.id,{title:titleVal});setEditingTitle(false);}if(e.key==='Escape')setEditingTitle(false);}} style={{...ss.inp,fontSize:15,fontWeight:700,background:'transparent',borderColor:T.acc,width:'100%'}}/>
              :<h2 onClick={()=>setEditingTitle(true)} title="Click to edit" style={{fontSize:15,fontWeight:700,color:T.tx,margin:0,cursor:'text',lineHeight:1.2,wordBreak:'break-word'}}>{file.title}</h2>
            }
          </div>
          <div style={{display:'flex',gap:4,flexShrink:0,alignItems:'center'}}>
            {file.archived?<button onClick={()=>saveFile(file.id,{archived:false,archivedAt:null})} style={{...ss.btn,fontSize:10,color:T.g}}>Restore</button>:<button onClick={()=>{if(window.confirm(`Archive "${file.title}"?`))saveFile(file.id,{archived:true,archivedAt:TODAY_STR});}} style={{...ss.btn,fontSize:10}}>Archive</button>}
            <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:20,color:T.tx3,lineHeight:1,padding:0}}>×</button>
          </div>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:7,alignItems:'center'}}>
          <StatusDot map={FS} val={file.status}/>
          <StatusDot map={FH} val={file.health}/>
          <StatusDot map={FP} val={file.priority}/>
          {file.lead&&<span style={{fontSize:10,color:T.tx2,padding:'2px 7px',borderRadius:10,background:T.s2,border:`1px solid ${T.bd}`,maxWidth:120,...trunc}}>👤 {file.lead}</span>}
          {file.sensitivity&&file.sensitivity!=='normal'&&<span style={{fontSize:10,fontWeight:600,color:sens.color,padding:'2px 7px',borderRadius:10,background:`${sens.color}15`,border:`1px solid ${sens.color}30`}}>{sens.label}</span>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
          <Fld label="Status" mb={0}><select value={file.status} onChange={e=>saveFile(file.id,{status:e.target.value})} style={ss.sel}>{FILE_STATUS_OPTS.map(s=><option key={s} value={s}>{FS[s]?.label||s}</option>)}</select></Fld>
          <Fld label="Health" mb={0}><select value={file.health||'unknown'} onChange={e=>saveFile(file.id,{health:e.target.value})} style={ss.sel}>{HEALTH_OPTS.map(s=><option key={s} value={s}>{FH[s]?.label||s}</option>)}</select></Fld>
          <Fld label="Priority" mb={0}><select value={file.priority||'medium'} onChange={e=>saveFile(file.id,{priority:e.target.value})} style={ss.sel}>{PRIORITY_OPTS.map(s=><option key={s} value={s}>{FP[s]?.label||s}</option>)}</select></Fld>
          <Fld label="Sensitivity" mb={0}><select value={file.sensitivity||'normal'} onChange={e=>saveFile(file.id,{sensitivity:e.target.value})} style={ss.sel}>{SENSITIVITY_OPTS.map(s=><option key={s} value={s}>{SENS_C[s]?.label||s}</option>)}</select></Fld>
        </div>
      </div>
      {/* Accordion content + optional side panel */}
      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>

          {/* ── MEMORY ── */}
          <AHead id="memory" label="Memory"
            action={<button onClick={()=>setAddingLog(true)} style={{...ss.btn,fontSize:9,padding:'2px 7px'}}>+ Log entry</button>}
          />
          {isOpen('memory')&&(<div style={{padding:'14px 16px',borderBottom:`1px solid ${T.bd}`}}><RichTextEditor value={file.memory||""} onChange={v=>saveFile(file.id,{memory:v})} minHeight={180}/>{file.latestUpdate&&<div style={{marginTop:10,padding:'8px 10px',background:T.s2,borderRadius:5,borderLeft:`2px solid ${T.acc}50`}}><span style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',display:'block',marginBottom:2}}>Latest update</span><span style={{fontSize:12,color:T.tx2}}>{file.latestUpdate}</span></div>}{addingLog&&(<div style={{marginTop:12,border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px'}}><Fld label="Entry title"><Inp value={logTitle} onChange={setLogTitle} placeholder="What changed?"/></Fld><Fld label="Summary" mb={6}><Inp value={logText} onChange={setLogText} placeholder="Describe what changed and who confirmed it…" rows={3}/></Fld><div style={{display:'flex',gap:4}}><button onClick={()=>{if(logText.trim()){addLogEntry(file.id,logText,logTitle||'Update');setLogText('');setLogTitle('');setAddingLog(false);}}} style={ss.btnP}>Add</button><button onClick={()=>{setAddingLog(false);setLogText('');setLogTitle('');}} style={ss.btn}>Cancel</button></div></div>)}</div>)}

          {/* ── DELIVERABLES ── */}
          <AHead id="deliverables" label="Deliverables"
            badge={openDVs.length?`${openDVs.length} open · ${fileDeliverables.filter(isDoneDV).length} done`:null}
            action={<><button onClick={()=>setShowTemplateModal(true)} style={{...ss.btn,fontSize:9,padding:'2px 7px',color:T.acc}}>From template</button><button onClick={()=>setAddingDv(true)} style={{...ss.btnP,fontSize:9,padding:'2px 8px'}}>+ Add</button></>}
          />
          {isOpen('deliverables')&&(<div style={{padding:'12px 16px',borderBottom:`1px solid ${T.bd}`}}>{addingDv&&(<div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:12}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}><Fld label="Title" mb={0}><Inp value={newDvForm.title} onChange={v=>setNewDvForm(x=>({...x,title:v}))} placeholder="Deliverable name"/></Fld><Fld label="Type" mb={0}><select value={newDvForm.type} onChange={e=>setNewDvForm(x=>({...x,type:e.target.value}))} style={ss.sel}>{DELIVERABLE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></Fld><Fld label="Owner" mb={0}><select value={newDvForm.ownerName} onChange={e=>setNewDvForm(x=>({...x,ownerName:e.target.value}))} style={ss.sel}><option value="">—</option>{people.map(m=><option key={m}>{m}</option>)}</select></Fld><Fld label="Status" mb={0}><select value={newDvForm.status} onChange={e=>setNewDvForm(x=>({...x,status:e.target.value}))} style={ss.sel}>{DELIVERABLE_STATUS_OPTS.map(s=><option key={s} value={s}>{DVS[s]?.label||s}</option>)}</select></Fld></div><div style={{display:'flex',gap:4}}><button onClick={()=>{if(newDvForm.title.trim()){newDeliverable({...newDvForm,fileId:file.id,taskIds:[],sharePointUrl:'',notes:'',approvalStatus:'not_required',approverNames:[],supportNames:[],dueDate:null,publicationDate:null,createdAt:TODAY_STR,updatedAt:TODAY_STR});setNewDvForm({title:'',type:'press_release',ownerName:'Karl',status:'not_started'});setAddingDv(false);}}} style={ss.btnP}>Add</button><button onClick={()=>setAddingDv(false)} style={ss.btn}>Cancel</button></div></div>)}{fileDeliverables.length===0&&!addingDv&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic',padding:'10px 0',textAlign:'center'}}>No deliverables yet. Add one manually or use a template.</div>}{orderedDvList.map(dv=>{
            const openT=data.tasks.filter(t=>t.deliverableId===dv.id&&!isDone(t)).length;
            const isTaskDragTarget=dragInfo?.type==='task'&&dragOver?.id===dv.id;
            const isDvReorderTarget=dragInfo?.type==='deliverable'&&dragOver?.id===dv.id&&dragInfo.id!==dv.id;
            const isSelf=dragInfo?.type==='deliverable'&&dragInfo.id===dv.id;
            return(
              <div key={dv.id}
                draggable
                onDragStart={e=>{e.stopPropagation();setDragInfo({type:'deliverable',id:dv.id});}}
                onDragEnd={stopDrag}
                onDragOver={e=>{e.preventDefault();setDragOver({id:dv.id});}}
                onDragLeave={()=>setDragOver(null)}
                onDrop={e=>{e.preventDefault();dropOnDeliverable(dv.id);}}
                onClick={()=>setSelDv(selDv===dv.id?null:dv.id)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',border:`1px solid ${isTaskDragTarget?T.acc:isDvReorderTarget?T.y:selDv===dv.id?T.acc:T.bd}`,borderRadius:6,marginBottom:5,cursor:'pointer',background:isSelf?'rgba(91,156,246,0.04)':isTaskDragTarget?'rgba(91,156,246,0.06)':selDv===dv.id?T.s3:T.s2,opacity:isSelf?0.45:1,transition:'border-color .1s,background .1s'}}
              >
                <span style={{color:T.tx3,fontSize:13,cursor:'grab',flexShrink:0,userSelect:'none'}} onClick={e=>e.stopPropagation()}>⠿</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.tx,marginBottom:3,...wrap2}}>{dv.title}</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                    <StatusDot map={DVS} val={dv.status}/>
                    {dv.type&&<Chip text={dvLabel(dv.type)} bg={T.s1} tx={T.acc2} small/>}
                    {dv.ownerName&&<Chip text={dv.ownerName} bg="rgba(91,156,246,0.09)" tx={T.acc} small/>}
                    {dv.dueDate&&<FlexChip fd={dv.dueDate}/>}
                    {dv.approvalStatus==='pending'&&<Chip text="Approval pending" bg="rgba(212,146,42,0.12)" tx={T.y} small/>}
                    {isTaskDragTarget&&<Chip text="↙ drop to link" bg="rgba(91,156,246,0.15)" tx={T.acc} small/>}
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:10,color:T.tx3}}>{openT}t</div></div>
              </div>
            );
          })}
          {fileDeliverables.filter(isDoneDV).length>0&&<details style={{marginTop:6}}><summary style={{fontSize:10,color:T.tx3,cursor:'pointer',padding:'4px 0'}}>Completed ({fileDeliverables.filter(isDoneDV).length})</summary>{fileDeliverables.filter(isDoneDV).map(dv=>(<div key={dv.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderBottom:`1px solid ${T.bd3}`,opacity:0.5}}><span style={{fontSize:11,color:T.tx3,flex:1,...trunc}}>{dv.title}</span><StatusDot map={DVS} val={dv.status}/></div>))}</details>}</div>)}

          {/* ── TASKS ── */}
          <AHead id="tasks" label="Tasks"
            badge={openTasks.length?`${openTasks.length} open · ${fileTasks.filter(isDone).length} done`:null}
            action={<button onClick={()=>setAddingTask(true)} style={{...ss.btnP,fontSize:9,padding:'2px 8px'}}>+ Add</button>}
          />
          {isOpen('tasks')&&(<div style={{padding:'12px 16px',borderBottom:`1px solid ${T.bd}`}}>{addingTask&&<div style={{display:'flex',gap:4,marginBottom:10}}><input autoFocus value={newTaskTitle} onChange={e=>setNTT(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&newTaskTitle.trim()){newTask({title:newTaskTitle.trim(),fileId:file.id,projectId:file.id,assignees:['Karl'],status:'not_started',dueDate:null,dependsOn:[],dependencies:[],gate:'',notes:'',link:null,approvalChain:[],source:'manual',createdAt:TODAY_STR});setNTT('');setAddingTask(false);}if(e.key==='Escape')setAddingTask(false);}} placeholder="Task title…" style={{...ss.inp,flex:1}}/><button onClick={()=>setAddingTask(false)} style={ss.btn}>Cancel</button></div>}
          {orderedDvList.map(dv=>{const dvTasks=getOrderedDvTasks(dv);if(!dvTasks.length)return null;return(<div key={dv.id} style={{marginBottom:10}}><div
            onDragOver={e=>{e.preventDefault();setDragOver({id:dv.id+'hdr'});}}
            onDragLeave={()=>setDragOver(null)}
            onDrop={e=>{e.preventDefault();dropOnDeliverable(dv.id);}}
            style={{fontSize:9,fontWeight:700,color:dragInfo?.type==='task'&&dragOver?.id===dv.id+'hdr'?T.acc:T.acc,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4,paddingLeft:2,paddingRight:4,paddingTop:2,paddingBottom:2,borderRadius:3,background:dragInfo?.type==='task'&&dragOver?.id===dv.id+'hdr'?'rgba(91,156,246,0.12)':'transparent',display:'inline-block',...trunc}}>↳ {dv.title}{dragInfo?.type==='task'&&dragOver?.id===dv.id+'hdr'?' ↙ link':''}</div>{dvTasks.map(task=>{const isOver=dragOver?.id===task.id&&dragInfo?.type==='task'&&dragInfo.fromDvId===dv.id;return(<div key={task.id} style={{borderTop:isOver?`2px solid ${T.acc}`:'2px solid transparent',opacity:dragInfo?.id===task.id?0.4:1}}><div style={{display:'flex',alignItems:'flex-start'}}><span draggable onDragStart={e=>{e.stopPropagation();setDragInfo({type:'task',id:task.id,fromDvId:dv.id});}} onDragEnd={stopDrag} style={{color:T.tx3,fontSize:12,cursor:'grab',padding:'8px 4px 0 2px',flexShrink:0,userSelect:'none'}}>⠿</span><div style={{flex:1}} onDragOver={e=>{e.preventDefault();setDragOver({id:task.id});}} onDragLeave={()=>setDragOver(null)} onDrop={e=>{e.preventDefault();dropOnTask(task.id,dv.id);}}><TaskRow task={task} data={data} selTask={selTask} setSelTask={setSelTask} saveTask={saveTask}/></div></div></div>);})}</div>);})}
          {orderedStandalone.length>0&&(<div style={{marginBottom:10}}>{orderedDvList.length>0&&<div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4,paddingLeft:2}}>File tasks</div>}{orderedStandalone.map(task=>{const isOver=dragOver?.id===task.id&&dragInfo?.type==='task'&&!dragInfo.fromDvId;return(<div key={task.id} style={{borderTop:isOver?`2px solid ${T.acc}`:'2px solid transparent',opacity:dragInfo?.id===task.id?0.4:1}}><div style={{display:'flex',alignItems:'flex-start'}}><span draggable onDragStart={e=>{e.stopPropagation();setDragInfo({type:'task',id:task.id,fromDvId:null});}} onDragEnd={stopDrag} style={{color:T.tx3,fontSize:12,cursor:'grab',padding:'8px 4px 0 2px',flexShrink:0,userSelect:'none'}}>⠿</span><div style={{flex:1}} onDragOver={e=>{e.preventDefault();setDragOver({id:task.id});}} onDragLeave={()=>setDragOver(null)} onDrop={e=>{e.preventDefault();dropOnTask(task.id,null);}}><TaskRow task={task} data={data} selTask={selTask} setSelTask={setSelTask} saveTask={saveTask}/></div></div></div>);})}</div>)}
          {fileTasks.filter(isDone).length>0&&<details style={{marginTop:6}}><summary style={{fontSize:10,color:T.tx3,cursor:'pointer',padding:'4px 0'}}>Completed ({fileTasks.filter(isDone).length})</summary>{fileTasks.filter(isDone).map(task=><div key={task.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',borderBottom:`1px solid ${T.bd3}`,opacity:0.5}}><span style={{fontSize:11,color:T.tx3,flex:1,...wrap2,textDecoration:'line-through'}}>{task.title}</span><StatusDot map={TS} val={task.status}/></div>)}</details>}
          {selTask&&<div style={{marginTop:10,border:`1px solid ${T.bd}`,borderRadius:8,overflow:'hidden'}}><TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/></div>}</div>)}

          {/* ── RISKS & OPEN QUESTIONS ── */}
          <AHead id="issues" label="Risks & Questions"
            badge={(openRisks.length+openQs.length)?`${openRisks.length} risk${openRisks.length!==1?'s':''} · ${openQs.length} question${openQs.length!==1?'s':''}`:null}
            badgeColor={openRisks.length?T.r:T.tx3}
          />
          {isOpen('issues')&&(<div style={{padding:'12px 16px',borderBottom:`1px solid ${T.bd}`}}>
            {/* Risks */}
            <div style={{marginBottom:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><span style={ss.lbl}>RISKS & ISSUES ({openRisks.length} open)</span><button onClick={()=>setAddingRisk(true)} style={ss.btnP}>+ Add risk</button></div>
              {addingRisk&&(<div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:10}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}><Fld label="Title" mb={0}><Inp value={newRisk.title} onChange={v=>setNewRisk(x=>({...x,title:v}))} placeholder="Risk or issue title"/></Fld><Fld label="Severity" mb={0}><select value={newRisk.severity} onChange={e=>setNewRisk(x=>({...x,severity:e.target.value}))} style={ss.sel}>{Object.keys(RISK_SEV).map(s=><option key={s} value={s}>{RISK_SEV[s].label}</option>)}</select></Fld><Fld label="Owner" mb={0}><select value={newRisk.ownerName} onChange={e=>setNewRisk(x=>({...x,ownerName:e.target.value}))} style={ss.sel}><option value="">—</option>{people.map(m=><option key={m}>{m}</option>)}</select></Fld><Fld label="Status" mb={0}><select value={newRisk.status} onChange={e=>setNewRisk(x=>({...x,status:e.target.value}))} style={ss.sel}>{Object.keys(RISK_ST).map(s=><option key={s} value={s}>{RISK_ST[s].label}</option>)}</select></Fld></div><Fld label="Description" mb={6}><Inp value={newRisk.description} onChange={v=>setNewRisk(x=>({...x,description:v}))} placeholder="What is the risk or issue?" rows={2}/></Fld><div style={{display:'flex',gap:4}}><button onClick={()=>{if(newRisk.title.trim()){saveFile(file.id,{risks:[...risks,{id:uid(),...newRisk}]});setNewRisk({title:'',description:'',severity:'medium',status:'open',ownerName:'',notes:''});setAddingRisk(false);}}} style={ss.btnP}>Add</button><button onClick={()=>setAddingRisk(false)} style={ss.btn}>Cancel</button></div></div>)}
              {risks.length===0&&!addingRisk&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic'}}>No risks or issues logged.</div>}
              {risks.map(r=>(
                <div key={r.id} style={{border:`1px solid ${expandedRisk===r.id?T.bd2:T.bd}`,borderRadius:6,marginBottom:5,overflow:'hidden'}}>
                  <div onClick={()=>setExpandedRisk(expandedRisk===r.id?null:r.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',cursor:'pointer',background:r.status==='resolved'?T.s2:T.s1}} onMouseEnter={e=>e.currentTarget.style.background=T.s2} onMouseLeave={e=>e.currentTarget.style.background=r.status==='resolved'?T.s2:T.s1}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:r.status==='resolved'?T.tx3:T.tx,...wrap2}}>{r.title}</div>
                      {r.description&&<div style={{fontSize:10,color:T.tx3,marginTop:2,...trunc}}>{r.description}</div>}
                    </div>
                    <div style={{display:'flex',gap:4,flexShrink:0,alignItems:'center'}}>
                      <StatusDot map={RISK_SEV} val={r.severity}/>
                      <StatusDot map={RISK_ST} val={r.status}/>
                      {r.ownerName&&<Chip text={r.ownerName} bg="rgba(91,156,246,0.09)" tx={T.acc} small/>}
                    </div>
                  </div>
                  {expandedRisk===r.id&&(<div style={{padding:'10px 12px',borderTop:`1px solid ${T.bd}`,background:T.s2}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
                      <Fld label="Severity" mb={0}><select value={r.severity} onChange={e=>saveRisk(r.id,{severity:e.target.value})} style={ss.sel}>{Object.keys(RISK_SEV).map(s=><option key={s} value={s}>{RISK_SEV[s].label}</option>)}</select></Fld>
                      <Fld label="Status" mb={0}><select value={r.status} onChange={e=>saveRisk(r.id,{status:e.target.value})} style={ss.sel}>{Object.keys(RISK_ST).map(s=><option key={s} value={s}>{RISK_ST[s].label}</option>)}</select></Fld>
                      <Fld label="Owner" mb={0}><select value={r.ownerName||''} onChange={e=>saveRisk(r.id,{ownerName:e.target.value})} style={ss.sel}><option value="">—</option>{people.map(m=><option key={m}>{m}</option>)}</select></Fld>
                    </div>
                    <Fld label="Description" mb={6}><Inp value={r.description||''} onChange={v=>saveRisk(r.id,{description:v})} placeholder="Describe the risk…" rows={2}/></Fld>
                    <Fld label="Notes" mb={6}><Inp value={r.notes||''} onChange={v=>saveRisk(r.id,{notes:v})} placeholder="Notes…" rows={1}/></Fld>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <button onClick={()=>saveRisk(r.id,{status:r.status==='resolved'?'open':'resolved'})} style={{...ss.btn,fontSize:10,color:r.status==='resolved'?T.tx2:T.g}}>{r.status==='resolved'?'Reopen':'Mark resolved'}</button>
                      <button onClick={()=>delRisk(r.id)} style={{...ss.btn,fontSize:10,color:T.r,borderColor:'rgba(217,95,95,0.25)'}}>Delete</button>
                    </div>
                  </div>)}
                </div>
              ))}
            </div>

            {/* Open Questions */}
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><span style={ss.lbl}>OPEN QUESTIONS ({openQs.length} open)</span><button onClick={()=>setAddingQ(true)} style={ss.btnP}>+ Add question</button></div>
              {addingQ&&(<div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:10}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}><Fld label="Question" mb={0}><Inp value={newQ.question} onChange={v=>setNewQ(x=>({...x,question:v}))} placeholder="What needs to be answered?"/></Fld><Fld label="Owner" mb={0}><select value={newQ.ownerName} onChange={e=>setNewQ(x=>({...x,ownerName:e.target.value}))} style={ss.sel}><option value="">—</option>{people.map(m=><option key={m}>{m}</option>)}</select></Fld></div><div style={{display:'flex',gap:4}}><button onClick={()=>{if(newQ.question.trim()){saveFile(file.id,{openQuestions:[...questions,{id:uid(),...newQ}]});setNewQ({question:'',ownerName:'',status:'open',answer:'',notes:''});setAddingQ(false);}}} style={ss.btnP}>Add</button><button onClick={()=>setAddingQ(false)} style={ss.btn}>Cancel</button></div></div>)}
              {questions.length===0&&!addingQ&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic'}}>No open questions logged.</div>}
              {questions.map(q=>(
                <div key={q.id} style={{border:`1px solid ${expandedQ===q.id?T.bd2:T.bd}`,borderRadius:6,marginBottom:5,overflow:'hidden'}}>
                  <div onClick={()=>setExpandedQ(expandedQ===q.id?null:q.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',cursor:'pointer',background:q.status!=='open'?T.s2:T.s1}} onMouseEnter={e=>e.currentTarget.style.background=T.s2} onMouseLeave={e=>e.currentTarget.style.background=q.status!=='open'?T.s2:T.s1}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:q.status!=='open'?T.tx3:T.tx,...wrap2}}>{q.question}</div>
                      {q.answer&&q.status==='answered'&&<div style={{fontSize:10,color:T.g,marginTop:2,...trunc}}>✓ {q.answer}</div>}
                    </div>
                    <div style={{display:'flex',gap:4,flexShrink:0,alignItems:'center'}}>
                      {q.status==='open'?<Chip text="Open" bg="rgba(217,95,95,0.10)" tx={T.r} small/>:q.status==='answered'?<Chip text="Answered" bg="rgba(63,182,139,0.10)" tx={T.g} small/>:<Chip text="N/A" bg={T.s2} tx={T.tx3} small/>}
                      {q.ownerName&&<Chip text={q.ownerName} bg="rgba(91,156,246,0.09)" tx={T.acc} small/>}
                    </div>
                  </div>
                  {expandedQ===q.id&&(<div style={{padding:'10px 12px',borderTop:`1px solid ${T.bd}`,background:T.s2}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                      <Fld label="Status" mb={0}><select value={q.status} onChange={e=>saveQ(q.id,{status:e.target.value})} style={ss.sel}><option value="open">Open</option><option value="answered">Answered</option><option value="no_longer_relevant">No longer relevant</option></select></Fld>
                      <Fld label="Owner" mb={0}><select value={q.ownerName||''} onChange={e=>saveQ(q.id,{ownerName:e.target.value})} style={ss.sel}><option value="">—</option>{people.map(m=><option key={m}>{m}</option>)}</select></Fld>
                    </div>
                    <Fld label="Answer" mb={6}><Inp value={q.answer||''} onChange={v=>saveQ(q.id,{answer:v})} placeholder="Answer or resolution…" rows={2}/></Fld>
                    <Fld label="Notes" mb={6}><Inp value={q.notes||''} onChange={v=>saveQ(q.id,{notes:v})} placeholder="Notes…" rows={1}/></Fld>
                    <button onClick={()=>delQ(q.id)} style={{...ss.btn,fontSize:10,color:T.r,borderColor:'rgba(217,95,95,0.25)'}}>Delete</button>
                  </div>)}
                </div>
              ))}
            </div>
          </div>)}

          {/* ── MILESTONES ── */}
          <AHead id="milestones" label="Milestones"
            badge={(file.milestones||[]).filter(m=>m.status!=='completed').length||null}
            action={<button onClick={()=>setAddingMilestone(true)} style={{...ss.btnP,fontSize:9,padding:'2px 8px'}}>+ Add</button>}
          />
          {isOpen('milestones')&&(<div style={{padding:'12px 16px',borderBottom:`1px solid ${T.bd}`}}>{addingMilestone&&(<div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:12}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}><Fld label="Title" mb={0}><Inp value={newMilestone.title} onChange={v=>setNM(x=>({...x,title:v}))} placeholder="Milestone name"/></Fld><Fld label="Date (optional)" mb={0}><input type="date" value={newMilestone.date} onChange={e=>setNM(x=>({...x,date:e.target.value}))} style={ss.inp}/></Fld></div><Fld label="Status" mb={8}><select value={newMilestone.status} onChange={e=>setNM(x=>({...x,status:e.target.value}))} style={ss.sel}>{MILESTONE_STATUS.map(s=><option key={s} value={s}>{MS_LABEL[s]}</option>)}</select></Fld><div style={{display:'flex',gap:4}}><button onClick={()=>{if(newMilestone.title.trim()){saveFile(file.id,{milestones:[...(file.milestones||[]),{id:uid(),...newMilestone}]});setNM({title:'',status:'not_started',date:''});setAddingMilestone(false);}}} style={ss.btnP}>Add</button><button onClick={()=>setAddingMilestone(false)} style={ss.btn}>Cancel</button></div></div>)}{(file.milestones||[]).length===0&&!addingMilestone&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic'}}>No milestones yet.</div>}{(file.milestones||[]).map(m=>(<div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',borderBottom:`1px solid ${T.bd3}`}}><span style={{flex:1,fontSize:12,color:m.status==='completed'?T.tx3:T.tx,textDecoration:m.status==='completed'?'line-through':'none',wordBreak:'break-word'}}>{m.title}</span>{m.date&&<DueChip date={m.date}/>}<select value={m.status} onChange={e=>saveFile(file.id,{milestones:(file.milestones||[]).map(x=>x.id===m.id?{...x,status:e.target.value}:x)})} style={{...ss.sel,width:'auto',fontSize:10,padding:'2px 6px',flexShrink:0}}>{MILESTONE_STATUS.map(s=><option key={s} value={s}>{MS_LABEL[s]}</option>)}</select><button onClick={()=>saveFile(file.id,{milestones:(file.milestones||[]).filter(x=>x.id!==m.id)})} style={{background:'transparent',border:'none',cursor:'pointer',color:T.tx3,fontSize:13,flexShrink:0}}>×</button></div>))}</div>)}

          {/* ── LINKS ── */}
          <AHead id="links" label="SharePoint Links"
            badge={(file.sharePointLinks||[]).length||null}
            action={<button onClick={()=>setAddingLink(true)} style={{...ss.btnP,fontSize:9,padding:'2px 8px'}}>+ Add</button>}
          />
          {isOpen('links')&&(<div style={{padding:'12px 16px',borderBottom:`1px solid ${T.bd}`}}>{addingLink&&(<div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:12}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}><Fld label="Label" mb={0}><Inp value={newLink.label} onChange={v=>setNL(x=>({...x,label:v}))} placeholder="e.g. SharePoint folder"/></Fld><Fld label="Type" mb={0}><select value={newLink.type} onChange={e=>setNL(x=>({...x,type:e.target.value}))} style={ss.sel}>{LINK_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></Fld></div><Fld label="URL" mb={8}><Inp value={newLink.url} onChange={v=>setNL(x=>({...x,url:v}))} placeholder="https://viarailonline.sharepoint.com/…"/></Fld><div style={{display:'flex',gap:4}}><button onClick={()=>{if(newLink.url.trim()){saveFile(file.id,{sharePointLinks:[...(file.sharePointLinks||[]),{id:uid(),createdAt:TODAY_STR,...newLink}]});setNL({label:'',url:'',type:'folder'});setAddingLink(false);}}} style={ss.btnP}>Add</button><button onClick={()=>setAddingLink(false)} style={ss.btn}>Cancel</button></div></div>)}{(file.sharePointLinks||[]).length===0&&!addingLink&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic'}}>No links yet.</div>}{(file.sharePointLinks||[]).map(lnk=>(<div key={lnk.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',border:`1px solid ${T.bd}`,borderRadius:5,marginBottom:5,background:T.s2}}><div style={{flex:1,minWidth:0}}><a href={lnk.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:T.acc,fontWeight:500,display:'block',marginBottom:2,...trunc}}>{lnk.label||lnk.url}</a><span style={{fontSize:9,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.4px'}}>{(lnk.type||'folder').replace(/_/g,' ')}</span></div><button onClick={()=>saveFile(file.id,{sharePointLinks:(file.sharePointLinks||[]).filter(l=>l.id!==lnk.id)})} style={{background:'transparent',border:'none',cursor:'pointer',color:T.tx3,fontSize:13,flexShrink:0}}>×</button></div>))}</div>)}

          {/* ── LOG ── */}
          <AHead id="log" label="Change Log"
            badge={(file.log||[]).length||null}
            action={<button onClick={()=>setAddingLog(true)} style={{...ss.btnP,fontSize:9,padding:'2px 8px'}}>+ Add</button>}
          />
          {isOpen('log')&&(<div style={{padding:'12px 16px'}}>{addingLog&&(<div style={{border:`1px solid ${T.bd2}`,borderRadius:6,padding:'12px',marginBottom:12}}><Fld label="Title"><Inp value={logTitle} onChange={setLogTitle} placeholder="What changed?"/></Fld><Fld label="Summary" mb={6}><Inp value={logText} onChange={setLogText} placeholder="Describe what changed and who confirmed it…" rows={3}/></Fld><div style={{display:'flex',gap:4}}><button onClick={()=>{if(logText.trim()){addLogEntry(file.id,logText,logTitle||'Update');setLogText('');setLogTitle('');setAddingLog(false);}}} style={ss.btnP}>Add</button><button onClick={()=>{setAddingLog(false);setLogText('');setLogTitle('');}} style={ss.btn}>Cancel</button></div></div>)}{(file.log||[]).length===0&&!addingLog&&<div style={{fontSize:12,color:T.tx3,fontStyle:'italic'}}>No log entries yet.</div>}{(file.log||[]).map(entry=>(<div key={entry.id} style={{padding:'9px 0',borderBottom:`1px solid ${T.bd3}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}><span style={{fontSize:11,fontWeight:600,color:T.tx,...trunc,maxWidth:'70%'}}>{entry.title||'Update'}</span><span style={{fontSize:10,color:T.tx3,fontFamily:T.mono,flexShrink:0}}>{fmt(entry.date)}</span></div><p style={{margin:0,fontSize:12,color:T.tx2,lineHeight:1.6,wordBreak:'break-word'}}>{entry.summary}</p></div>))}</div>)}
        </div>

        {/* Side panel — shows whenever a deliverable is selected, regardless of section */}
        {selDv&&(<DeliverablePanel dvId={selDv} data={data} onClose={()=>setSelDv(null)} saveDeliverable={saveDeliverable} delDeliverable={delDeliverable} saveTask={saveTask} delTask={delTask} newTask={newTask}/>)}
      </div>
      {showTemplateModal&&<ApplyTemplateModal file={file} data={data} onClose={()=>setShowTemplateModal(false)} onApply={applyTemplate}/>}
    </div>
  );
}

// ─── FILE CARD ────────────────────────────────────────────────────────────────
function FileCard({file,data,onClick,selected}){
  const openTasks=data.tasks.filter(t=>(t.fileId||t.projectId)===file.id&&!isDone(t));
  const openDVs=(data.deliverables||[]).filter(d=>d.fileId===file.id&&!isDoneDV(d));
  const nextTask=[...openTasks].sort((a,b)=>{if(!a.dueDate&&!b.dueDate)return 0;if(!a.dueDate)return 1;if(!b.dueDate)return-1;return a.dueDate.localeCompare(b.dueDate);})[0];
  const health=FH[file.health]||FH.unknown;
  return(
    <div onClick={onClick} style={{background:selected?T.s3:T.s1,border:`1px solid ${selected?T.acc:T.bd}`,borderRadius:8,padding:'11px 13px',cursor:'pointer',transition:'border-color .15s, background .15s'}} onMouseEnter={e=>{if(!selected){e.currentTarget.style.borderColor=T.bd2;e.currentTarget.style.background=T.s2;}}} onMouseLeave={e=>{if(!selected){e.currentTarget.style.borderColor=T.bd;e.currentTarget.style.background=T.s1;}}}>
      <div style={{height:2,background:health.tx,borderRadius:1,marginBottom:9,opacity:0.7}}/>
      <div style={{marginBottom:7}}>
        <div style={{fontSize:13,fontWeight:600,color:T.tx,lineHeight:1.3,marginBottom:3,wordBreak:'break-word',overflowWrap:'break-word'}}>{file.title}</div>
        <div style={{fontSize:11,color:T.tx2,...trunc}}>{file.lead||'—'}</div>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:7}}>
        <StatusDot map={FS} val={file.status}/>
        {file.health!=='unknown'&&<StatusDot map={FH} val={file.health}/>}
        {file.priority!=='medium'&&<StatusDot map={FP} val={file.priority}/>}
      </div>
      {nextTask&&<div style={{fontSize:11,color:T.tx2,background:T.s2,borderRadius:4,padding:'4px 8px',marginBottom:6,borderLeft:`2px solid ${T.acc}40`}}>
        <span style={{color:T.tx3,fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>Next · </span>
        <span style={{wordBreak:'break-word'}}>{nextTask.title.slice(0,60)}{nextTask.title.length>60?'…':''}</span>
        {nextTask.dueDate&&<span style={{float:'right',marginLeft:4}}><DueChip date={nextTask.dueDate}/></span>}
      </div>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:5}}>
          <span style={{fontSize:10,color:T.tx3}}>{openTasks.length}t</span>
          {openDVs.length>0&&<span style={{fontSize:10,color:T.acc}}>{openDVs.length}d</span>}
        </div>
        <span style={{fontSize:10,color:T.tx3}}>{file.updatedAt?fmt(file.updatedAt):'—'}</span>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({data,saveFile,saveTask,delTask,newTask,addLogEntry,saveDeliverable,delDeliverable,newDeliverable,applyTemplate}){
  const [filter,setFilter]=useState('active');
  const [selFile,setSelFile]=useState(null);
  const [splitW,setSplitW]=useState(440);
  const [liveW,setLiveW]=useState(null);
  const w=liveW??splitW;
  const files=data.files.filter(f=>!f.archived);
  const filtered=filter==='all'?files:filter==='mine'?files.filter(f=>f.lead==='Karl'):files.filter(f=>f.status===filter);
  const activeFile=selFile?data.files.find(f=>f.id===selFile):null;
  const FILTERS=[{k:'all',label:'All'},{k:'active',label:'Active'},{k:'monitoring',label:'Watch'},{k:'mine',label:'Mine'}];
  return(
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{width:w,flexShrink:0,overflowY:'auto',padding:'10px',borderRight:`1px solid ${T.bd}`}}>
        <div style={{display:'flex',gap:4,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
          {FILTERS.map(f=><button key={f.k} onClick={()=>setFilter(f.k)} style={{...ss.btn,background:filter===f.k?T.acc:'transparent',color:filter===f.k?'#fff':T.tx2,border:`1px solid ${filter===f.k?T.acc:T.bd}`}}>{f.label}</button>)}
          <span style={{marginLeft:'auto',fontSize:10,color:T.tx3}}>{filtered.length}</span>
        </div>
        {['urgent','high'].map(pri=>{const bucket=filtered.filter(f=>f.priority===pri);if(!bucket.length)return null;return<div key={pri} style={{marginBottom:8}}><div style={{fontSize:9,fontWeight:700,color:FP[pri].tx,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:4}}>{FP[pri].label}</div><div style={{display:'flex',flexDirection:'column',gap:4}}>{bucket.map(f=><FileCard key={f.id} file={f} data={data} onClick={()=>setSelFile(selFile===f.id?null:f.id)} selected={selFile===f.id}/>)}</div></div>;})}
        {filtered.filter(f=>!['urgent','high'].includes(f.priority)).length>0&&<div><div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:4}}>Other</div><div style={{display:'flex',flexDirection:'column',gap:4}}>{filtered.filter(f=>!['urgent','high'].includes(f.priority)).map(f=><FileCard key={f.id} file={f} data={data} onClick={()=>setSelFile(selFile===f.id?null:f.id)} selected={selFile===f.id}/>)}</div></div>}
      </div>
      <ResizeHandle currentWidth={w} onResizeLive={setLiveW} onResizeEnd={v=>{setLiveW(null);setSplitW(v);}}/>
      {activeFile?<div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}><FilePage file={activeFile} data={data} onClose={()=>setSelFile(null)} saveFile={saveFile} saveTask={saveTask} delTask={delTask} newTask={newTask} addLogEntry={addLogEntry} saveDeliverable={saveDeliverable} delDeliverable={delDeliverable} newDeliverable={newDeliverable} applyTemplate={applyTemplate}/></div>:<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}><div style={{fontSize:32,opacity:0.12}}>⬡</div><span style={{fontSize:13,color:T.tx3,fontStyle:'italic'}}>Select a file to view</span></div>}
    </div>
  );
}

// ─── FILES VIEW ───────────────────────────────────────────────────────────────
function FilesView({data,saveFile,saveTask,delTask,newTask,addLogEntry,showAddFile,saveDeliverable,delDeliverable,newDeliverable,applyTemplate}){
  const [search,setSearch]=useState('');
  const [statusF,setStatusF]=useState('all');
  const [inclArchived,setInclArchived]=useState(false);
  const [selFile,setSelFile]=useState(null);
  const [splitW,setSplitW]=useState(280);
  const [liveW,setLiveW]=useState(null);
  const w=liveW??splitW;
  const files=data.files
    .filter(f=>inclArchived?true:!f.archived)
    .filter(f=>statusF==='all'||f.status===statusF)
    .filter(f=>!search||f.title.toLowerCase().includes(search.toLowerCase())||f.lead?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{const po={urgent:0,high:1,medium:2,low:3};return(po[a.priority]||2)-(po[b.priority]||2);});
  const activeFile=selFile?data.files.find(f=>f.id===selFile):null;
  return(
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{width:w,flexShrink:0,borderRight:`1px solid ${T.bd}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'8px 10px',borderBottom:`1px solid ${T.bd}`,background:T.s1,flexShrink:0}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…" style={{...ss.inp,marginBottom:5}}/>
          <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:4}}>
            {['all',...FILE_STATUS_OPTS].map(s=><button key={s} onClick={()=>setStatusF(s)} style={{...ss.btn,fontSize:10,padding:'2px 7px',background:statusF===s?T.acc:'transparent',color:statusF===s?'#fff':T.tx2,border:`1px solid ${statusF===s?T.acc:T.bd}`}}>{s==='all'?'All':FS[s]?.label||s}</button>)}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5}}><input type="checkbox" id="arcf" checked={inclArchived} onChange={e=>setInclArchived(e.target.checked)}/><label htmlFor="arcf" style={{fontSize:10,color:T.tx3,cursor:'pointer'}}>Include archived</label></div>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {files.map(f=>{const openT=data.tasks.filter(t=>(t.fileId||t.projectId)===f.id&&!isDone(t)).length;const openD=(data.deliverables||[]).filter(d=>d.fileId===f.id&&!isDoneDV(d)).length;return(<div key={f.id} onClick={()=>setSelFile(selFile===f.id?null:f.id)} style={{padding:'9px 10px',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',background:selFile===f.id?T.s3:'transparent',borderLeft:`3px solid ${selFile===f.id?T.acc:FS[f.status]?.dot||T.tx3}`,opacity:f.archived?0.5:1}} onMouseEnter={e=>{if(selFile!==f.id)e.currentTarget.style.background=T.s2;}} onMouseLeave={e=>{if(selFile!==f.id)e.currentTarget.style.background='transparent';}}><div style={{fontSize:12,fontWeight:600,color:T.tx,marginBottom:3,lineHeight:1.3,wordBreak:'break-word'}}>{f.title}</div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}><div style={{display:'flex',gap:3,flexWrap:'wrap'}}><StatusDot map={FS} val={f.status}/>{f.priority!=='medium'&&<StatusDot map={FP} val={f.priority}/>}</div><span style={{fontSize:10,color:T.tx3,flexShrink:0,marginLeft:4}}>{openT}t{openD>0?` ${openD}d`:''}</span></div>{f.lead&&<div style={{fontSize:10,color:T.tx3,...trunc}}>👤 {f.lead}</div>}</div>);})}
        </div>
        <div style={{padding:'7px 10px',borderTop:`1px solid ${T.bd}`,background:T.s1,flexShrink:0}}><button onClick={showAddFile} style={{...ss.btnP,width:'100%',textAlign:'center'}}>+ New file</button></div>
      </div>
      <ResizeHandle currentWidth={w} onResizeLive={setLiveW} onResizeEnd={v=>{setLiveW(null);setSplitW(v);}}/>
      {activeFile?<div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}><FilePage file={activeFile} data={data} onClose={()=>setSelFile(null)} saveFile={saveFile} saveTask={saveTask} delTask={delTask} newTask={newTask} addLogEntry={addLogEntry} saveDeliverable={saveDeliverable} delDeliverable={delDeliverable} newDeliverable={newDeliverable} applyTemplate={applyTemplate}/></div>:<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}><div style={{fontSize:32,opacity:0.12}}>⬡</div><span style={{fontSize:13,color:T.tx3,fontStyle:'italic'}}>Select a file to open</span></div>}
    </div>
  );
}

// ─── TODAY VIEW ───────────────────────────────────────────────────────────────
function TodayView({data,saveTask,delTask,saveUiPref}){
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
  const myDVs=(data.deliverables||[]).filter(d=>d.ownerName==='Karl'&&!isDoneDV(d));
  const dvDueToday=myDVs.filter(d=>{const ex=flexToExact(d.dueDate);return ex&&(ds(ex)==='today'||ds(ex)==='overdue');});

  const handleDrop=(targetId)=>{if(!dragId||dragId===targetId)return;const list=[...today];const fromIdx=list.findIndex(t=>t.id===dragId);const toIdx=list.findIndex(t=>t.id===targetId);if(fromIdx===-1||toIdx===-1)return;const moved=list.splice(fromIdx,1)[0];list.splice(toIdx,0,moved);saveUiPref('todayOrder',list.map(t=>t.id));setDragId(null);setDragOverId(null);};

  const TRow=({task,draggable:isDraggable})=>{
    const file=getFile(data.files,task.fileId||task.projectId);
    const blocked=isBlocked(task,data.tasks);
    const isDragOver=dragOverId===task.id;
    return(<div draggable={isDraggable} onDragStart={()=>setDragId(task.id)} onDragEnd={()=>{setDragId(null);setDragOverId(null);}} onDragOver={e=>{e.preventDefault();setDragOverId(task.id);}} onDrop={()=>handleDrop(task.id)} onClick={()=>setSelTask(selTask===task.id?null:task.id)} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',background:selTask===task.id?T.s3:isDragOver?T.s3:'transparent',borderTop:isDragOver?`2px solid ${T.acc}`:'2px solid transparent',opacity:dragId===task.id?0.4:1}} onMouseEnter={e=>{if(selTask!==task.id&&!isDragOver)e.currentTarget.style.background=T.s2;}} onMouseLeave={e=>{if(selTask!==task.id&&!isDragOver)e.currentTarget.style.background='transparent';}}>
      {isDraggable&&<span style={{color:T.tx3,fontSize:12,cursor:'grab',flexShrink:0,paddingTop:1}}>⠿</span>}
      <div style={{flex:1,minWidth:0}}>
        {file&&<div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:1,...trunc}}>{file.title}</div>}
        <div style={{fontSize:12,color:T.tx,fontWeight:500,lineHeight:1.3,...wrap2}}>{task.title}</div>
        <div style={{display:'flex',gap:3,flexWrap:'wrap',alignItems:'center',marginTop:3}}><StatusDot map={TS} val={task.status}/>{blocked&&<Chip text="⛔" bg="rgba(217,95,95,0.12)" tx={T.r} small/>}{task.dueDate&&<DueChip date={task.dueDate}/>}</div>
      </div>
      <button onClick={e=>{e.stopPropagation();saveTask(task.id,{status:'completed'});}} style={{...ss.btn,fontSize:9,padding:'2px 6px',color:T.g,borderColor:'rgba(63,182,139,0.3)',flexShrink:0,marginTop:1}}>✓</button>
    </div>);
  };

  const Section=({title,tasks,draggable,accent,extra})=>{if(!tasks.length&&!extra?.length)return null;return<div style={{marginBottom:14}}><div style={{fontSize:9,fontWeight:700,color:accent||T.tx3,textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:4}}>{title} <span style={{opacity:0.6}}>({tasks.length+(extra?.length||0)})</span></div><div style={{border:`1px solid ${T.bd}`,borderRadius:6,overflow:'hidden',background:T.s1}}>{tasks.map(t=><TRow key={t.id} task={t} draggable={draggable}/>)}{extra?.map(dv=>(<div key={dv.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderBottom:`1px solid ${T.bd3}`,background:'rgba(212,146,42,0.04)'}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:9,fontWeight:700,color:T.y,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:1,...trunc}}>{getFile(data.files,dv.fileId)?.title||''} · Deliverable</div><div style={{fontSize:12,color:T.tx,fontWeight:500,...wrap2}}>{dv.title}</div><div style={{marginTop:3,display:'flex',gap:3,flexWrap:'wrap'}}><Chip text={dvLabel(dv.type)} bg="rgba(212,146,42,0.10)" tx={T.y} small/>{dv.dueDate&&<FlexChip fd={dv.dueDate}/>}</div></div></div>))}</div></div>;};

  return(<div style={{display:'flex',height:'100%',overflow:'hidden'}}><div style={{flex:1,overflowY:'auto',padding:'14px 16px',maxWidth:660}}><div style={{marginBottom:14}}><h3 style={{margin:'0 0 2px',fontSize:15,fontWeight:700,color:T.tx,fontFamily:T.font}}>{new Date().toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}</h3><div style={{fontSize:11,color:T.tx3}}>{allMyTasks.length} open tasks · {overdue.length} overdue</div></div><Section title="Overdue" tasks={overdue} accent={T.r}/><Section title="Today" tasks={today} draggable accent={T.y} extra={dvDueToday}/>{today.length===0&&overdue.length===0&&dvDueToday.length===0&&<div style={{padding:'14px',border:`1px solid ${T.bd}`,borderRadius:6,background:T.s1,marginBottom:14,fontSize:12,color:T.tx3,fontStyle:'italic',textAlign:'center'}}>Nothing due today or overdue.</div>}<Section title="Next 3 days" tasks={thisWeek} accent={T.acc}/><Section title="No date" tasks={noDate}/></div>{selTask&&<TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}</div>);
}

// ─── CALENDAR VIEW ────────────────────────────────────────────────────────────
function CalendarView({data,calMode,setCalMode,saveTask,delTask}){
  const [refDate,setRefDate]=useState(TODAY);
  const [selTask,setSelTask]=useState(null);
  const yr=refDate.getFullYear(),mo=refDate.getMonth();
  const tasksByDate=useMemo(()=>{const map={};data.tasks.filter(t=>t.dueDate&&!isDone(t)).forEach(t=>{if(!map[t.dueDate])map[t.dueDate]=[];map[t.dueDate].push(t);});return map;},[data.tasks]);
  const dvsByDate=useMemo(()=>{const map={};(data.deliverables||[]).filter(d=>!isDoneDV(d)).forEach(d=>{const ex=flexToExact(d.dueDate);if(ex){if(!map[ex])map[ex]=[];map[ex].push(d);}});return map;},[data.deliverables]);
  const fileForTask=t=>getFile(data.files,t.fileId||t.projectId);

  if(calMode==='weekly'){
    const days=wkDays(refDate);
    return(<div style={{display:'flex',height:'100%',overflow:'hidden'}}><div style={{flex:1,padding:10,display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexShrink:0}}><button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setDate(d.getDate()-7);return x;})} style={ss.btn}>‹</button><span style={{fontSize:13,fontWeight:600,color:T.tx}}>{fmt(toStr(days[0]))} – {fmt(toStr(days[6]))}</span><button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setDate(d.getDate()+7);return x;})} style={ss.btn}>›</button><button onClick={()=>setRefDate(TODAY)} style={{...ss.btn,fontSize:10}}>Today</button></div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,flex:1,minHeight:0,overflow:'auto'}}>{days.map((day,di)=>{const dStr=toStr(day),isToday=dStr===TODAY_STR;const dayTasks=tasksByDate[dStr]||[];const dayDVs=dvsByDate[dStr]||[];return(<div key={di} style={{background:isToday?'rgba(91,156,246,0.06)':T.s1,border:`1px solid ${isToday?T.acc:T.bd}`,borderRadius:5,padding:'7px',display:'flex',flexDirection:'column'}}><div style={{fontSize:11,fontWeight:700,color:isToday?T.acc:T.tx2,marginBottom:4,flexShrink:0}}>{WD[di]}<br/><span style={{fontSize:13}}>{day.getDate()}</span></div><div style={{flex:1,overflowY:'auto',minHeight:0}}>{dayDVs.map(d=><div key={d.id} style={{background:'rgba(212,146,42,0.10)',borderRadius:3,padding:'2px 5px',marginBottom:2,fontSize:9,color:T.y,fontWeight:600,...trunc}}>{dvLabel(d.type)}: {d.title}</div>)}{dayTasks.map(t=>{const file=fileForTask(t);return(<div key={t.id} onClick={()=>setSelTask(selTask===t.id?null:t.id)} style={{background:selTask===t.id?T.s3:T.s2,border:`1px solid ${selTask===t.id?T.acc:T.bd}`,borderRadius:3,padding:'3px 5px',marginBottom:2,cursor:'pointer'}}>{file&&<div style={{fontSize:9,fontWeight:700,color:T.tx3,...trunc}}>{file.title}</div>}<div style={{fontSize:10,color:T.tx,lineHeight:1.3,wordBreak:'break-word'}}>{t.title}</div></div>);})}</div></div>);})} </div></div>{selTask&&<TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}</div>);
  }

  const wks1=weeksOfMonth(yr,mo);
  const mo2=mo===11?0:mo+1; const yr2=mo===11?yr+1:yr;
  const wks2=weeksOfMonth(yr2,mo2);

  const MonthGrid=({wks,monthMo,monthYr})=>(
    <div style={{display:'flex',flexDirection:'column',minWidth:0}}>
      <div style={{fontSize:12,fontWeight:700,color:T.tx,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>{MONTHS_FULL[monthMo]} {monthYr}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,marginBottom:2}}>{WD.map(d=><div key={d} style={{fontSize:9,fontWeight:700,color:T.tx3,textAlign:'center',padding:'2px 0'}}>{d}</div>)}</div>
      <div style={{display:'flex',flexDirection:'column',gap:1}}>
        {wks.map((wk,wi)=>(
          <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1}}>
            {wk.map((day,di)=>{
              const dStr=toStr(day),isToday=dStr===TODAY_STR,inMonth=day.getMonth()===monthMo;
              const dayTasks=(tasksByDate[dStr]||[]).slice(0,2);
              const dayDVs=(dvsByDate[dStr]||[]).slice(0,1);
              return(
                <div key={di} style={{padding:'3px 3px',background:isToday?'rgba(91,156,246,0.06)':inMonth?T.s1:T.s2,border:`1px solid ${isToday?T.acc:T.bd3}`,borderRadius:3,minHeight:48,overflow:'hidden'}}>
                  <div style={{fontSize:10,fontWeight:isToday?700:400,color:inMonth?T.tx2:T.tx3,marginBottom:1}}>{day.getDate()}</div>
                  {dayDVs.map(d=><div key={d.id} style={{fontSize:9,background:'rgba(212,146,42,0.12)',color:T.y,borderRadius:2,padding:'1px 3px',marginBottom:1,...trunc}}>{d.title}</div>)}
                  {dayTasks.map(t=>{const ts=TS[t.status];return(<div key={t.id} onClick={()=>setSelTask(selTask===t.id?null:t.id)} style={{fontSize:9,background:ts?.bg||T.s2,color:ts?.tx||T.tx2,borderRadius:2,padding:'1px 3px',marginBottom:1,cursor:'pointer',...trunc}}>{t.title}</div>);})}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return(<div style={{display:'flex',height:'100%',overflow:'hidden'}}><div style={{flex:1,padding:10,display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexShrink:0}}><button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setMonth(d.getMonth()-1);return x;})} style={ss.btn}>‹</button><span style={{fontSize:13,fontWeight:600,color:T.tx}}>{MONTHS_FULL[mo]} – {MONTHS_FULL[mo2]} {mo2===0?yr2:yr}</span><button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setMonth(d.getMonth()+1);return x;})} style={ss.btn}>›</button><button onClick={()=>setRefDate(TODAY)} style={{...ss.btn,fontSize:10}}>Today</button></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,flex:1,overflow:'auto'}}><MonthGrid wks={wks1} monthMo={mo} monthYr={yr}/><MonthGrid wks={wks2} monthMo={mo2} monthYr={yr2}/></div></div>{selTask&&<TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}</div>);
}

// ─── PEOPLE VIEW ──────────────────────────────────────────────────────────────
function PeopleView({data}){
  const [selPerson,setSelPerson]=useState(null);
  const people=(data.people||[]).filter(p=>p.active!==false);
  const getWorkload=name=>({filesLed:data.files.filter(f=>f.lead===name&&!f.archived),tasksOpen:data.tasks.filter(t=>taskAssignees(t).includes(name)&&!isDone(t)),overdue:data.tasks.filter(t=>taskAssignees(t).includes(name)&&!isDone(t)&&t.dueDate&&ds(t.dueDate)==='overdue'),dvOwned:(data.deliverables||[]).filter(d=>d.ownerName===name&&!isDoneDV(d))});
  return(<div style={{display:'flex',height:'100%',overflow:'hidden'}}><div style={{width:220,flexShrink:0,borderRight:`1px solid ${T.bd}`,overflowY:'auto'}}>{people.map(p=>{const wl=getWorkload(p.name);return(<div key={p.id} onClick={()=>setSelPerson(selPerson===p.id?null:p.id)} style={{padding:'9px 10px',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',background:selPerson===p.id?T.s3:'transparent'}} onMouseEnter={e=>{if(selPerson!==p.id)e.currentTarget.style.background=T.s2;}} onMouseLeave={e=>{if(selPerson!==p.id)e.currentTarget.style.background='transparent';}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:1}}><span style={{fontSize:12,fontWeight:600,color:T.tx,...trunc,maxWidth:120}}>{p.name}</span>{wl.overdue.length>0&&<span style={{fontSize:10,color:T.r,fontWeight:600,flexShrink:0}}>{wl.overdue.length}!</span>}</div>{p.title&&<div style={{fontSize:10,color:T.tx3,marginBottom:2,...trunc}}>{p.title}</div>}<div style={{display:'flex',gap:5}}><span style={{fontSize:10,color:T.tx2}}>{wl.filesLed.length}f</span><span style={{fontSize:10,color:T.tx2}}>{wl.tasksOpen.length}t</span>{wl.dvOwned.length>0&&<span style={{fontSize:10,color:T.acc}}>{wl.dvOwned.length}d</span>}</div></div>);})}</div><div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>{selPerson?(()=>{const p=people.find(x=>x.id===selPerson);if(!p)return null;const wl=getWorkload(p.name);return(<div><h3 style={{margin:'0 0 2px',fontSize:15,fontWeight:700,color:T.tx,fontFamily:T.font}}>{p.name}</h3>{p.title&&<div style={{fontSize:12,color:T.tx2,marginBottom:12}}>{p.title}</div>}{wl.filesLed.length>0&&<div style={{marginBottom:12}}><div style={ss.lbl}>FILES LED ({wl.filesLed.length})</div>{wl.filesLed.map(f=><div key={f.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:`1px solid ${T.bd3}`}}><span style={{fontSize:12,color:T.tx,flex:1,...trunc}}>{f.title}</span><StatusDot map={FS} val={f.status}/></div>)}</div>}{wl.dvOwned.length>0&&<div style={{marginBottom:12}}><div style={ss.lbl}>DELIVERABLES ({wl.dvOwned.length})</div>{wl.dvOwned.map(d=>{const file=getFile(data.files,d.fileId);return(<div key={d.id} style={{padding:'4px 0',borderBottom:`1px solid ${T.bd3}`}}>{file&&<div style={{fontSize:9,color:T.tx3,fontWeight:700,textTransform:'uppercase',...trunc}}>{file.title}</div>}<div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:12,color:T.tx,flex:1,...trunc}}>{d.title}</span><StatusDot map={DVS} val={d.status}/></div></div>);})}</div>}{wl.tasksOpen.length>0&&<div style={{marginBottom:12}}><div style={ss.lbl}>OPEN TASKS ({wl.tasksOpen.length})</div>{wl.tasksOpen.map(t=>{const file=getFile(data.files,t.fileId||t.projectId);return(<div key={t.id} style={{padding:'4px 0',borderBottom:`1px solid ${T.bd3}`}}>{file&&<div style={{fontSize:9,color:T.tx3,fontWeight:700,textTransform:'uppercase',...trunc}}>{file.title}</div>}<div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:12,color:T.tx,flex:1,...wrap2}}>{t.title}</span>{t.dueDate&&<DueChip date={t.dueDate}/>}</div></div>);})}</div>}</div>);})():<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:T.tx3,fontSize:13,fontStyle:'italic'}}>Select a person</div>}</div></div>);
}

// ─── TEMPLATES VIEW ───────────────────────────────────────────────────────────
function TemplatesView(){
  const [sel,setSel]=useState(null);
  const tpl=BUILT_IN_TEMPLATES.find(t=>t.id===sel);
  return(<div style={{height:'100%',overflow:'auto',padding:'14px 20px',maxWidth:760}}><div style={{marginBottom:14}}><h3 style={{margin:'0 0 2px',fontSize:15,fontWeight:700,color:T.tx,fontFamily:T.serif}}>Templates</h3><p style={{margin:0,fontSize:12,color:T.tx2}}>Select a template to see its tasks. Apply templates from the Deliverables tab inside any file.</p></div><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:7,marginBottom:16}}>{BUILT_IN_TEMPLATES.map(t=>(<div key={t.id} onClick={()=>setSel(sel===t.id?null:t.id)} style={{padding:'10px 12px',border:`1.5px solid ${sel===t.id?T.acc:T.bd}`,borderRadius:7,cursor:'pointer',background:sel===t.id?T.s3:T.s2}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:3}}><div style={{fontSize:12,fontWeight:600,color:T.tx,...wrap2}}>{t.name}</div><span style={{fontSize:9,color:T.tx3,fontFamily:T.mono,flexShrink:0,marginLeft:4}}>{t.taskTemplates.length}t</span></div><div style={{fontSize:10,color:T.tx3,lineHeight:1.4,marginBottom:3,...wrap2}}>{t.description}</div><div style={{fontSize:9,color:T.acc}}>{dvLabel(t.deliverableType)}</div></div>))}</div>{tpl&&(<div style={{border:`1px solid ${T.bd}`,borderRadius:8,overflow:'hidden'}}><div style={{padding:'9px 13px',background:T.s2,borderBottom:`1px solid ${T.bd}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:13,fontWeight:600,color:T.tx}}>{tpl.name}</div><div style={{fontSize:10,color:T.tx3,marginTop:1}}>{tpl.defaultDurationDays}-day default · apply from a file's Deliverables tab</div></div></div>{tpl.taskTemplates.map((tt,i)=>(<div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 13px',borderBottom:`1px solid ${T.bd3}`,background:i%2===0?T.s1:T.s2}}><div style={{width:20,height:20,borderRadius:'50%',background:T.s3,border:`1px solid ${T.bd2}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:9,fontWeight:700,color:T.tx3,marginTop:1}}>{i+1}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:T.tx,marginBottom:1,...wrap2}}>{tt.title}</div>{tt.notes&&<div style={{fontSize:10,color:T.tx3,lineHeight:1.4,...wrap2}}>{tt.notes}</div>}</div><div style={{flexShrink:0,textAlign:'right'}}>{tt.offsetDays!==0?<span style={{fontSize:10,color:T.tx3,fontFamily:T.mono}}>{tt.offsetDays>0?'+':''}{tt.offsetDays}d</span>:<span style={{fontSize:10,color:T.acc,fontFamily:T.mono}}>target</span>}{tt.requiresApproval&&<div style={{marginTop:2}}><Chip text="Approval" bg="rgba(212,146,42,0.12)" tx={T.y} small/></div>}</div></div>))}</div>)}</div>);
}

// ─── CLAUDE VIEW ──────────────────────────────────────────────────────────────
function ClaudeView({data,onImport}){
  const [importJson,setImportJson]=useState('');
  const [importErr,setImportErr]=useState('');
  const [preview,setPreview]=useState(null);
  const [applied,setApplied]=useState(false);
  const parseImport=jsonStr=>{try{const imp=JSON.parse(jsonStr);const changes=[];if(imp.memoryUpdates?.length)changes.push(`${imp.memoryUpdates.length} memory update(s)`);if(imp.logEntriesToCreate?.length)changes.push(`${imp.logEntriesToCreate.length} log entr${imp.logEntriesToCreate.length===1?'y':'ies'}`);if(imp.tasksToComplete?.length)changes.push(`${imp.tasksToComplete.length} task(s) completed`);if(imp.tasksToCreate?.length)changes.push(`${imp.tasksToCreate.length} new task(s)`);if(imp.tasksToUpdate?.length)changes.push(`${imp.tasksToUpdate.length} task update(s)`);if(imp.filesToCreate?.length)changes.push(`${imp.filesToCreate.length} new file(s)`);if(imp.filesToUpdate?.length)changes.push(`${imp.filesToUpdate.length} file update(s)`);if(imp.deliverablesToCreate?.length)changes.push(`${imp.deliverablesToCreate.length} new deliverable(s)`);if(imp.deliverablesToUpdate?.length)changes.push(`${imp.deliverablesToUpdate.length} deliverable update(s)`);if(imp.milestonesToCreate?.length)changes.push(`${imp.milestonesToCreate.length} milestone(s)`);if(imp.risksToCreate?.length)changes.push(`${imp.risksToCreate.length} risk(s)`);if(imp.questionsToCreate?.length)changes.push(`${imp.questionsToCreate.length} question(s)`);if(imp.sharePointLinksToCreate?.length)changes.push(`${imp.sharePointLinksToCreate.length} link(s)`);if(changes.length===0)changes.push('No recognised changes found.');setPreview({imp,changes,summary:imp.summary||'No summary provided.'});setImportErr('');}catch(e){setImportErr('Invalid JSON — check the format and try again.');setPreview(null);}};
  return(
    <div style={{height:'100%',overflow:'auto',padding:'14px 20px',maxWidth:700}}>
      <div style={{marginBottom:14}}>
        <h3 style={{margin:'0 0 2px',fontSize:15,fontWeight:700,color:T.tx,fontFamily:T.serif}}>Import</h3>
        <p style={{margin:0,fontSize:12,color:T.tx2}}>Paste the JSON update package produced by Claude, preview the changes, then apply.</p>
      </div>
      {/* Workflow reference */}
      <div style={{padding:'10px 12px',background:T.s2,border:`1px solid ${T.bd}`,borderRadius:6,marginBottom:16,fontSize:11,color:T.tx3,lineHeight:1.7}}>
        <div style={{fontWeight:600,color:T.tx,marginBottom:4}}>Workflow</div>
        <div>1. Take notes (meetings, bullet points, email follow-ups) in your usual format.</div>
        <div>2. Open Claude — paste your notes. Claude reads live Palantír state from Supabase.</div>
        <div>3. Claude walks through proposed changes file by file and asks clarifying questions.</div>
        <div>4. Once confirmed, Claude produces a JSON update package.</div>
        <div>5. Paste the JSON below → Preview → Apply. A snapshot is saved automatically before applying.</div>
      </div>
      {!preview?(
        <>
          <Fld label="Paste Claude's update package JSON here">
            <textarea value={importJson} onChange={e=>setImportJson(e.target.value)} rows={14} placeholder={'{\n  "importType": "palantir_update_package",\n  "version": "1.0",\n  "summary": "...",\n  ...\n}'} style={{...ss.inp,resize:'vertical',fontFamily:T.mono,fontSize:11}}/>
          </Fld>
          {importErr&&<div style={{color:T.r,fontSize:11,marginBottom:8}}>{importErr}</div>}
          <button onClick={()=>parseImport(importJson)} style={ss.btnP}>Validate & Preview</button>
        </>
      ):(
        <div>
          {applied?(
            <div style={{padding:'16px',background:'rgba(63,182,139,0.08)',border:`1px solid rgba(63,182,139,0.2)`,borderRadius:6,textAlign:'center'}}>
              <div style={{fontSize:14,fontWeight:600,color:T.g,marginBottom:6}}>✓ Import applied — snapshot was saved before changes</div>
              <button onClick={()=>{setPreview(null);setImportJson('');setApplied(false);}} style={ss.btn}>Import another</button>
            </div>
          ):(
            <>
              <div style={{padding:'12px',background:T.s2,borderRadius:6,marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:T.tx,marginBottom:4}}>Summary: {preview.summary}</div>
                {preview.changes.map((c,i)=><div key={i} style={{fontSize:11,color:T.tx2,padding:'2px 0',borderBottom:`1px solid ${T.bd3}`}}>· {c}</div>)}
                {(preview.imp.warnings||[]).map((w,i)=><div key={i} style={{fontSize:11,color:T.y,marginTop:4}}>⚠ {w}</div>)}
              </div>
              <div style={{fontSize:11,color:T.tx3,marginBottom:10}}>A snapshot of current state will be saved automatically before applying.</div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>{onImport(preview.imp);setApplied(true);}} style={ss.btnP}>Apply changes</button>
                <button onClick={()=>{setPreview(null);setImportJson('');}} style={ss.btn}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SNAPSHOT MODAL ───────────────────────────────────────────────────────────
function SnapshotModal({data,onClose,onRestore}){
  const [snaps,setSnaps]=useState(null);
  const [sel,setSel]=useState(null);
  const [label,setLabel]=useState('');
  const [saving,setSaving]=useState(false);
  const [restoring,setRestoring]=useState(false);
  const [msg,setMsg]=useState('');

  useEffect(()=>{load();},[]);

  const load=async()=>{
    try{
      const{data:rows}=await supabase.from('palantir_snapshots').select('id,created_at,trigger,label,state').order('created_at',{ascending:false}).limit(30);
      setSnaps(rows||[]);
    }catch(e){setSnaps([]);}
  };

  const saveNow=async()=>{
    setSaving(true);setMsg('');
    try{
      const{data:{user}}=await supabase.auth.getUser();
      await supabase.from('palantir_snapshots').insert({user_id:user?.id,state:data,trigger:'manual',label:label.trim()||null});
      setLabel('');setMsg('✓ Snapshot saved');
      await load();
    }catch(e){setMsg('Error saving snapshot');}
    setSaving(false);
  };

  const downloadJson=()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`palantir-${TODAY_STR}.json`;a.click();
    URL.revokeObjectURL(a.href);
  };

  const doRestore=async(snap)=>{
    if(!window.confirm('Restore this snapshot? Current state will be replaced.'))return;
    setRestoring(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      await supabase.from('palantir_state').upsert({id:1,state:snap.state,updated_at:new Date().toISOString(),user_id:user?.id});
      onRestore(snap.state);
      onClose();
    }catch(e){setMsg('Error restoring snapshot');setRestoring(false);}
  };

  const doDelete=async(snap,e)=>{
    e.stopPropagation();
    if(!window.confirm('Delete this snapshot?'))return;
    await supabase.from('palantir_snapshots').delete().eq('id',snap.id);
    if(sel?.id===snap.id)setSel(null);
    await load();
  };

  const snapInfo=s=>{
    const st=s?.state||{};
    const files=(st.files||[]).filter(f=>!f.archived).length;
    const tasks=(st.tasks||[]).filter(t=>!isDone(t)).length;
    const dvs=(st.deliverables||[]).filter(d=>!isDoneDV(d)).length;
    return{files,tasks,dvs};
  };

  const triggerIcon=t=>({manual:'💾',pre_import:'⬇',daily:'🕐',pre_edit:'✏️'})[t]||'📌';
  const fmtTs=ts=>{const d=new Date(ts);return d.toLocaleDateString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});};

  return(
    <Overlay onClose={onClose} wide>
      <ModalH title="Snapshots & Backup" onClose={onClose}/>
      {/* Save + Download row */}
      <div style={{display:'flex',gap:6,marginBottom:14,alignItems:'center',flexWrap:'wrap'}}>
        <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Snapshot label (optional)" style={{...ss.inp,flex:1,minWidth:140}}/>
        <button onClick={saveNow} disabled={saving} style={{...ss.btnP,flexShrink:0}}>{saving?'Saving…':'💾 Save now'}</button>
        <button onClick={downloadJson} style={{...ss.btn,flexShrink:0}}>⬇ JSON</button>
      </div>
      {msg&&<div style={{fontSize:11,color:msg.startsWith('✓')?T.g:T.r,marginBottom:10}}>{msg}</div>}
      {/* Snapshot list + preview split */}
      <div style={{display:'flex',gap:0,border:`1px solid ${T.bd}`,borderRadius:7,overflow:'hidden',minHeight:300}}>
        {/* List */}
        <div style={{width:260,flexShrink:0,overflowY:'auto',borderRight:`1px solid ${T.bd}`}}>
          {snaps===null&&<div style={{padding:14,fontSize:12,color:T.tx3}}>Loading…</div>}
          {snaps?.length===0&&<div style={{padding:14,fontSize:12,color:T.tx3,fontStyle:'italic'}}>No snapshots yet.</div>}
          {snaps?.map(s=>{const info=snapInfo(s);return(
            <div key={s.id} onClick={()=>setSel(s)} style={{padding:'8px 10px',borderBottom:`1px solid ${T.bd3}`,cursor:'pointer',background:sel?.id===s.id?T.s3:T.s1}} onMouseEnter={e=>{if(sel?.id!==s.id)e.currentTarget.style.background=T.s2;}} onMouseLeave={e=>{if(sel?.id!==s.id)e.currentTarget.style.background=T.s1;}}>
              <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                <span style={{fontSize:11}}>{triggerIcon(s.trigger)}</span>
                <span style={{fontSize:11,fontWeight:600,color:T.tx,flex:1,...trunc}}>{s.label||s.trigger}</span>
                <button onClick={e=>doDelete(s,e)} style={{background:'transparent',border:'none',cursor:'pointer',color:T.tx3,fontSize:12,padding:0,lineHeight:1,flexShrink:0}}>×</button>
              </div>
              <div style={{fontSize:10,color:T.tx3,fontFamily:T.mono}}>{fmtTs(s.created_at)}</div>
              <div style={{fontSize:9,color:T.tx3,marginTop:1}}>{info.files}f · {info.tasks}t · {info.dvs}d</div>
            </div>
          );})}
        </div>
        {/* Preview */}
        <div style={{flex:1,padding:14,overflowY:'auto'}}>
          {!sel&&<div style={{color:T.tx3,fontSize:12,fontStyle:'italic',marginTop:20,textAlign:'center'}}>Select a snapshot to preview</div>}
          {sel&&(()=>{const info=snapInfo(sel);const st=sel.state;return(<div>
            <div style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${T.bd}`}}>
              <div style={{fontSize:13,fontWeight:600,color:T.tx,marginBottom:3}}>{sel.label||sel.trigger}</div>
              <div style={{fontSize:11,color:T.tx3}}>{fmtTs(sel.created_at)}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
              {[['Files',info.files,T.acc],['Open tasks',info.tasks,T.y],['Deliverables',info.dvs,T.g]].map(([l,v,c])=>(
                <div key={l} style={{padding:'8px 10px',background:T.s2,borderRadius:5,textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:10,color:T.tx3}}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Active files in snapshot</div>
              {(st.files||[]).filter(f=>!f.archived&&f.status==='active').slice(0,8).map(f=>(
                <div key={f.id} style={{fontSize:11,color:T.tx2,padding:'2px 0',borderBottom:`1px solid ${T.bd3}`,...trunc}}>{f.title}</div>
              ))}
              {(st.files||[]).filter(f=>!f.archived&&f.status==='active').length>8&&<div style={{fontSize:10,color:T.tx3,marginTop:2}}>…and {(st.files||[]).filter(f=>!f.archived&&f.status==='active').length-8} more</div>}
            </div>
            <button onClick={()=>doRestore(sel)} disabled={restoring} style={{...ss.btn,width:'100%',color:T.y,borderColor:'rgba(212,146,42,0.3)',padding:'7px 0',fontSize:11}}>{restoring?'Restoring…':'⟲ Restore this snapshot'}</button>
          </div>);})()}
        </div>
      </div>
    </Overlay>
  );
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function AddFileModal({data,onClose,onCreate}){
  const [form,setForm]=useState({title:'',status:'active',priority:'medium',health:'unknown',sensitivity:'normal',lead:'Karl',memory:''});
  const people=allPeopleFrom(data);
  return(<Overlay onClose={onClose}><ModalH title="New File" onClose={onClose}/><Fld label="Title"><Inp value={form.title} onChange={v=>setForm(x=>({...x,title:v}))} placeholder="File name"/></Fld><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Fld label="Status" mb={8}><select value={form.status} onChange={e=>setForm(x=>({...x,status:e.target.value}))} style={ss.sel}>{FILE_STATUS_OPTS.map(s=><option key={s} value={s}>{FS[s]?.label||s}</option>)}</select></Fld><Fld label="Priority" mb={8}><select value={form.priority} onChange={e=>setForm(x=>({...x,priority:e.target.value}))} style={ss.sel}>{PRIORITY_OPTS.map(s=><option key={s} value={s}>{FP[s]?.label||s}</option>)}</select></Fld><Fld label="Lead" mb={8}><select value={form.lead} onChange={e=>setForm(x=>({...x,lead:e.target.value}))} style={ss.sel}><option value="">—</option>{people.map(m=><option key={m}>{m}</option>)}</select></Fld><Fld label="Sensitivity" mb={8}><select value={form.sensitivity} onChange={e=>setForm(x=>({...x,sensitivity:e.target.value}))} style={ss.sel}>{SENSITIVITY_OPTS.map(s=><option key={s} value={s}>{SENS_C[s]?.label||s}</option>)}</select></Fld></div><Fld label="Initial memory / context (optional)"><Inp value={form.memory} onChange={v=>setForm(x=>({...x,memory:v}))} placeholder="Brief context…" rows={3}/></Fld><button onClick={()=>{if(form.title.trim()){onCreate(form);onClose();}}} style={{...ss.btnP,width:'100%',marginTop:4}}>Create file</button></Overlay>);
}

function TeamModal({data,onClose,setData}){
  const [newName,setNewName]=useState('');const[newTitle,setNewTitle]=useState('');
  const people=data.people||[];
  return(<Overlay onClose={onClose} wide><ModalH title="People & Team" onClose={onClose}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}><div><div style={ss.lbl}>TEAM MEMBERS</div><div style={{marginBottom:10}}>{people.map(p=>(<div key={p.id} style={{display:'flex',alignItems:'center',padding:'5px 0',borderBottom:`1px solid ${T.bd3}`}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:T.tx,fontWeight:500,...trunc}}>{p.name}</div>{p.title&&<div style={{fontSize:10,color:T.tx3,...trunc}}>{p.title}</div>}</div>{p.name!=='Karl'&&<button onClick={()=>setData(d=>({...d,people:d.people.map(x=>x.id===p.id?{...x,active:!x.active}:x)}))} style={{...ss.btn,fontSize:10,padding:'2px 7px',color:p.active!==false?T.tx2:T.r,flexShrink:0}}>{p.active!==false?'Active':'Inactive'}</button>}</div>))}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:4}}><Inp value={newName} onChange={setNewName} placeholder="Name"/><Inp value={newTitle} onChange={setNewTitle} placeholder="Title / Role"/></div><button onClick={()=>{if(newName.trim()&&!people.find(p=>p.name===newName.trim())){setData(d=>({...d,people:[...(d.people||[]),{id:uid(),name:newName.trim(),title:newTitle.trim(),active:true}]}));setNewName('');setNewTitle('');}}} style={ss.btnP}>Add person</button></div><div><div style={ss.lbl}>WORKLOAD SUMMARY</div>{people.filter(p=>p.active!==false).map(p=>{const led=data.files.filter(f=>f.lead===p.name&&!f.archived).length;const tasks=data.tasks.filter(t=>taskAssignees(t).includes(p.name)&&!isDone(t)).length;const overdue=data.tasks.filter(t=>taskAssignees(t).includes(p.name)&&!isDone(t)&&t.dueDate&&ds(t.dueDate)==='overdue').length;const dvs=(data.deliverables||[]).filter(d=>d.ownerName===p.name&&!isDoneDV(d)).length;return(<div key={p.id} style={{padding:'5px 0',borderBottom:`1px solid ${T.bd3}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:12,color:T.tx,fontWeight:500,...trunc,maxWidth:100}}>{p.name}</span><div style={{display:'flex',gap:5,flexShrink:0}}><span style={{fontSize:10,color:T.tx2}}>{led}f</span><span style={{fontSize:10,color:T.tx2}}>{tasks}t</span>{dvs>0&&<span style={{fontSize:10,color:T.acc}}>{dvs}d</span>}{overdue>0&&<span style={{fontSize:10,color:T.r}}>{overdue}!</span>}</div></div></div>);})}</div></div></Overlay>);
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const [data,setData]=useState(null);
  const [view,setView]=useState('dashboard');
  const [calMode,setCalMode]=useState('monthly');
  const [saved,setSaved]=useState(true);
  const [modal,setModal]=useState(null);
  const [fontScale,setFontScaleState]=useState(1.0);
  const saveRef=useRef(null);
  const navigate=useNavigate();

  useEffect(()=>{const link=document.createElement('link');link.href=FONT_LINK;link.rel='stylesheet';document.head.appendChild(link);return()=>{if(document.head.contains(link))document.head.removeChild(link);};},[]);

  useEffect(()=>{
    (async()=>{
      try{
        const{data:row}=await supabase.from('palantir_state').select('state').eq('id',1).maybeSingle();
        if(row?.state&&Object.keys(row.state).length>0){
          const s={deliverables:[],risks:[],openQuestions:[],...row.state};
          setData(s);
          setFontScaleState(s.uiPrefs?.fontScale||1.0);
          return;
        }
        const{data:oldRow}=await supabase.from('planner_state').select('state').eq('id',1).maybeSingle();
        if(oldRow?.state&&Object.keys(oldRow.state).length>0){setData(migrateFromPlanner(oldRow.state));}
        else{setData({files:[],tasks:[],deliverables:[],people:[{id:'per-1',name:'Karl',title:'',active:true}],templates:[],uiPrefs:{fontScale:1.0},version:'1.0'});}
      }catch(e){console.error('Load error',e);setData({files:[],tasks:[],deliverables:[],people:[{id:'per-1',name:'Karl',title:'',active:true}],templates:[],uiPrefs:{fontScale:1.0},version:'1.0'});}
    })();
  },[]);

  useEffect(()=>{
    if(!data)return;setSaved(false);if(saveRef.current)clearTimeout(saveRef.current);
    saveRef.current=setTimeout(async()=>{try{const{data:{user}}=await supabase.auth.getUser();await supabase.from('palantir_state').upsert({id:1,state:data,updated_at:new Date().toISOString(),user_id:user?.id});setSaved(true);}catch(e){console.error('Save error',e);}},800);
  },[data]);

  const saveFile=(id,ch)=>setData(d=>({...d,files:d.files.map(f=>f.id===id?{...f,...ch,updatedAt:TODAY_STR}:f)}));
  const saveTask=(id,ch)=>setData(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,...ch}:t)}));
  const delTask=id=>setData(d=>({...d,tasks:d.tasks.filter(t=>t.id!==id)}));
  const newTask=t=>setData(d=>({...d,tasks:[...d.tasks,{id:uid(),approvalChain:[],dependsOn:[],dependencies:[],assignees:[],link:null,notes:'',gate:'',source:'manual',createdAt:TODAY_STR,...t}]}));
  const addLogEntry=(fileId,summary,title='Update')=>setData(d=>({...d,files:d.files.map(f=>f.id===fileId?{...f,log:[{id:uid(),date:TODAY_STR,title,summary},...(f.log||[])],updatedAt:TODAY_STR}:f)}));
  const saveDeliverable=(id,ch)=>setData(d=>({...d,deliverables:(d.deliverables||[]).map(dv=>dv.id===id?{...dv,...ch,updatedAt:TODAY_STR}:dv)}));
  const delDeliverable=id=>setData(d=>({...d,deliverables:(d.deliverables||[]).filter(dv=>dv.id!==id),tasks:d.tasks.map(t=>t.deliverableId===id?{...t,deliverableId:null}:t)}));
  const newDeliverable=dv=>setData(d=>({...d,deliverables:[...(d.deliverables||[]),{id:uid(),...dv}]}));
  const applyTemplate=(deliverable,tasks)=>setData(d=>({...d,deliverables:[...(d.deliverables||[]),deliverable],tasks:[...d.tasks,...tasks]}));
  const saveUiPref=(key,val)=>setData(d=>({...d,uiPrefs:{...(d.uiPrefs||{}),[key]:val}}));
  const saveFontScale=v=>{setFontScaleState(v);saveUiPref('fontScale',v);};
  const createFile=form=>setData(d=>({...d,files:[...d.files,{id:uid(),title:form.title,status:form.status||'active',priority:form.priority||'medium',health:form.health||'unknown',sensitivity:form.sensitivity||'normal',lead:form.lead||'Karl',memory:form.memory||'',milestones:[],risks:[],openQuestions:[],log:[],sharePointLinks:[],deliverableIds:[],archived:false,createdAt:TODAY_STR,updatedAt:TODAY_STR}]}));

  // ── SNAPSHOT ──────────────────────────────────────────────────────────────
  const takeSnapshot=async(stateToSnap,trigger='manual',label=null)=>{
    try{
      const{data:{user}}=await supabase.auth.getUser();
      await supabase.from('palantir_snapshots').insert({user_id:user?.id,state:stateToSnap,trigger,label});
      // Prune: keep only last 30
      const{data:all}=await supabase.from('palantir_snapshots').select('id').order('created_at',{ascending:false});
      if(all&&all.length>30){
        const ids=all.slice(30).map(s=>s.id);
        await supabase.from('palantir_snapshots').delete().in('id',ids);
      }
    }catch(e){console.error('Snapshot error',e);}
  };

  const downloadJson=()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`palantir-${TODAY_STR}.json`;a.click();
    URL.revokeObjectURL(a.href);
  };

  const applyClaudeImport=async(imp)=>{
    // Auto-snapshot current state before every import
    await takeSnapshot(data,'pre_import',`Before import: ${imp.summary||'update'}`);
    setData(d=>{
      const nd=JSON.parse(JSON.stringify(d));
      (imp.memoryUpdates||[]).forEach(u=>{const f=nd.files.find(x=>x.id===u.fileId||x.title===u.fileTitle);if(f){f.memory=u.newMemory;f.updatedAt=TODAY_STR;}});
      (imp.logEntriesToCreate||[]).forEach(e=>{const f=nd.files.find(x=>x.id===e.fileId||x.title===e.fileTitle);if(f){f.log=[{id:uid(),date:e.date||TODAY_STR,title:e.title||'Update',summary:e.summary},...(f.log||[])];f.updatedAt=TODAY_STR;}});
      (imp.tasksToComplete||[]).forEach(tc=>{const t=nd.tasks.find(x=>x.id===tc.taskId||x.title===tc.taskTitle);if(t){t.status='completed';t.completedAt=TODAY_STR;}});
      (imp.tasksToCreate||[]).forEach(t=>{nd.tasks.push({id:uid(),fileId:t.fileId,projectId:t.fileId,title:t.title,assignees:t.assignees||['Karl'],status:t.status||'not_started',dueDate:t.dueDate||null,dependsOn:[],dependencies:[],notes:t.notes||'',gate:'',link:null,approvalChain:[],source:'claude_import',createdAt:TODAY_STR});});
      (imp.tasksToUpdate||[]).forEach(tu=>{const t=nd.tasks.find(x=>x.id===tu.taskId||x.title===tu.taskTitle);if(t&&tu.changes)Object.assign(t,tu.changes);});
      (imp.filesToUpdate||[]).forEach(fu=>{const f=nd.files.find(x=>x.id===fu.fileId||x.title===fu.fileTitle);if(f&&fu.changes)Object.assign(f,fu.changes);});
      (imp.filesToCreate||[]).forEach(fc=>{nd.files.push({id:uid(),title:fc.title,status:fc.status||'active',priority:fc.priority||'medium',health:'unknown',sensitivity:'normal',lead:fc.lead||'Karl',memory:fc.memory||'',milestones:[],risks:[],openQuestions:[],log:[],sharePointLinks:[],deliverableIds:[],archived:false,createdAt:TODAY_STR,updatedAt:TODAY_STR});});
      (imp.deliverablesToUpdate||[]).forEach(du=>{const dv=(nd.deliverables||[]).find(x=>x.id===du.deliverableId||x.title===du.deliverableTitle);if(dv&&du.changes)Object.assign(dv,du.changes);});
      (imp.deliverablesToCreate||[]).forEach(dc=>{const f=nd.files.find(x=>x.id===dc.fileId||x.title===dc.fileTitle);if(!f)return;const dvId=uid();nd.deliverables=[...(nd.deliverables||[]),{id:dvId,fileId:f.id,title:dc.title||'New Deliverable',type:dc.type||'other',ownerName:dc.ownerName||'',status:dc.status||'not_started',dueDate:dc.dueDate||null,publicationDate:dc.publicationDate||null,approvalStatus:dc.approvalStatus||'not_required',taskIds:[],sharePointUrl:dc.sharePointUrl||'',notes:dc.notes||'',createdAt:TODAY_STR,updatedAt:TODAY_STR}];});
      (imp.milestonesToCreate||[]).forEach(m=>{const f=nd.files.find(x=>x.id===m.fileId||x.title===m.fileTitle);if(f){f.milestones=[...(f.milestones||[]),{id:uid(),title:m.title,status:m.status||'not_started',date:m.date||''}];}});
      (imp.risksToCreate||[]).forEach(r=>{const f=nd.files.find(x=>x.id===r.fileId||x.title===r.fileTitle);if(f){f.risks=[...(f.risks||[]),{id:uid(),title:r.title,description:r.description||'',severity:r.severity||'medium',status:r.status||'open',ownerName:r.ownerName||'',notes:''}];}});
      (imp.questionsToCreate||[]).forEach(q=>{const f=nd.files.find(x=>x.id===q.fileId||x.title===q.fileTitle);if(f){f.openQuestions=[...(f.openQuestions||[]),{id:uid(),question:q.question,ownerName:q.ownerName||'',status:'open',answer:'',notes:''}];}});
      (imp.sharePointLinksToCreate||[]).forEach(l=>{const f=nd.files.find(x=>x.id===l.fileId||x.title===l.fileTitle);if(f){f.sharePointLinks=[...(f.sharePointLinks||[]),{id:uid(),label:l.label||'',url:l.url||'',type:l.type||'folder',createdAt:TODAY_STR}];}});
      return nd;
    });
  };

  if(!data)return(<div style={{height:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.font}}><div style={{textAlign:'center'}}><div style={{fontSize:20,fontFamily:T.serif,color:T.acc2,marginBottom:8,letterSpacing:'0.05em'}}>Palantír</div><div style={{fontSize:12,color:T.tx3}}>Loading…</div></div></div>);

  const urgentFiles=data.files.filter(f=>!f.archived&&(f.priority==='urgent'||f.health==='blocked'||f.health==='at_risk')).length;
  const overdueCount=data.tasks.filter(t=>isMyTask(t)&&!isDone(t)&&t.dueDate&&ds(t.dueDate)==='overdue').length;
  const sharedFileProps={saveFile,saveTask,delTask,newTask,addLogEntry,saveDeliverable,delDeliverable,newDeliverable,applyTemplate};
  const NAV=[{id:'dashboard',label:'Dashboard'},{id:'files',label:'Files'},{id:'today',label:'Today'},{id:'calendar',label:'Calendar'},{id:'people',label:'People'},{id:'templates',label:'Templates'}];

  return(
    <>
      {/* ── Outer shell (no zoom) — flex column filling viewport ── */}
      <div style={{fontFamily:T.font,display:'flex',flexDirection:'column',height:'100vh',background:T.bg,overflow:'hidden',color:T.tx}}>
        {/* Zoomed inner area — flex:1 shrinks to leave room for bottom bar */}
        <div style={{flex:1,zoom:fontScale,display:'flex',flexDirection:'column',overflow:'hidden',background:T.bg,color:T.tx}}>
          {/* HEADER */}
          <div style={{background:T.hdr,borderBottom:`1px solid ${T.bd}`,padding:'0 12px',display:'flex',alignItems:'center',height:44,flexShrink:0,gap:0}}>
            <button onClick={()=>navigate('/')} style={{background:'rgba(91,156,246,0.12)',border:`1px solid rgba(91,156,246,0.2)`,borderRadius:5,padding:'3px 9px',fontSize:10,fontWeight:700,color:T.acc,cursor:'pointer',marginRight:10,fontFamily:T.font,letterSpacing:'0.02em',flexShrink:0}}>KarlOS</button>
            <span style={{fontFamily:T.serif,fontSize:14,fontWeight:600,color:T.acc2,letterSpacing:'0.06em',marginRight:14,flexShrink:0}}>Palantír</span>
            <div style={{display:'flex',gap:0,overflow:'hidden'}}>
              {NAV.map(n=><button key={n.id} onClick={()=>setView(n.id)} style={{padding:'4px 10px',fontSize:11,fontWeight:500,border:'none',background:'transparent',cursor:'pointer',color:view===n.id?T.acc:T.tx2,borderBottom:`2px solid ${view===n.id?T.acc:'transparent'}`,borderRadius:0,fontFamily:T.font,transition:'color .1s',whiteSpace:'nowrap'}}>{n.label}</button>)}
            </div>
            {view==='calendar'&&<div style={{display:'flex',gap:3,marginLeft:8,flexShrink:0}}>{['monthly','weekly'].map(m=><button key={m} onClick={()=>setCalMode(m)} style={{...ss.btn,fontSize:10,background:calMode===m?T.acc:'transparent',color:calMode===m?'#fff':T.tx2,border:`1px solid ${calMode===m?T.acc:T.bd}`,textTransform:'capitalize'}}>{m}</button>)}</div>}
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
              {urgentFiles>0&&<span style={{fontSize:10,background:'rgba(217,95,95,0.15)',color:T.r,borderRadius:10,padding:'1px 7px',fontWeight:600}}>{urgentFiles} urgent</span>}
              {overdueCount>0&&<span style={{fontSize:10,background:'rgba(212,146,42,0.15)',color:T.y,borderRadius:10,padding:'1px 7px',fontWeight:600}}>{overdueCount} overdue</span>}
              <button onClick={()=>setModal('snapshots')} title="Snapshots & Backup" style={{...ss.btn,fontSize:11}}>💾 Snapshots</button>
              <button onClick={downloadJson} title="Download state as JSON" style={{...ss.btn,fontSize:11}}>⬇ JSON</button>
              <button onClick={()=>setView('claude')} style={{...ss.btn,fontSize:11,color:view==='claude'?T.acc:T.tx2,background:view==='claude'?'rgba(91,156,246,0.10)':'transparent',border:`1px solid ${view==='claude'?T.acc:T.bd}`}}>Claude</button>
              <button onClick={()=>setModal('team')} style={{...ss.btn,fontSize:11}}>Team</button>
              <span style={{fontSize:10,color:saved?T.g:T.tx3,fontFamily:T.mono}}>{saved?'✓':'…'}</span>
            </div>
          </div>
          {/* BODY */}
          <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            {view==='dashboard' &&<Dashboard data={data} {...sharedFileProps}/>}
            {view==='files'     &&<FilesView data={data} {...sharedFileProps} showAddFile={()=>setModal('addFile')}/>}
            {view==='today'     &&<TodayView data={data} saveTask={saveTask} delTask={delTask} saveUiPref={saveUiPref}/>}
            {view==='calendar'  &&<CalendarView data={data} calMode={calMode} setCalMode={setCalMode} saveTask={saveTask} delTask={delTask}/>}
            {view==='people'    &&<PeopleView data={data}/>}
            {view==='templates' &&<TemplatesView/>}
            {view==='claude'    &&<ClaudeView data={data} onImport={applyClaudeImport}/>}
          </div>
          {modal==='addFile'&&<AddFileModal data={data} onClose={()=>setModal(null)} onCreate={f=>{createFile(f);setModal(null);}}/>}
          {modal==='team'   &&<TeamModal data={data} onClose={()=>setModal(null)} setData={setData}/>}
          {modal==='snapshots'&&<SnapshotModal data={data} onClose={()=>setModal(null)} onRestore={newState=>{setData(newState);setFontScaleState(newState.uiPrefs?.fontScale||1.0);}}/>}
        </div>

        {/* ── BOTTOM BAR — outside zoom, unaffected by scale ── */}
        <div style={{height:30,background:T.hdr,borderTop:`1px solid ${T.bd}`,display:'flex',alignItems:'center',justifyContent:'center',gap:10,flexShrink:0,userSelect:'none'}}>
          <span style={{fontSize:11,fontFamily:T.serif,color:T.tx3,letterSpacing:'0.04em'}}>Palantír</span>
          <span style={{color:T.bd2,fontSize:12}}>·</span>
          <span style={{fontSize:10,color:T.tx3}}>A</span>
          <input type="range" min={0.5} max={2.0} step={0.05} value={fontScale}
            onChange={e=>saveFontScale(parseFloat(e.target.value))}
            style={{width:200,cursor:'pointer',accentColor:T.acc}}
            title={`Zoom: ${Math.round(fontScale*100)}%`}
          />
          <span style={{fontSize:14,color:T.tx3}}>A</span>
          <span style={{fontSize:10,color:T.tx3,fontFamily:T.mono,minWidth:34}}>{Math.round(fontScale*100)}%</span>
        </div>
      </div>
    </>
  );
}

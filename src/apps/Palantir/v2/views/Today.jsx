// Today surface (blueprint 4.1 + 4.2b): the morning cockpit. Two-week drag strip (drag a task
// onto a day to set its date, day to day across both weeks), the overdue/today/next/no-date
// buckets grouped by file, ghost capture reusing the chip composer, selection + batch bar
// (global), and the right rail. Visual rules: status = dot, priority = bar, date = chip.
// All grouping comes from derive.js; this view never filters entities itself.
import React,{useState} from "react";
import { useStore } from "../data/store";
import { T, sc, ss, wrap2, FILE_PRI, FLAG_KIND } from "../theme";
import { PriBar, FlexChip, Empty } from "../components/primitives";
import { todayBuckets, weekStrip, todayRail, personFirst, staleness } from "../data/derive";
import { DnDProvider, useDnd } from "../components/dnd";
import TaskRow from "../components/TaskRow";
import Composer from "../components/Composer";

const exactFlex=(iso)=>({precision:'exact',date:iso,startDate:null,endDate:null,year:null,month:null,weekStartDate:null,label:'',confidence:'confirmed'});
const rel=(ts)=>{if(!ts)return '';const d=new Date(ts);if(isNaN(d))return '';const days=Math.floor((Date.now()-d.getTime())/864e5);if(days<=0)return 'today';if(days===1)return 'yesterday';if(days<7)return days+'d ago';return d.toLocaleDateString('en-CA',{month:'short',day:'numeric'});};
const abbrev=(t)=>{const s=String(t||'').trim();const w=s.split(/\s+/)[0]||s;return w.slice(0,14);};
const BUCKETS=[['overdue','Overdue',T.r],['today','Today',T.y],['soon','Next 3 days',T.acc],['nodate','No date',T.tx3]];

// A draggable compact task on a strip day. Same payload as TaskRow, so day -> day works.
function StripTask({m,task}){
  const {start,end}=useDnd();
  return(
    <div draggable onDragStart={e=>{e.stopPropagation();start({type:'task',id:task.id,fromOutputId:task.output_id||null,fileId:task.file_id});}} onDragEnd={()=>end()}
      title={(m.fileById[task.file_id]?.title||'')+' · '+task.title}
      style={{fontSize:sc(9),lineHeight:1.3,color:T.tx2,background:T.s2,border:`1px solid ${T.bd}`,borderRadius:4,padding:'2px 4px',cursor:'grab',
        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
      <b style={{color:T.acc2}}>{abbrev(m.fileById[task.file_id]?.title)}</b> {task.title}
    </div>
  );
}

function StripDay({m,day}){
  const {actions}=useStore();
  const {drag,over,setOver,end}=useDnd();
  const key='day:'+day.iso;
  const isOver=over===key;
  const canDrop=()=>drag.current?.type==='task';
  const onDragOver=(e)=>{ if(canDrop()){e.preventDefault();if(!isOver)setOver(key);} };
  const onDragLeave=()=>{ if(isOver)setOver(null); };
  const onDrop=(e)=>{
    if(drag.current?.type!=='task')return;
    e.preventDefault();
    actions.setDue('tasks',drag.current.id,exactFlex(day.iso));
    setOver(null); end();
  };
  return(
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{display:'flex',flexDirection:'column',gap:2,minHeight:54,padding:4,borderRadius:5,
        border:`1px solid ${isOver?T.acc:(day.isToday?'rgba(91,156,246,0.4)':T.bd)}`,
        background:isOver?'rgba(91,156,246,0.16)':(day.isToday?'rgba(91,156,246,0.05)':T.s1)}}>
      <div style={{fontSize:sc(9),fontWeight:700,color:day.isToday?T.acc:T.tx3,fontFamily:T.mono,letterSpacing:'0.02em'}}>{day.dow} {day.dom}</div>
      {day.tasks.map(t=><StripTask key={t.id} m={m} task={t}/>)}
    </div>
  );
}

function WeekStrip({m,strip}){
  return(
    <div style={{padding:'10px 16px 2px',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
        <span style={{...ss.lbl,marginBottom:0,display:'inline'}}>This week</span>
        <span style={{fontSize:sc(10),color:T.tx3}}>drag a task onto a day to set its date, or between days</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {strip.weeks[0].map(d=><StripDay key={d.iso} m={m} day={d}/>)}
      </div>
      <div style={{display:'flex',alignItems:'baseline',gap:8,margin:'7px 0 4px'}}>
        <span style={{...ss.lbl,marginBottom:0,display:'inline',color:T.tx3}}>Next week</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {strip.weeks[1].map(d=><StripDay key={d.iso} m={m} day={d}/>)}
      </div>
    </div>
  );
}

function FileGroup({m,group}){
  const pri=group.file.priority||'medium';
  return(
    <div style={{marginBottom:9}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
        <PriBar pri={pri}/>
        <span style={{fontSize:sc(11),fontWeight:600,color:T.tx,...wrap2}}>{group.file.title}</span>
        {pri==='urgent'&&<span style={{fontSize:sc(9),fontWeight:700,color:T.r,marginLeft:'auto',flexShrink:0}}>Urgent</span>}
      </div>
      <div style={{border:`1px solid ${T.bd}`,borderRadius:6,overflow:'hidden',background:T.s1}}>
        {group.tasks.map(t=><TaskRow key={t.id} m={m} task={t} showOutput/>)}
      </div>
    </div>
  );
}

function Bucket({m,label,color,groups,count}){
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
        <span style={{fontSize:sc(9),fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color}}>{label}</span>
        <span style={{fontSize:sc(10),color:T.tx3}}>({count})</span>
      </div>
      {groups.length===0?<Empty>Nothing here.</Empty>:groups.map(g=><FileGroup key={g.file.id} m={m} group={g}/>)}
    </div>
  );
}

function Rail({m}){
  const r=todayRail(m);
  const lbl={...ss.lbl,marginBottom:7,marginTop:14};
  const card={background:T.s1,border:`1px solid ${T.bd}`,borderRadius:8,padding:'9px 11px',display:'flex',flexDirection:'column',gap:6};
  const row={display:'flex',alignItems:'center',gap:8,fontSize:sc(11),color:T.tx};
  return(
    <div style={{width:264,flexShrink:0,borderLeft:`1px solid ${T.bd}`,padding:'14px 14px 20px',overflowY:'auto'}}>
      <div style={{...ss.lbl,marginBottom:7}}>Urgent files</div>
      <div style={card}>
        {r.urgentFiles.length===0&&<Empty>None.</Empty>}
        {r.urgentFiles.map(f=>(
          <div key={f.id} style={row}><b style={{fontWeight:600,...wrap2}}>{f.title}</b>
            <span style={{marginLeft:'auto',flexShrink:0,fontSize:sc(10),color:T[staleness(f).tone]||T.tx3}}>{staleness(f).label}</span></div>
        ))}
      </div>

      <div style={lbl}>Open blockers</div>
      <div style={card}>
        {r.openBlockers.length===0&&<Empty>None.</Empty>}
        {r.openBlockers.map(({flag,file})=>(
          <div key={flag.id} style={{...row,alignItems:'flex-start'}}>
            <span style={{color:T.r,flexShrink:0}}>▲</span>
            <span style={{...wrap2}}>{flag.text}{file&&<span style={{color:T.tx3}}> · {file.title}</span>}</span>
          </div>
        ))}
      </div>

      <div style={lbl}>Attention</div>
      <div style={card}>
        <div style={row}><span style={{color:T.y}}>{r.stale.length} files untouched 14+ days</span></div>
        {r.stale.slice(0,4).map(({file,st})=>(
          <div key={file.id} style={{...row,fontSize:sc(10),color:T.tx2}}><span style={{...wrap2}}>{file.title}</span><span style={{marginLeft:'auto',flexShrink:0,color:T.tx3}}>{st.days}d</span></div>
        ))}
      </div>

      <div style={lbl}>Recent activity</div>
      <div style={card}>
        {r.recent.length===0&&<Empty>No recent events.</Empty>}
        {r.recent.map(e=>(
          <div key={e.id} style={{fontSize:sc(10),color:T.tx2,lineHeight:1.4}}>
            <span style={{color:e.actor==='claude'?T.acc:T.acc2,fontWeight:600}}>{e.actor==='claude'?'Claude':'Karl'}</span> {e.summary||e.kind}
            <span style={{color:T.tx3}}> · {rel(e.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayInner(){
  const {model,loading,error}=useStore();
  const [mineOnly,setMineOnly]=useState(true);
  if(error)return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:T.r,fontSize:sc(12),padding:20,textAlign:'center'}}>Could not load Palantír data:<br/>{error}</div>;
  if(!model)return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:T.tx3,fontSize:sc(12)}}>Loading…</div>;

  const buckets=todayBuckets(model,{mineOnly});
  const strip=weekStrip(model,{mineOnly});
  const total=buckets.counts.overdue+buckets.counts.today+buckets.counts.soon+buckets.counts.nodate;
  const todayLabel=new Date().toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'});

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <WeekStrip m={model} strip={strip}/>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',padding:'4px 18px 24px'}}>
          <div style={{border:`1px solid ${T.bd2}`,borderRadius:8,overflow:'hidden',background:T.s1,marginBottom:14}}>
            <Composer mode="task" m={model} pickFile label="Quick add a task…  (e.g. Dorval: call Philippe @wa fri)"/>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:14}}>
            <h2 style={{fontSize:sc(15),fontWeight:700,color:T.tx}}>{todayLabel}</h2>
            <span style={{fontSize:sc(11),color:T.tx3}}>{total} open {mineOnly?'for you':'across files'} · {buckets.counts.overdue} overdue · click rows to multi-select</span>
            <button onClick={()=>setMineOnly(v=>!v)} style={{...ss.btn,fontSize:sc(10),padding:'2px 8px',marginLeft:'auto',
              background:mineOnly?T.acc:'transparent',color:mineOnly?'#fff':T.tx2,border:`1px solid ${mineOnly?T.acc:T.bd}`}}>{mineOnly?'My tasks':'All tasks'}</button>
          </div>
          {BUCKETS.map(([key,label,color])=>(
            <Bucket key={key} m={model} label={label} color={color} groups={buckets[key]} count={buckets.counts[key]}/>
          ))}
        </div>
        <Rail m={model}/>
      </div>
    </div>
  );
}

export default function Today(){
  return <DnDProvider><TodayInner/></DnDProvider>;
}

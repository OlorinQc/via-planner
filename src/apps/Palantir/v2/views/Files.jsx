// Files surface: portfolio list (left) + dossier or portfolio digest (right).
// 5b: one DnD provider spans both panes so a task can be dragged from the open dossier onto
// a file card here to re-file it (one row write: file_id set, output_id cleared).
import React,{useState} from "react";
import { useStore } from "../data/store";
import { T, sc, ss, wrap2, FILE_STATUS, FILE_PRI } from "../theme";
import { Dot, PriBar, Empty } from "../components/primitives";
import { filterFiles, groupByPriority, staleness, portfolio, personFirst } from "../data/derive";
import { DnDProvider, useDnd } from "../components/dnd";
import FilePage from "./FilePage";

const FILTERS=[
  {k:'active_monitoring',label:'Active + Monitoring'},
  {k:'active',label:'Active'},
  {k:'all',label:'All'},
  {k:'archived',label:'Archived'},
];

function FileCard({m,file,selected,onClick}){
  const {actions}=useStore();
  const {drag,over,setOver,end}=useDnd();
  const st=staleness(file);
  const lead=personFirst(m,file.lead_id);
  const isOver=over===('card:'+file.id);
  const canDrop=()=>drag.current?.type==='task'&&drag.current.fileId!==file.id;
  const onDragOver=(e)=>{ if(canDrop()){e.preventDefault();if(!isOver)setOver('card:'+file.id);} };
  const onDragLeave=()=>{ if(isOver)setOver(null); };
  const onDrop=(e)=>{
    if(drag.current?.type!=='task')return;
    e.preventDefault();
    const d=drag.current;
    if(d.fileId!==file.id) actions.moveTask(d.id,{file_id:file.id,output_id:null},'Refiled to '+String(file.title||'file').slice(0,30)+' · saved');
    setOver(null); end();
  };
  return(
    <div onClick={onClick} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{display:'flex',gap:8,alignItems:'stretch',padding:'7px 9px',borderRadius:6,cursor:'pointer',
      background:isOver?'rgba(91,156,246,0.16)':selected?'rgba(91,156,246,0.08)':T.s1,
      border:`1px solid ${isOver?T.acc:(selected?'rgba(91,156,246,0.4)':T.bd)}`,transition:'background .1s'}}>
      <PriBar pri={file.priority||'medium'}/>
      <div style={{flex:1,minWidth:0}}>
        <div title={file.title} style={{fontSize:sc(13),fontWeight:600,color:T.tx,...wrap2}}>{file.title}</div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4,flexWrap:'wrap'}}>
          <Dot map={FILE_STATUS} val={file.status} small/>
          {lead&&<span style={{fontSize:sc(11),color:T.tx2}}>{lead}</span>}
          {st.label&&<span style={{fontSize:sc(10),color:T[st.tone]||T.tx3,marginLeft:'auto'}}>{st.label}</span>}
        </div>
      </div>
    </div>
  );
}

function Stat({label,value,tone}){
  return(
    <div style={{background:T.s1,border:`1px solid ${T.bd}`,borderRadius:8,padding:'10px 12px',minWidth:108}}>
      <div style={{fontSize:sc(20),fontWeight:700,color:tone||T.tx,fontFamily:T.mono,lineHeight:1}}>{value}</div>
      <div style={{fontSize:sc(10),color:T.tx3,marginTop:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</div>
    </div>
  );
}

function PortfolioDigest({m}){
  const p=portfolio(m);
  return(
    <div style={{flex:1,overflowY:'auto',padding:'22px 26px'}}>
      <div style={{fontSize:sc(15),fontWeight:600,color:T.acc2,fontFamily:T.serif,letterSpacing:'0.04em',marginBottom:3}}>Portfolio</div>
      <div style={{fontSize:sc(11),color:T.tx3,marginBottom:16}}>Select a file on the left to open its dossier.</div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:22}}>
        <Stat label="Active files" value={p.activeCount}/>
        <Stat label="Urgent" value={p.urgentCount} tone={p.urgentCount>0?T.r:T.tx}/>
        <Stat label="Open tasks" value={p.openTaskCount}/>
        <Stat label="My overdue" value={p.myOverdueCount} tone={p.myOverdueCount>0?T.y:T.tx}/>
        <Stat label="Stale 30d+" value={p.staleCount} tone={p.staleCount>0?T.y:T.tx}/>
        <Stat label="Open flags" value={p.openFlagCount}/>
      </div>
      <div style={{fontSize:sc(9),fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:8}}>Recent activity</div>
      <div style={{display:'flex',flexDirection:'column',gap:8,maxWidth:620}}>
        {p.recent.length===0&&<Empty>No recent events.</Empty>}
        {p.recent.map(e=>{
          const file=m.fileById[e.file_id];
          const day=e.created_at?new Date(e.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric'}):'';
          return(<div key={e.id} style={{display:'flex',gap:9,fontSize:sc(11),color:T.tx2}}>
            <span style={{color:T.tx3,minWidth:42,flexShrink:0}}>{day}</span>
            <span style={{flex:1,...wrap2,color:T.tx}}>{e.summary||e.kind}</span>
            {file&&<span style={{color:T.tx3,flexShrink:0}}>{file.title}</span>}
          </div>);
        })}
      </div>
    </div>
  );
}

export default function Files(){
  const {model,loading,error}=useStore();
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('active_monitoring');
  const [mineOnly,setMineOnly]=useState(false);
  const [sel,setSel]=useState(null);

  if(error)return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:T.r,fontSize:sc(12),padding:20,textAlign:'center'}}>Could not load Palantír data:<br/>{error}</div>;
  if(!model)return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:T.tx3,fontSize:sc(12)}}>Loading…</div>;

  const filtered=filterFiles(model,{search,filter,mineOnly});
  const groups=groupByPriority(filtered);
  const selFile=sel&&model.fileById[sel]?sel:null;

  return(
    <DnDProvider>
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      {/* List pane */}
      <div style={{width:440,flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden',borderRight:`1px solid ${T.bd}`}}>
        <div style={{padding:'8px 10px',borderBottom:`1px solid ${T.bd}`,background:T.s1,flexShrink:0}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files, tasks, memory, flags…" style={{...ss.inp,marginBottom:6}}/>
          <div style={{display:'flex',gap:3,flexWrap:'wrap',alignItems:'center'}}>
            {FILTERS.map(f=>(
              <button key={f.k} onClick={()=>setFilter(f.k)} style={{...ss.btn,fontSize:sc(10),padding:'2px 7px',
                background:filter===f.k?T.acc:'transparent',color:filter===f.k?'#fff':T.tx2,border:`1px solid ${filter===f.k?T.acc:T.bd}`}}>{f.label}</button>
            ))}
            <button onClick={()=>setMineOnly(v=>!v)} style={{...ss.btn,fontSize:sc(10),padding:'2px 7px',
              background:mineOnly?T.acc:'transparent',color:mineOnly?'#fff':T.tx2,border:`1px solid ${mineOnly?T.acc:T.bd}`}}>Mine</button>
            <span style={{marginLeft:'auto',fontSize:sc(10),color:T.tx3}}>{filtered.length}</span>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:10}}>
          {groups.length===0&&<div style={{textAlign:'center',padding:'30px 10px',color:T.tx3,fontStyle:'italic',fontSize:sc(12)}}>No files match.</div>}
          {groups.map(g=>(
            <div key={g.pri} style={{marginBottom:11}}>
              <div style={{fontSize:sc(9),fontWeight:700,color:FILE_PRI[g.pri]?.tx||T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:5}}>
                {FILE_PRI[g.pri]?.label||g.pri} <span style={{opacity:0.5}}>({g.files.length})</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {g.files.map(f=><FileCard key={f.id} m={model} file={f} selected={sel===f.id} onClick={()=>setSel(sel===f.id?null:f.id)}/>)}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Right pane */}
      {selFile
        ? <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}><FilePage m={model} fileId={selFile}/></div>
        : <PortfolioDigest m={model}/>}
    </div>
    </DnDProvider>
  );
}

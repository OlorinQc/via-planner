// File dossier. 5a: header chips and Memory are editable; Work tree edits via HierarchyList.
// Flags / Links / History stay read-only this slice (their editing is 5b+).
import React,{useState,useRef,useEffect} from "react";
import { T, sc, wrap2, FILE_STATUS, FILE_PRI, SENS, FLAG_KIND } from "../theme";
import { Chip, Dot, FlexChip, PersonChip, Section, Empty } from "../components/primitives";
import { AnchoredPopover } from "../components/overlay";
import PersonPicker from "../components/PersonPicker";
import HierarchyList from "../components/HierarchyList";
import { useStore } from "../data/store";
import { fileTree, fileFlags, fileLinks, fileEvents, personName, personFirst } from "../data/derive";

const EVENT_ICON={log:'🜁',complete:'✓',create:'+',update:'✎',import:'⟳',archive:'▤'};
const fmtDay=(s)=>{if(!s)return null;const d=new Date(s);return isNaN(d)?null:d.toLocaleDateString('en-CA',{month:'short',day:'numeric'});};
const STATUS_OPTS=['active','monitoring','paused','completed'];
const PRI_OPTS=['urgent','high','medium','low'];
const SENS_OPTS=['low','medium','high'];

function Editable({trigger,menu,width}){
  const [el,setEl]=useState(null);
  return(
    <span style={{display:'inline-flex'}}>
      <span onClick={e=>setEl(el?null:e.currentTarget)} title="Click to change" style={{cursor:'pointer'}}>{trigger}</span>
      {el&&<AnchoredPopover anchorEl={el} onClose={()=>setEl(null)} width={width}>{menu(()=>setEl(null))}</AnchoredPopover>}
    </span>
  );
}
function OptionList({options,current,onPick}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:2,minWidth:130}}>
      {options.map(o=>(
        <button key={o.val} onMouseDown={e=>e.preventDefault()} onClick={()=>onPick(o.val)}
          onMouseEnter={e=>e.currentTarget.style.background=T.s2} onMouseLeave={e=>e.currentTarget.style.background=o.val===current?T.s2:'transparent'}
          style={{display:'flex',alignItems:'center',gap:7,fontSize:sc(11),color:o.tx||T.tx,background:o.val===current?T.s2:'transparent',
            border:'none',borderRadius:5,padding:'5px 8px',cursor:'pointer',fontFamily:T.font,textAlign:'left'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:o.tx||T.tx2,display:'inline-block'}}/>{o.label}
        </button>
      ))}
    </div>
  );
}

function Header({m,file}){
  const {actions}=useStore();
  const lead=personName(m,file.lead_id);
  const pri=FILE_PRI[file.priority||'medium'];
  const sens=SENS[file.sensitivity||'low'];
  const set=(patch,word)=>actions.saveFile(file.id,patch,{toast:word+' · saved'});
  return(
    <div style={{marginBottom:12}}>
      <h1 style={{margin:0,fontSize:sc(17),fontWeight:600,color:T.tx,fontFamily:T.font,lineHeight:1.2}}>{file.title}</h1>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:7}}>
        <Editable trigger={<Dot map={FILE_STATUS} val={file.status}/>}
          menu={close=><OptionList current={file.status} options={STATUS_OPTS.map(v=>({val:v,label:FILE_STATUS[v].label,tx:FILE_STATUS[v].tx}))} onPick={v=>{set({status:v},'Status');close();}}/>}/>
        <Editable trigger={<Chip text={pri.label} bg={'rgba(255,255,255,0.03)'} tx={pri.tx} style={{border:`1px solid ${T.bd}`}}/>}
          menu={close=><OptionList current={file.priority} options={PRI_OPTS.map(v=>({val:v,label:FILE_PRI[v].label,tx:FILE_PRI[v].tx}))} onPick={v=>{set({priority:v},'Priority');close();}}/>}/>
        <Editable width={232} trigger={<Chip text={'Lead · '+(lead||'unassigned')} bg={T.s2} tx={T.tx2} style={{border:`1px solid ${T.bd}`}}/>}
          menu={close=><PersonPicker people={m.people} selectedIds={file.lead_id?[file.lead_id]:[]} onPick={pid=>{set({lead_id:pid},'Lead');close();}}/>}/>
        <Editable trigger={<Chip text={'Sensitivity · '+sens.label} bg={T.s2} tx={T.tx2} style={{border:`1px solid ${T.bd}`}}/>}
          menu={close=><OptionList current={file.sensitivity} options={SENS_OPTS.map(v=>({val:v,label:SENS[v].label,tx:SENS[v].tx}))} onPick={v=>{set({sensitivity:v},'Sensitivity');close();}}/>}/>
        <span style={{marginLeft:'auto',fontSize:sc(10),color:T.tx3}}>{fmtDay(file.updated_at)?'updated '+fmtDay(file.updated_at):''}</span>
      </div>
    </div>
  );
}

function EditableMemory({fileId,html}){
  const {actions}=useStore();
  const ref=useRef(null); const focused=useRef(false); const [flash,setFlash]=useState(false);
  useEffect(()=>{ if(ref.current&&!focused.current)ref.current.innerHTML=html||''; },[html,fileId]);
  return(
    <div ref={ref} contentEditable suppressContentEditableWarning
      onFocus={()=>{focused.current=true;}}
      onBlur={()=>{focused.current=false; const v=ref.current.innerHTML; if(v!==(html||'')){actions.saveMemory(fileId,v);setFlash(true);setTimeout(()=>setFlash(false),700);}}}
      style={{fontSize:sc(12),color:T.tx,lineHeight:1.55,outline:'none',minHeight:28,padding:'6px 8px',borderRadius:6,
        border:`1px solid ${flash?T.g:'transparent'}`,background:flash?'rgba(63,182,139,0.06)':'transparent',transition:'border .2s, background .2s'}}/>
  );
}

function Flags({m,fileId}){
  const flags=fileFlags(m,fileId);
  if(flags.length===0)return <Empty>No open flags.</Empty>;
  return(<div style={{display:'flex',flexDirection:'column',gap:6}}>
    {flags.map(f=>{
      const k=FLAG_KIND[f.kind]||FLAG_KIND.question; const owner=personFirst(m,f.owner_id);
      const resolved=f.status==='resolved'||f.status==='dropped';
      return(<div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 2px'}}>
        <Chip text={k.label} bg={k.bg} tx={k.tx}/>
        <span style={{flex:1,...wrap2,fontSize:sc(12),color:resolved?T.tx3:T.tx,textDecoration:resolved?'line-through':'none'}}>{f.text}</span>
        {owner&&<PersonChip name={owner}/>}
        {resolved&&<span style={{fontSize:sc(11),color:T.g}}>✓</span>}
      </div>);
    })}
  </div>);
}

function Links({m,fileId}){
  const links=fileLinks(m,fileId);
  if(links.length===0)return <Empty>No links.</Empty>;
  return(<div style={{display:'flex',flexDirection:'column',gap:6}}>
    {links.map(l=>(
      <div key={l.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 2px'}}>
        <Chip text={(l.type||'link').replace(/_/g,' ')} bg={T.s3} tx={T.tx2} small/>
        <a href={l.url} target="_blank" rel="noreferrer" style={{flex:1,...wrap2,fontSize:sc(12),color:T.acc,textDecoration:'none'}}>{l.label||l.url}</a>
      </div>
    ))}
  </div>);
}

function History({m,fileId}){
  const events=fileEvents(m,fileId);
  if(events.length===0)return <Empty>No history yet.</Empty>;
  return(<div style={{display:'flex',flexDirection:'column',gap:9}}>
    {events.map(e=>{
      const icon=EVENT_ICON[e.kind]||'•';
      const day=fmtDay(e.event_date)||fmtDay(e.created_at);
      const meta=[day,e.kind,e.actor&&('via '+e.actor),e.package_id&&('pkg '+e.package_id)].filter(Boolean).join(' · ');
      return(<div key={e.id} style={{display:'flex',gap:9}}>
        <div style={{fontSize:sc(11),color:e.kind==='complete'?T.g:T.tx3,width:14,textAlign:'center',flexShrink:0,paddingTop:1}}>{icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:sc(12),color:T.tx,lineHeight:1.4}}>{e.summary||'(no summary)'}</div>
          <div style={{fontSize:sc(10),color:T.tx3,marginTop:2}}>{meta}</div>
        </div>
      </div>);
    })}
  </div>);
}

export default function FilePage({m,fileId}){
  const {clearSel}=useStore();
  useEffect(()=>{clearSel();},[fileId,clearSel]);
  const file=m.fileById[fileId];
  if(!file)return <Empty>File not found.</Empty>;
  const tree=fileTree(m,fileId);
  const workBadge=`${tree.outputCount} output${tree.outputCount===1?'':'s'} · ${tree.openTotal} open task${tree.openTotal===1?'':'s'}`;
  return(
    <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>
      <Header m={m} file={file}/>
      <Section title="Memory"><EditableMemory fileId={fileId} html={file.memory}/></Section>
      <Section title="Work" badge={workBadge}><HierarchyList m={m} tree={tree}/></Section>
      <Section title="Flags"><Flags m={m} fileId={fileId}/></Section>
      <Section title="Links"><Links m={m} fileId={fileId}/></Section>
      <Section title="History" badge="events + log"><History m={m} fileId={fileId}/></Section>
      <div style={{height:20}}/>
    </div>
  );
}

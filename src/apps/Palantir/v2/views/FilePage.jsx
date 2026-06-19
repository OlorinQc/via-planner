// File dossier. 5a: header chips and Memory editable; Work tree edits via HierarchyList.
// 5b: Flags resolve + flag composer, paste-first Links add, one-line History log composer.
import React,{useState,useRef,useEffect} from "react";
import { T, sc, ss, wrap2, FILE_STATUS, FILE_PRI, SENS, FLAG_KIND } from "../theme";
import { Chip, Dot, FlexChip, PersonChip, Section, Empty } from "../components/primitives";
import { AnchoredPopover } from "../components/overlay";
import PersonPicker from "../components/PersonPicker";
import HierarchyList from "../components/HierarchyList";
import Composer from "../components/Composer";
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

// Ghost line that expands to a single free-text input (no grammar tokens). For paste-first
// Links and the History prose log, both intentionally token-free.
function InlineAdd({label,placeholder,onSubmit}){
  const [open,setOpen]=useState(false);
  const [v,setV]=useState('');
  const ref=useRef(null);
  const start=()=>{setOpen(true);setTimeout(()=>ref.current&&ref.current.focus(),0);};
  const submit=()=>{const t=v.trim();if(!t)return;onSubmit(t);setV('');setTimeout(()=>ref.current&&ref.current.focus(),0);};
  if(!open)return(
    <div onClick={start} onMouseEnter={e=>e.currentTarget.style.color=T.acc} onMouseLeave={e=>e.currentTarget.style.color=T.tx3}
      style={{fontSize:sc(11),color:T.tx3,cursor:'pointer',padding:'4px 2px',userSelect:'none'}}>{label}</div>
  );
  return(
    <input ref={ref} value={v} onChange={e=>setV(e.target.value)} placeholder={placeholder}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submit();}else if(e.key==='Escape'){setOpen(false);setV('');}}}
      onBlur={()=>{if(!v.trim())setOpen(false);}} style={{...ss.inp,marginTop:2}}/>
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
  const {actions}=useStore();
  const flags=fileFlags(m,fileId);
  return(<div style={{display:'flex',flexDirection:'column',gap:6}}>
    {flags.length===0&&<Empty>No flags yet.</Empty>}
    {flags.map(f=>{
      const k=FLAG_KIND[f.kind]||FLAG_KIND.question; const owner=personFirst(m,f.owner_id);
      const resolved=f.status==='resolved'||f.status==='dropped';
      return(<div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 2px'}}>
        <Chip text={k.label} bg={k.bg} tx={k.tx}/>
        <span style={{flex:1,...wrap2,fontSize:sc(12),color:resolved?T.tx3:T.tx,textDecoration:resolved?'line-through':'none'}}>{f.text}</span>
        {owner&&<PersonChip name={owner}/>}
        <button onClick={()=>actions.resolveFlag(f)} onMouseDown={e=>e.preventDefault()} title={resolved?'Reopen':'Resolve'}
          style={{cursor:'pointer',border:'none',background:'transparent',color:resolved?T.g:T.tx3,fontSize:sc(13),width:16,textAlign:'center',flexShrink:0,fontFamily:T.font}}>{resolved?'✓':'○'}</button>
      </div>);
    })}
    <Composer mode="flag" m={m} fileId={fileId} label="+ flag"/>
  </div>);
}

function inferLinkType(url){
  const u=String(url||'').toLowerCase();
  return (/(:b:|:x:|:w:|:p:|\.aspx|\.pdf|\.docx?|\.pptx?|\.xlsx?)/.test(u))?'file':'folder';
}
function Links({m,fileId}){
  const {actions,showToast}=useStore();
  const links=fileLinks(m,fileId);
  const addLink=(raw)=>{
    const url=raw.split(/\s+/)[0]; const label=raw.slice(url.length).trim();
    if(!/^https?:\/\//i.test(url)){showToast('Paste a full URL (https://…)');return;}
    actions.addLink({file_id:fileId,url,label,type:inferLinkType(url)});
  };
  return(<div style={{display:'flex',flexDirection:'column',gap:6}}>
    {links.length===0&&<Empty>No links.</Empty>}
    {links.map(l=>(
      <div key={l.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 2px'}}>
        <Chip text={(l.type||'link').replace(/_/g,' ')} bg={T.s3} tx={T.tx2} small/>
        <a href={l.url} target="_blank" rel="noreferrer" style={{flex:1,...wrap2,fontSize:sc(12),color:T.acc,textDecoration:'none'}}>{l.label||l.url}</a>
      </div>
    ))}
    <InlineAdd label="+ link" placeholder="Paste a SharePoint URL to attach it… label optional after a space" onSubmit={addLink}/>
  </div>);
}

function History({m,fileId}){
  const {actions}=useStore();
  const events=fileEvents(m,fileId);
  return(<div style={{display:'flex',flexDirection:'column',gap:9}}>
    <InlineAdd label="+ log entry" placeholder="Log what changed… plain prose, Enter to post" onSubmit={(t)=>actions.addLog(fileId,t)}/>
    {events.length===0&&<Empty>No history yet.</Empty>}
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
      <Section title="Work" badge={workBadge}><HierarchyList m={m} tree={tree} fileId={fileId}/></Section>
      <Section title="Flags"><Flags m={m} fileId={fileId}/></Section>
      <Section title="Links"><Links m={m} fileId={fileId}/></Section>
      <Section title="History" badge="events + log"><History m={m} fileId={fileId}/></Section>
      <div style={{height:20}}/>
    </div>
  );
}

// File dossier (read-only). Section order per blueprint 4.1: Memory, Work, Flags, Links, History.
import React from "react";
import { T, sc, wrap2, FILE_STATUS, FILE_PRI, SENS, FLAG_KIND } from "../theme";
import { Chip, Dot, FlexChip, PersonChip, Section, Empty } from "../components/primitives";
import HierarchyList from "../components/HierarchyList";
import { fileTree, fileFlags, fileLinks, fileEvents, personName, personFirst } from "../data/derive";

const EVENT_ICON={log:'🜁',complete:'✓',create:'+',update:'✎',import:'⟳',archive:'▤'};
const fmtDay=(s)=>{if(!s)return null;const d=new Date(s);return isNaN(d)?null:d.toLocaleDateString('en-CA',{month:'short',day:'numeric'});};

function HeaderChips({m,file}){
  const lead=personName(m,file.lead_id);
  const pri=FILE_PRI[file.priority||'medium'];
  const sens=SENS[file.sensitivity||'low'];
  return(
    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:6}}>
      <Dot map={FILE_STATUS} val={file.status}/>
      {pri&&<Chip text={pri.label} bg={'rgba(255,255,255,0.03)'} tx={pri.tx} style={{border:`1px solid ${T.bd}`}}/>}
      {lead&&<Chip text={'Lead · '+lead} bg={T.s2} tx={T.tx2} style={{border:`1px solid ${T.bd}`}}/>}
      {sens&&<Chip text={'Sensitivity · '+sens.label} bg={T.s2} tx={T.tx2} style={{border:`1px solid ${T.bd}`}}/>}
      <span style={{marginLeft:'auto',fontSize:sc(10),color:T.tx3}}>{fmtDay(file.updated_at)?'updated '+fmtDay(file.updated_at):''}</span>
    </div>
  );
}

function Flags({m,fileId}){
  const flags=fileFlags(m,fileId);
  if(flags.length===0)return <Empty>No open flags.</Empty>;
  return(<div style={{display:'flex',flexDirection:'column',gap:6}}>
    {flags.map(f=>{
      const k=FLAG_KIND[f.kind]||FLAG_KIND.question;
      const owner=personFirst(m,f.owner_id);
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
  const file=m.fileById[fileId];
  if(!file)return <Empty>File not found.</Empty>;
  const tree=fileTree(m,fileId);
  const workBadge=`${tree.outputCount} output${tree.outputCount===1?'':'s'} · ${tree.openTotal} open task${tree.openTotal===1?'':'s'}`;
  return(
    <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>
      <div style={{marginBottom:12}}>
        <h1 style={{margin:0,fontSize:sc(17),fontWeight:600,color:T.tx,fontFamily:T.font,lineHeight:1.2}}>{file.title}</h1>
        <HeaderChips m={m} file={file}/>
      </div>

      <Section title="Memory">
        {file.memory&&file.memory.trim()
          ? <div style={{fontSize:sc(12),color:T.tx,lineHeight:1.55}} dangerouslySetInnerHTML={{__html:file.memory}}/>
          : <Empty>No memory recorded.</Empty>}
      </Section>

      <Section title="Work" badge={workBadge}>
        <HierarchyList m={m} tree={tree}/>
      </Section>

      <Section title="Flags"><Flags m={m} fileId={fileId}/></Section>
      <Section title="Links"><Links m={m} fileId={fileId}/></Section>
      <Section title="History" badge="events + log"><History m={m} fileId={fileId}/></Section>

      <div style={{height:20}}/>
    </div>
  );
}

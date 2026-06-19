// Chip composer (blueprint 4.2b). Every capture line: picked or typed values render as
// removable chips, only the title is free text, grammar tokens are the keyboard fast lane
// only (never required, everything reachable by the 📅/@/↳ buttons). Backspace on an empty
// title deletes the last chip; Enter saves and keeps the line open to chain. modes: task,
// output, flag. The History prose composer is intentionally token-free and lives elsewhere.
import React,{useState,useRef} from "react";
import { T, sc, FLAG_KIND } from "../theme";
import { AnchoredPopover, HoverBtn } from "./overlay";
import MiniCalendar from "./MiniCalendar";
import PersonPicker from "./PersonPicker";
import { useStore } from "../data/store";
import { scanLive } from "../data/grammar";
import { fmtFlex } from "../data/flexdate";
import { personFirst } from "../data/derive";

const ROW={display:'flex',alignItems:'center',gap:6,padding:'5px 9px',borderTop:`1px solid ${T.bd}`};

function RmChip({children,bg,tx,onRemove}){
  return(
    <span style={{display:'inline-flex',alignItems:'center',gap:2,fontSize:sc(10),fontWeight:600,padding:'1px 3px 1px 7px',
      borderRadius:10,background:bg,color:tx,whiteSpace:'nowrap',flexShrink:0}}>
      {children}
      <button onMouseDown={e=>e.preventDefault()} onClick={onRemove} title="Remove"
        style={{cursor:'pointer',border:'none',background:'transparent',color:tx,fontSize:sc(12),lineHeight:1,padding:'0 2px',fontFamily:T.font}}>×</button>
    </span>
  );
}

export default function Composer({mode='task',fileId,m,outputs=[],fixedOutputId=null,label,inset=false}){
  const {actions}=useStore();
  const people=m?.people||[];
  const [open,setOpen]=useState(false);
  const [text,setText]=useState('');
  const [asg,setAsg]=useState([]);
  const [due,setDue]=useState(null);
  const [outId,setOutId]=useState(null);
  const [flagKind,setFlagKind]=useState(null);
  const [pop,setPop]=useState(null);            // {type, el}
  const inputRef=useRef(null);
  const popOpen=useRef(false);

  const ctx={people,outputs};
  const outName=(id)=>outputs.find(o=>o.id===id)?.title||'output';
  const reset=()=>{setText('');setAsg([]);setDue(null);setOutId(null);setFlagKind(null);};
  const collapse=()=>{reset();setPop(null);popOpen.current=false;setOpen(false);};
  const focus=()=>setTimeout(()=>inputRef.current&&inputRef.current.focus(),0);
  const start=()=>{setOpen(true);focus();};

  const onChange=(e)=>{
    const r=scanLive(e.target.value,ctx);
    if(r.assigneeIds.length)setAsg(prev=>{const n=[...prev];r.assigneeIds.forEach(id=>{if(!n.includes(id))n.push(id);});return n;});
    if(r.due&&mode!=='flag')setDue(r.due);
    if(r.outputId&&!fixedOutputId)setOutId(r.outputId);
    if(r.flagKind&&mode==='flag')setFlagKind(r.flagKind);
    setText(r.text);
  };

  const submit=()=>{
    const r=scanLive(text+' ',ctx);
    const asgF=[...asg];r.assigneeIds.forEach(id=>{if(!asgF.includes(id))asgF.push(id);});
    const dueF=due||r.due||null;
    const outF=fixedOutputId||outId||r.outputId||null;
    const title=(r.text||'').trim();
    if(!title)return;
    if(mode==='task')actions.addTask({file_id:fileId,output_id:outF,title,assignee_ids:asgF,due:dueF});
    else if(mode==='output')actions.addOutput({file_id:fileId,title,due:dueF});
    else if(mode==='flag')actions.addFlag({file_id:fileId,kind:flagKind||r.flagKind||'question',text:title,owner_id:asgF[0]||null});
    reset();focus();
  };

  const removeLastChip=()=>{
    if(due){setDue(null);return;}
    if(asg.length){setAsg(asg.slice(0,-1));return;}
    if(mode==='flag'&&flagKind){setFlagKind(null);return;}
    if(outId&&!fixedOutputId){setOutId(null);return;}
  };
  const onKey=(e)=>{
    if(e.key==='Enter'){e.preventDefault();submit();}
    else if(e.key==='Escape'){e.preventDefault();collapse();}
    else if(e.key==='Backspace'&&text===''){e.preventDefault();removeLastChip();}
  };
  const onBlur=()=>setTimeout(()=>{
    if(popOpen.current)return;
    const has=text.trim()||asg.length||due||outId||(mode==='flag'&&flagKind);
    if(!has)collapse();
  },150);

  const openPop=(type,el)=>{popOpen.current=true;setPop({type,el});};
  const closePop=()=>{setPop(null);popOpen.current=false;focus();};

  if(!open){
    return(
      <div onClick={start} style={{...ROW,paddingLeft:inset?20:9,color:T.tx3,fontSize:sc(11),cursor:'pointer',userSelect:'none'}}
        onMouseEnter={e=>e.currentTarget.style.color=T.acc} onMouseLeave={e=>e.currentTarget.style.color=T.tx3}>
        {label}
      </div>
    );
  }

  const btn={fontSize:sc(12),padding:'2px 6px',borderRadius:4,lineHeight:1};
  const showOut=mode==='task'&&outputs.length>0&&!fixedOutputId;
  const showAt=mode==='task'||mode==='flag';
  const showDate=mode!=='flag';
  const placeholder=mode==='flag'?'question…  Q: / RISK: / BLOCKED:  ·  @owner'
    :mode==='output'?'output title…  ·  jun 20  ·  m/o jul'
    :'task title…  ·  @name  ·  jun 20  ·  w/o jun 15'+(showOut?'  ·  > output:':'');

  return(
    <div style={{...ROW,paddingLeft:inset?20:9,flexWrap:'wrap',background:'rgba(91,156,246,0.04)'}}>
      {mode==='flag'&&flagKind&&<RmChip bg={(FLAG_KIND[flagKind]||FLAG_KIND.question).bg} tx={(FLAG_KIND[flagKind]||FLAG_KIND.question).tx} onRemove={()=>setFlagKind(null)}>{(FLAG_KIND[flagKind]||FLAG_KIND.question).label}</RmChip>}
      {outId&&!fixedOutputId&&<RmChip bg={'rgba(212,146,42,0.12)'} tx={T.y} onRemove={()=>setOutId(null)}>↳ {outName(outId)}</RmChip>}
      {asg.map(id=><RmChip key={id} bg={'rgba(91,156,246,0.12)'} tx={T.acc} onRemove={()=>setAsg(asg.filter(x=>x!==id))}>{personFirst(m,id)||'?'}</RmChip>)}
      {due&&<RmChip bg={'rgba(91,156,246,0.10)'} tx={T.acc} onRemove={()=>setDue(null)}>{fmtFlex(due)}</RmChip>}
      <input ref={inputRef} value={text} onChange={onChange} onKeyDown={onKey} onBlur={onBlur} placeholder={placeholder}
        style={{flex:1,minWidth:140,background:'transparent',border:'none',outline:'none',color:T.tx,fontSize:sc(12),fontFamily:T.font,padding:'2px 0'}}/>
      <span style={{display:'inline-flex',gap:2,flexShrink:0}}>
        {showDate&&<HoverBtn title="Date" onClick={e=>openPop('date',e.currentTarget)} style={btn} hoverBg={T.s2} hoverColor={T.acc} active={pop?.type==='date'}>📅</HoverBtn>}
        {showAt&&<HoverBtn title={mode==='flag'?'Owner':'Assign'} onClick={e=>openPop('person',e.currentTarget)} style={btn} hoverBg={T.s2} hoverColor={T.acc} active={pop?.type==='person'}>@</HoverBtn>}
        {showOut&&<HoverBtn title="Link to output" onClick={e=>openPop('output',e.currentTarget)} style={btn} hoverBg={T.s2} hoverColor={T.acc} active={pop?.type==='output'}>↳</HoverBtn>}
      </span>
      {pop&&(
        <AnchoredPopover anchorEl={pop.el} onClose={closePop} width={pop.type==='output'?200:undefined}>
          {pop.type==='date'&&<MiniCalendar onPick={f=>{setDue(f);closePop();}}/>}
          {pop.type==='person'&&<PersonPicker people={people} selectedIds={asg} onToggle={id=>setAsg(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}/>}
          {pop.type==='output'&&(
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              {outputs.map(o=>(
                <button key={o.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setOutId(o.id);closePop();}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.s2} onMouseLeave={e=>e.currentTarget.style.background=o.id===outId?T.s2:'transparent'}
                  style={{textAlign:'left',fontSize:sc(11),color:T.tx,background:o.id===outId?T.s2:'transparent',border:'none',borderRadius:5,padding:'5px 8px',cursor:'pointer',fontFamily:T.font}}>↳ {o.title}</button>
              ))}
              {outId&&<button onMouseDown={e=>e.preventDefault()} onClick={()=>{setOutId(null);closePop();}}
                style={{textAlign:'left',fontSize:sc(11),color:T.tx3,background:'transparent',border:'none',borderRadius:5,padding:'5px 8px',cursor:'pointer',fontFamily:T.font}}>No output (file level)</button>}
            </div>
          )}
        </AnchoredPopover>
      )}
    </div>
  );
}

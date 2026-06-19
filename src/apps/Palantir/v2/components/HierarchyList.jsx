// The single file -> output -> task renderer (blueprint 4.3). 5a: rows editable, one renderer.
import React,{useState} from "react";
import { T, sc, wrap2, OUTPUT_STATUS, TASK_STATUS, outputTypeLabel, isTaskDone } from "../theme";
import { Chip, Dot, FlexChip, PersonChip, Empty } from "./primitives";
import { personFirst } from "../data/derive";
import { useStore } from "../data/store";
import HoverPill from "./HoverPill";
import MiniCalendar from "./MiniCalendar";
import PersonPicker from "./PersonPicker";

const MID_STATUS=['in_progress','waiting','blocked'];

function TaskRow({m,task,inset}){
  const {actions,selected,toggleSelect}=useStore();
  const [hov,setHov]=useState(false);
  const done=isTaskDone(task);
  const isSel=selected.has(task.id);
  const names=(task.assignee_ids||[]).map(id=>personFirst(m,id)).filter(Boolean);
  const pills=[
    {key:'date',icon:'📅',title:'Set date',render:(close)=><MiniCalendar onPick={f=>{actions.setDue('tasks',task.id,f);close();}}/>},
    {key:'person',icon:'@',title:'Assign',render:()=>(
      <PersonPicker people={m.people} selectedIds={task.assignee_ids||[]} onToggle={pid=>{
        const cur=task.assignee_ids||[]; const next=cur.includes(pid)?cur.filter(x=>x!==pid):[...cur,pid];
        actions.setAssignees(task.id,next);
      }}/>)},
  ];
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>toggleSelect(task.id)}
      style={{display:'flex',alignItems:'center',gap:7,padding:'5px 9px',position:'relative',cursor:'pointer',
        borderTop:`1px solid ${T.bd}`,paddingLeft:inset?20:9,background:isSel?'rgba(91,156,246,0.10)':'transparent',
        boxShadow:isSel?`inset 2px 0 0 ${T.acc}`:'none'}}>
      <button onClick={e=>{e.stopPropagation();actions.toggleDone(task);}} onMouseDown={e=>e.preventDefault()} title={done?'Reopen':'Complete'}
        style={{cursor:'pointer',border:'none',background:'transparent',color:done?T.g:T.tx3,fontSize:sc(11),width:13,textAlign:'center',flexShrink:0,fontFamily:T.font}}>{done?'✓':'○'}</button>
      <div style={{flex:1,...wrap2,fontSize:sc(12),lineHeight:1.35,color:done?T.tx3:T.tx,textDecoration:done?'line-through':'none'}}>{task.title}</div>
      {MID_STATUS.includes(task.status)&&<Dot map={TASK_STATUS} val={task.status} small/>}
      {names.map((n,i)=><PersonChip key={i} name={n}/>)}
      <FlexChip fd={task.due}/>
      <HoverPill pills={pills} forceShow={hov}/>
    </div>
  );
}

function OutputBox({m,block}){
  const {actions}=useStore();
  const [hov,setHov]=useState(false);
  const o=block.output;
  const owner=personFirst(m,o.owner_id);
  const pills=[
    {key:'date',icon:'📅',title:'Set due',render:(close)=><MiniCalendar onPick={f=>{actions.setDue('outputs',o.id,f);close();}}/>},
    {key:'owner',icon:'@',title:'Owner',render:(close)=><PersonPicker people={m.people} selectedIds={o.owner_id?[o.owner_id]:[]} onPick={pid=>{actions.saveOutput(o.id,{owner_id:pid},{toast:'Owner set · saved'});close();}}/>},
  ];
  return(
    <div style={{border:`1px solid ${T.bd2}`,borderRadius:6,marginBottom:8,overflow:'hidden',background:T.s2}}>
      <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',position:'relative',background:'rgba(255,255,255,0.015)'}}>
        <span style={{fontSize:sc(11),color:T.y,flexShrink:0}}>▣</span>
        <span style={{flex:1,...wrap2,fontSize:sc(12),fontWeight:600,color:T.tx}}>{o.title}</span>
        <Chip text={outputTypeLabel(o.type)} bg={T.s3} tx={T.tx2} small/>
        <Dot map={OUTPUT_STATUS} val={o.status} small/>
        {owner&&<PersonChip name={owner}/>}
        <FlexChip fd={o.due}/>
        <HoverPill pills={pills} forceShow={hov}/>
      </div>
      {block.open.length>0
        ? block.open.map(t=><TaskRow key={t.id} m={m} task={t} inset/>)
        : <div style={{padding:'5px 9px',borderTop:`1px solid ${T.bd}`}}><Empty>No open tasks.</Empty></div>}
    </div>
  );
}

function DoneCollapsible({m,tasks}){
  const [open,setOpen]=useState(false);
  if(tasks.length===0)return null;
  return(
    <div style={{marginTop:6}}>
      <div onClick={()=>setOpen(o=>!o)} style={{fontSize:sc(10),color:T.tx3,cursor:'pointer',userSelect:'none',padding:'3px 2px'}}>
        {open?'▾':'▸'} Completed ({tasks.length})
      </div>
      {open&&<div style={{border:`1px solid ${T.bd}`,borderRadius:6,marginTop:4,overflow:'hidden'}}>
        {tasks.map(t=><TaskRow key={t.id} m={m} task={t}/>)}
      </div>}
    </div>
  );
}

export default function HierarchyList({m,tree}){
  const allDone=[...tree.outBlocks.flatMap(b=>b.done),...tree.fileDone];
  const nothing=tree.outBlocks.length===0&&tree.fileOpen.length===0&&allDone.length===0;
  if(nothing)return <Empty>No outputs or tasks yet.</Empty>;
  return(
    <div>
      {tree.outBlocks.map(b=><OutputBox key={b.output.id} m={m} block={b}/>)}
      {tree.fileOpen.length>0&&
        <div style={{border:`1px solid ${T.bd}`,borderRadius:6,overflow:'hidden',background:T.s1}}>
          {tree.fileOpen.map(t=><TaskRow key={t.id} m={m} task={t}/>)}
        </div>}
      <DoneCollapsible m={m} tasks={allDone}/>
    </div>
  );
}

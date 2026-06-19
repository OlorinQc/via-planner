// Shared task row (blueprint 4.3, single renderer): the identical row on the dossier and on
// Today. status = dot, person = chip, date = chip; floating hover pill (date / assign /
// relink); click to select; draggable with the task payload so it can drop onto an output
// list, a file card (refile), or a week-strip day (set date). showOutput prefixes the linked
// output title (used on Today, where rows are grouped by file rather than nested under outputs).
import React,{useState} from "react";
import { T, sc, wrap2, TASK_STATUS, isTaskDone } from "../theme";
import { Dot, FlexChip, PersonChip } from "./primitives";
import { personFirst } from "../data/derive";
import { useStore } from "../data/store";
import HoverPill from "./HoverPill";
import MiniCalendar from "./MiniCalendar";
import PersonPicker from "./PersonPicker";
import { useDnd } from "./dnd";

const MID_STATUS=['in_progress','waiting','blocked'];

export function OutputLinkMenu({task,outputs,close}){
  const {actions}=useStore();
  return(
    <div style={{display:'flex',flexDirection:'column',gap:2,minWidth:170}}>
      {outputs.map(o=>(
        <button key={o.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{actions.moveTask(task.id,{output_id:o.id},'Linked to output · saved');close();}}
          onMouseEnter={e=>e.currentTarget.style.background=T.s2} onMouseLeave={e=>e.currentTarget.style.background=o.id===task.output_id?T.s2:'transparent'}
          style={{display:'flex',gap:6,fontSize:sc(11),color:T.tx,textAlign:'left',background:o.id===task.output_id?T.s2:'transparent',border:'none',borderRadius:5,padding:'5px 8px',cursor:'pointer',fontFamily:T.font}}>↳ {o.title}</button>
      ))}
      {task.output_id&&<button onMouseDown={e=>e.preventDefault()} onClick={()=>{actions.moveTask(task.id,{output_id:null},'Removed from output · saved');close();}}
        style={{fontSize:sc(11),color:T.tx3,textAlign:'left',background:'transparent',border:'none',borderRadius:5,padding:'5px 8px',cursor:'pointer',fontFamily:T.font}}>Remove from output</button>}
    </div>
  );
}

export default function TaskRow({m,task,inset,showOutput=false}){
  const {actions,selected,toggleSelect}=useStore();
  const {start,end}=useDnd();
  const [hov,setHov]=useState(false);
  const done=isTaskDone(task);
  const isSel=selected.has(task.id);
  const names=(task.assignee_ids||[]).map(id=>personFirst(m,id)).filter(Boolean);
  const fileOutputs=m.outputsByFile[task.file_id]||[];
  const outName=showOutput&&task.output_id?(m.outputById[task.output_id]?.title||null):null;
  const pills=[
    {key:'date',icon:'📅',title:'Set date',render:(close)=><MiniCalendar onPick={f=>{actions.setDue('tasks',task.id,f);close();}}/>},
    {key:'person',icon:'@',title:'Assign',render:()=>(
      <PersonPicker people={m.people} selectedIds={task.assignee_ids||[]} onToggle={pid=>{
        const cur=task.assignee_ids||[]; const next=cur.includes(pid)?cur.filter(x=>x!==pid):[...cur,pid];
        actions.setAssignees(task.id,next);
      }}/>)},
  ];
  if(fileOutputs.length>0) pills.push({key:'output',icon:'↳',title:'Link to output',render:(close)=><OutputLinkMenu task={task} outputs={fileOutputs} close={close}/>});
  return(
    <div data-row draggable
      onDragStart={e=>{e.stopPropagation();start({type:'task',id:task.id,fromOutputId:task.output_id||null,fileId:task.file_id});}}
      onDragEnd={()=>end()}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>toggleSelect(task.id)}
      style={{display:'flex',alignItems:'center',gap:7,padding:'5px 9px',position:'relative',cursor:'pointer',
        borderTop:`1px solid ${T.bd}`,paddingLeft:inset?20:9,background:isSel?'rgba(91,156,246,0.10)':'transparent',
        boxShadow:isSel?`inset 2px 0 0 ${T.acc}`:'none'}}>
      <button onClick={e=>{e.stopPropagation();actions.toggleDone(task);}} onMouseDown={e=>e.preventDefault()} title={done?'Reopen':'Complete'}
        style={{cursor:'pointer',border:'none',background:'transparent',color:done?T.g:T.tx3,fontSize:sc(11),width:13,textAlign:'center',flexShrink:0,fontFamily:T.font}}>{done?'✓':'○'}</button>
      <div style={{flex:1,...wrap2,fontSize:sc(12),lineHeight:1.35,color:done?T.tx3:T.tx,textDecoration:done?'line-through':'none'}}>
        {outName&&<span style={{color:T.y,fontWeight:600,marginRight:6}}>↳ {outName}</span>}
        {task.title}
      </div>
      {MID_STATUS.includes(task.status)&&<Dot map={TASK_STATUS} val={task.status} small/>}
      {names.map((n,i)=><PersonChip key={i} name={n}/>)}
      <FlexChip fd={task.due}/>
      <HoverPill pills={pills} forceShow={hov}/>
    </div>
  );
}

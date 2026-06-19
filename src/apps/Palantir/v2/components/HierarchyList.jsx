// The single file -> output -> task renderer (blueprint 4.3: no other component renders this tree).
// Read-only this session. Each row reserves a right-edge slot for the Session 5 hover pill.
import React,{useState} from "react";
import { T, sc, wrap2, OUTPUT_STATUS, TASK_STATUS, outputTypeLabel } from "../theme";
import { Chip, Dot, FlexChip, PersonChip, Empty } from "./primitives";
import { personFirst } from "../data/derive";
import { isTaskDone } from "../theme";

const MID_STATUS=['in_progress','waiting','blocked'];

function TaskRow({m,task,inset}){
  const done=isTaskDone(task);
  const names=(task.assignee_ids||[]).map(id=>personFirst(m,id)).filter(Boolean);
  return(
    <div style={{display:'flex',alignItems:'center',gap:7,padding:'5px 9px',position:'relative',
      borderTop:`1px solid ${T.bd}`,paddingLeft:inset?20:9}}>
      <span style={{fontSize:sc(11),color:done?T.g:T.tx3,flexShrink:0,width:11,textAlign:'center'}}>{done?'✓':'○'}</span>
      <div style={{flex:1,...wrap2,fontSize:sc(12),lineHeight:1.35,
        color:done?T.tx3:T.tx,textDecoration:done?'line-through':'none'}}>{task.title}</div>
      {MID_STATUS.includes(task.status)&&<Dot map={TASK_STATUS} val={task.status} small/>}
      {names.map((n,i)=><PersonChip key={i} name={n}/>)}
      <FlexChip fd={task.due}/>
      {/* Session 5: hover pill (date / person / output) mounts here, zero content shift */}
    </div>
  );
}

function OutputBox({m,block}){
  const o=block.output;
  const owner=personFirst(m,o.owner_id);
  return(
    <div style={{border:`1px solid ${T.bd2}`,borderRadius:6,marginBottom:8,overflow:'hidden',background:T.s2}}>
      <div style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',background:'rgba(255,255,255,0.015)'}}>
        <span style={{fontSize:sc(11),color:T.y,flexShrink:0}}>▣</span>
        <span style={{flex:1,...wrap2,fontSize:sc(12),fontWeight:600,color:T.tx}}>{o.title}</span>
        <Chip text={outputTypeLabel(o.type)} bg={T.s3} tx={T.tx2} small/>
        <Dot map={OUTPUT_STATUS} val={o.status} small/>
        {owner&&<PersonChip name={owner}/>}
        <FlexChip fd={o.due}/>
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

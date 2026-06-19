// The single file -> output -> task renderer (blueprint 4.3). One renderer, all edits.
// The task row itself lives in TaskRow.jsx (shared with Today). This file owns the dossier
// tree: output boxes, the droppable task lists, output-header reorder, ghost composers, and
// the completed collapsible. Every drop is a single row write through the store.
import React,{useState,useRef} from "react";
import { T, sc, wrap2, OUTPUT_STATUS, outputTypeLabel } from "../theme";
import { Chip, Dot, FlexChip, PersonChip } from "./primitives";
import { personFirst } from "../data/derive";
import { useStore } from "../data/store";
import HoverPill from "./HoverPill";
import MiniCalendar from "./MiniCalendar";
import PersonPicker from "./PersonPicker";
import Composer from "./Composer";
import TaskRow from "./TaskRow";
import { useDnd, midOrder, insertionIndex } from "./dnd";

const DropLine=()=> <div style={{height:2,background:T.acc,borderRadius:2,margin:'1px 9px'}}/>;

// Droppable group of tasks: reorder within, or move a task in from another group (output_id
// flips). One row write per drop via midOrder.
function TaskDropList({m,tasks,outputId,fileId,inset}){
  const {actions}=useStore();
  const {drag,end}=useDnd();
  const ref=useRef(null);
  const [idx,setIdx]=useState(-1);
  const onDragOver=(e)=>{ if(drag.current?.type!=='task')return; e.preventDefault(); setIdx(insertionIndex(ref.current,e.clientY)); };
  const onDragLeave=(e)=>{ if(ref.current&&!ref.current.contains(e.relatedTarget))setIdx(-1); };
  const onDrop=(e)=>{
    if(drag.current?.type!=='task')return;
    e.preventDefault(); e.stopPropagation();
    const d=drag.current;
    const list=tasks.filter(t=>t.id!==d.id);
    const at=idx<0?list.length:Math.min(idx,list.length);
    const so=midOrder(list,at);
    const moved=(d.fromOutputId||null)!==(outputId||null);
    const patch=moved?{output_id:outputId||null,sort_order:so}:{sort_order:so};
    actions.moveTask(d.id,patch,moved?(outputId?'Moved into output · saved':'Moved out of output · saved'):'Reordered · saved');
    setIdx(-1); end();
  };
  return(
    <div ref={ref} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{minHeight:tasks.length?undefined:8}}>
      {tasks.map((t,i)=><React.Fragment key={t.id}>{idx===i&&<DropLine/>}<TaskRow m={m} task={t} inset={inset}/></React.Fragment>)}
      {idx>=tasks.length&&<DropLine/>}
    </div>
  );
}

function OutputBox({m,block}){
  const {actions}=useStore();
  const {start,end}=useDnd();
  const [hov,setHov]=useState(false);
  const o=block.output;
  const owner=personFirst(m,o.owner_id);
  const pills=[
    {key:'date',icon:'📅',title:'Set due',render:(close)=><MiniCalendar onPick={f=>{actions.setDue('outputs',o.id,f);close();}}/>},
    {key:'owner',icon:'@',title:'Owner',render:(close)=><PersonPicker people={m.people} selectedIds={o.owner_id?[o.owner_id]:[]} onPick={pid=>{actions.saveOutput(o.id,{owner_id:pid},{toast:'Owner set · saved'});close();}}/>},
  ];
  return(
    <div data-row style={{border:`1px solid ${T.bd2}`,borderRadius:6,marginBottom:8,overflow:'hidden',background:T.s2}}>
      <div draggable onDragStart={e=>{e.stopPropagation();start({type:'output',id:o.id,fileId:o.file_id});}} onDragEnd={()=>end()}
        onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',position:'relative',background:'rgba(255,255,255,0.015)',cursor:'grab'}}>
        <span style={{fontSize:sc(11),color:T.y,flexShrink:0}}>▣</span>
        <span style={{flex:1,...wrap2,fontSize:sc(12),fontWeight:600,color:T.tx}}>{o.title}</span>
        <Chip text={outputTypeLabel(o.type)} bg={T.s3} tx={T.tx2} small/>
        <Dot map={OUTPUT_STATUS} val={o.status} small/>
        {owner&&<PersonChip name={owner}/>}
        <FlexChip fd={o.due}/>
        <HoverPill pills={pills} forceShow={hov}/>
      </div>
      <TaskDropList m={m} tasks={block.open} outputId={o.id} fileId={o.file_id} inset/>
      <Composer mode="task" m={m} fileId={o.file_id} fixedOutputId={o.id} label="+ task in this output" inset/>
    </div>
  );
}

// Droppable list of outputs: header drag reorders them (one row write).
function OutputDropList({m,blocks}){
  const {actions}=useStore();
  const {drag,end}=useDnd();
  const ref=useRef(null);
  const [idx,setIdx]=useState(-1);
  const outputs=blocks.map(b=>b.output);
  const onDragOver=(e)=>{ if(drag.current?.type!=='output')return; e.preventDefault(); setIdx(insertionIndex(ref.current,e.clientY)); };
  const onDragLeave=(e)=>{ if(ref.current&&!ref.current.contains(e.relatedTarget))setIdx(-1); };
  const onDrop=(e)=>{
    if(drag.current?.type!=='output')return;
    e.preventDefault();
    const d=drag.current;
    const list=outputs.filter(o=>o.id!==d.id);
    const at=idx<0?list.length:Math.min(idx,list.length);
    actions.saveOutput(d.id,{sort_order:midOrder(list,at)},{toast:'Output reordered · saved'});
    setIdx(-1); end();
  };
  return(
    <div ref={ref} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {blocks.map((b,i)=><React.Fragment key={b.output.id}>{idx===i&&<DropLine/>}<OutputBox m={m} block={b}/></React.Fragment>)}
      {idx>=blocks.length&&blocks.length>0&&<DropLine/>}
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

export default function HierarchyList({m,tree,fileId}){
  const fileOutputs=tree.outBlocks.map(b=>b.output);
  const allDone=[...tree.outBlocks.flatMap(b=>b.done),...tree.fileDone];
  return(
    <div>
      {tree.outBlocks.length>0&&<OutputDropList m={m} blocks={tree.outBlocks}/>}
      <div style={{border:`1px solid ${T.bd}`,borderRadius:6,overflow:'hidden',background:T.s1,marginTop:tree.outBlocks.length?8:0}}>
        <TaskDropList m={m} tasks={tree.fileOpen} outputId={null} fileId={fileId}/>
        <Composer mode="task" m={m} fileId={fileId} outputs={fileOutputs} label="+ task on this file"/>
      </div>
      <div style={{marginTop:8,border:`1px solid ${T.bd}`,borderRadius:6,overflow:'hidden',background:T.s1}}>
        <Composer mode="output" m={m} fileId={fileId} label="+ output"/>
      </div>
      <DoneCollapsible m={m} tasks={allDone}/>
    </div>
  );
}

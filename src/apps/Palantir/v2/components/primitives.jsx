// Shared display primitives (read-only). 4.2b visual rule: status = dot, priority = bar, date = chip.
import React from "react";
import { T, sc } from "../theme";
import { fmtFlex, flexDueState } from "../data/flexdate";
import { DUE, TASK_STATUS, FILE_PRI } from "../theme";

export const Chip=({text,bg,tx,small,title,style})=>(
  <span title={title} style={{fontSize:sc(small?9:10),fontWeight:600,padding:small?'1px 5px':'2px 8px',borderRadius:10,
    background:bg,color:tx,whiteSpace:'nowrap',display:'inline-block',fontFamily:T.font,flexShrink:0,...style}}>{text}</span>
);

export const Badge=({children})=>(
  <span style={{fontSize:sc(9),fontWeight:600,color:T.tx3,background:T.s2,border:`1px solid ${T.bd}`,
    borderRadius:8,padding:'1px 6px',whiteSpace:'nowrap',flexShrink:0}}>{children}</span>
);

// Status dot chip from a {bg,tx,label} map.
export const Dot=({map,val,small})=>{
  const c=map?.[val];if(!c)return null;
  return(<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:sc(small?9:10),fontWeight:600,
    padding:small?'1px 6px':'2px 7px',borderRadius:10,background:c.bg,color:c.tx,whiteSpace:'nowrap',flexShrink:0}}>
    <span style={{width:5,height:5,borderRadius:'50%',background:c.tx,display:'inline-block',flexShrink:0}}/>{c.label}</span>);
};

// Priority as a vertical bar (stretches to row height).
export const PriBar=({pri})=>{
  const c=FILE_PRI[pri]||FILE_PRI.medium;
  return <span title={c.label} style={{width:3,alignSelf:'stretch',borderRadius:2,background:c.tx,flexShrink:0,opacity:0.9}}/>;
};

// Date as a chip, coloured by due state.
export const FlexChip=({fd,small=true})=>{
  if(!fd)return null;
  const label=fmtFlex(fd);if(!label)return null;
  const st=flexDueState(fd);const c=st?DUE[st]:null;
  const style=c?{bg:c.bg,tx:c.tx}:{bg:'rgba(62,74,90,0.18)',tx:T.tx2};
  return <Chip text={label} bg={style.bg} tx={style.tx} small={small}/>;
};

export const PersonChip=({name,small=true})=>{
  if(!name)return null;
  return <Chip text={name} bg={'rgba(91,156,246,0.12)'} tx={T.acc} small={small}/>;
};

export const TaskStatusChip=({status,small})=> <Dot map={TASK_STATUS} val={status} small={small}/>;

// File-page section shell.
export const Section=({title,badge,right,children})=>(
  <div style={{border:`1px solid ${T.bd}`,borderRadius:8,background:T.s1,marginBottom:10,overflow:'hidden'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 11px',borderBottom:`1px solid ${T.bd}`,background:T.hdr}}>
      <span style={{fontSize:sc(11),fontWeight:700,color:T.acc2,letterSpacing:'0.04em'}}>{title}</span>
      {badge!=null&&<Badge>{badge}</Badge>}
      {right&&<span style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6}}>{right}</span>}
    </div>
    <div style={{padding:'10px 11px'}}>{children}</div>
  </div>
);

export const Empty=({children})=>(
  <div style={{fontSize:sc(11),color:T.tx3,fontStyle:'italic',padding:'4px 2px'}}>{children}</div>
);

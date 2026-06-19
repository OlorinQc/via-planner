// One selection model, one batch bar (blueprint 4.2b): date / reassign / done / clear.
import React,{useState} from "react";
import { useStore } from "../data/store";
import { T, sc } from "../theme";
import { AnchoredPopover } from "./overlay";
import MiniCalendar from "./MiniCalendar";
import PersonPicker from "./PersonPicker";

export default function BatchBar(){
  const {selected,clearSel,actions,model}=useStore();
  const [pop,setPop]=useState(null); // {key, el}
  const ids=[...(selected||[])];
  if(ids.length===0||!model)return null;
  const btn={fontSize:sc(11),fontWeight:600,border:`1px solid ${T.bd2}`,background:T.s2,color:T.tx2,borderRadius:5,padding:'4px 11px',cursor:'pointer',fontFamily:T.font};
  const openPop=(key)=>(e)=>{e.stopPropagation();setPop({key,el:e.currentTarget});};
  return(
    <div style={{position:'fixed',bottom:48,left:'50%',transform:'translateX(-50%)',background:T.s3,border:`1px solid ${T.acc}`,borderRadius:9,
      padding:'8px 13px',display:'flex',gap:7,alignItems:'center',zIndex:115,boxShadow:'0 8px 30px rgba(0,0,0,0.5)'}}>
      <span style={{fontSize:sc(11),fontWeight:700,color:T.acc,marginRight:3}}>{ids.length} selected</span>
      <button onMouseDown={e=>e.preventDefault()} onClick={openPop('date')} style={btn}>📅 Date</button>
      <button onMouseDown={e=>e.preventDefault()} onClick={openPop('person')} style={btn}>@ Assign</button>
      <button onMouseDown={e=>e.preventDefault()} onClick={()=>actions.batchDone(ids)} style={btn}>✓ Done</button>
      <button onMouseDown={e=>e.preventDefault()} onClick={()=>clearSel()} style={{...btn,border:'none',background:'transparent',color:T.tx3}}>Clear</button>
      {pop?.key==='date'&&(
        <AnchoredPopover anchorEl={pop.el} onClose={()=>setPop(null)}>
          <MiniCalendar onPick={(flex)=>{actions.batchDue(ids,flex);setPop(null);}}/>
        </AnchoredPopover>
      )}
      {pop?.key==='person'&&(
        <AnchoredPopover anchorEl={pop.el} onClose={()=>setPop(null)}>
          <PersonPicker people={model.people} onPick={(pid)=>{actions.batchAssign(ids,pid);setPop(null);}}/>
        </AnchoredPopover>
      )}
    </div>
  );
}

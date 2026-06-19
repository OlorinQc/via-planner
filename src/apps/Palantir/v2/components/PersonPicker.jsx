// Initials strip for assigning / reassigning. Multi-toggle (onToggle) or single (onPick).
import React from "react";
import { T, sc } from "../theme";

const initials=(name)=>name?name.split(/[\s-]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase():'?';

export default function PersonPicker({people,selectedIds=[],onToggle,onPick}){
  const sel=new Set(selectedIds);
  const sorted=[...people].sort((a,b)=>(Number(b.active)-Number(a.active))||(a.name||'').localeCompare(b.name||''));
  return(
    <div style={{display:'flex',flexWrap:'wrap',gap:4,maxWidth:232}}>
      {sorted.map(p=>{
        const on=sel.has(p.id);
        return(
          <button key={p.id} title={p.name+(p.active?'':' (inactive)')} onMouseDown={e=>e.preventDefault()}
            onClick={()=>{onToggle?onToggle(p.id):onPick&&onPick(p.id);}}
            onMouseEnter={e=>{if(!on)e.currentTarget.style.borderColor=T.acc;}}
            onMouseLeave={e=>{if(!on)e.currentTarget.style.borderColor=T.bd2;}}
            style={{minWidth:30,height:26,padding:'0 6px',borderRadius:5,fontSize:sc(10),fontWeight:700,cursor:'pointer',fontFamily:T.font,
              border:`1px solid ${on?T.acc:T.bd2}`,background:on?'rgba(91,156,246,0.16)':T.s2,color:on?T.acc:(p.active?T.tx2:T.tx3)}}>
            {initials(p.name)}
          </button>
        );
      })}
    </div>
  );
}

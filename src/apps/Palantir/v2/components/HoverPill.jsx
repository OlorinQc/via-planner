// Floating affordance pill (blueprint 4.2b): one pill on row hover, overlays the right edge,
// no content shift. Buttons open anchored popovers. visible = parent hover OR a popover open.
import React,{useState} from "react";
import { T, sc } from "../theme";
import { HoverBtn, AnchoredPopover } from "./overlay";

export default function HoverPill({pills,forceShow}){
  const [open,setOpen]=useState(null); // {key, el}
  const visible=forceShow||!!open;
  return(
    <span onClick={e=>e.stopPropagation()} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
      display:visible?'flex':'none',gap:3,background:T.s3,border:`1px solid ${T.bd2}`,borderRadius:7,padding:'3px 4px',
      boxShadow:'0 4px 14px rgba(0,0,0,0.45)',zIndex:8}}>
      {pills.map(p=>(
        <HoverBtn key={p.key} title={p.title} onClick={e=>{e.stopPropagation();setOpen({key:p.key,el:e.currentTarget});}}
          style={{fontSize:sc(12),padding:'2px 6px',borderRadius:4,lineHeight:1}} hoverBg={T.s2} hoverColor={T.acc} active={open?.key===p.key}>
          {p.icon}
        </HoverBtn>
      ))}
      {open&&(
        <AnchoredPopover anchorEl={open.el} onClose={()=>setOpen(null)}>
          {pills.find(p=>p.key===open.key)?.render(()=>setOpen(null))}
        </AnchoredPopover>
      )}
    </span>
  );
}

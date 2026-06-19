// Anchored popover + hover button. Inline-style world: hover handled in JS, no className.
import React,{useRef,useState,useEffect,useLayoutEffect} from "react";
import { T } from "../theme";

export function HoverBtn({title,onClick,children,style,hoverBg=T.acc,hoverColor='#fff',baseBg='transparent',baseColor=T.tx2,active=false}){
  const [h,setH]=useState(false);
  const on=h||active;
  return(
    <button title={title} onMouseDown={e=>e.preventDefault()} onClick={onClick}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{cursor:'pointer',fontFamily:T.font,border:'none',background:on?hoverBg:baseBg,color:on?hoverColor:baseColor,...style}}>
      {children}
    </button>
  );
}

// Floating popover anchored under (or above) a DOM element. Click-outside / Esc to close.
export function AnchoredPopover({anchorEl,onClose,children,width}){
  const ref=useRef(null);
  const [pos,setPos]=useState(null);
  useLayoutEffect(()=>{
    if(!anchorEl||!ref.current)return;
    const a=anchorEl.getBoundingClientRect();
    const el=ref.current;
    let left=Math.min(a.left,window.innerWidth-el.offsetWidth-12);
    let top=a.bottom+6;
    if(top+el.offsetHeight>window.innerHeight-10)top=a.top-el.offsetHeight-6;
    setPos({left:Math.max(8,left),top:Math.max(8,top)});
  },[anchorEl]);
  useEffect(()=>{
    const onDown=e=>{ if(ref.current&&!ref.current.contains(e.target)&&!(anchorEl&&anchorEl.contains(e.target)))onClose(); };
    const onKey=e=>{ if(e.key==='Escape'){e.stopPropagation();onClose();} };
    document.addEventListener('mousedown',onDown);
    document.addEventListener('keydown',onKey,true);
    return ()=>{document.removeEventListener('mousedown',onDown);document.removeEventListener('keydown',onKey,true);};
  },[anchorEl,onClose]);
  return(
    <div ref={ref} style={{position:'fixed',left:pos?pos.left:-9999,top:pos?pos.top:-9999,zIndex:90,width,
      background:T.s1,border:`1px solid ${T.bd2}`,borderRadius:9,boxShadow:'0 16px 48px rgba(0,0,0,0.6)',padding:10}}>
      {children}
    </div>
  );
}

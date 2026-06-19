// Drag context (blueprint 4.2b: "drag wherever a hierarchy exists; all drops are one row
// write"). One provider spans the Files list and the open file page so a task can be dragged
// from the dossier onto a file card to re-file. The dragged payload lives in a ref (no
// re-render on dragover); only the hovered drop zone re-renders to show an indicator.
import React,{createContext,useContext,useRef,useState,useCallback} from "react";

const Ctx=createContext(null);
export const useDnd=()=>useContext(Ctx);

export function DnDProvider({children}){
  const drag=useRef(null);                 // {type:'task'|'output', id, fromOutputId, fileId}
  const [over,setOver]=useState(null);     // highlight key for the active drop zone
  const start=useCallback((payload)=>{drag.current=payload;},[]);
  const end=useCallback(()=>{drag.current=null;setOver(null);},[]);
  const value={drag,over,setOver,start,end};
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Single-row fractional sort_order: drop between the neighbours at insertion index idx.
export function midOrder(list,idx){
  const before=list[idx-1], after=list[idx];
  const bo=before?(before.sort_order||0):null, ao=after?(after.sort_order||0):null;
  if(bo==null&&ao==null)return 0;
  if(bo==null)return ao-1;
  if(ao==null)return bo+1;
  return (bo+ao)/2;
}

// Insertion index from the pointer Y against a zone's row rects (rows carry data-row).
export function insertionIndex(container,clientY){
  const rows=[...container.querySelectorAll(':scope > [data-row]')];
  for(let k=0;k<rows.length;k++){
    const r=rows[k].getBoundingClientRect();
    if(clientY<r.top+r.height/2)return k;
  }
  return rows.length;
}

export const DropLine=()=> <div data-dropline style={{height:2,background:'var(--pal-acc,#5b9cf6)',borderRadius:2,margin:'1px 9px'}}/>;

// Undo-on-toast host (blueprint 4.2b): act now, offer Undo for 8s. Replaces window.confirm.
import React from "react";
import { useStore } from "../data/store";
import { T, sc } from "../theme";

export default function ToastHost(){
  const {toasts,dismiss}=useStore();
  if(!toasts||!toasts.length)return null;
  return(
    <div style={{position:'fixed',bottom:92,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',gap:6,zIndex:120,alignItems:'center'}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:T.s3,border:`1px solid ${T.bd2}`,borderRadius:8,padding:'7px 12px',display:'flex',alignItems:'center',gap:12,
          boxShadow:'0 8px 30px rgba(0,0,0,0.5)',fontSize:sc(11),color:T.tx,fontFamily:T.font}}>
          <span>{t.msg}</span>
          {t.undo&&(
            <button onClick={()=>{t.undo();dismiss(t.id);}} onMouseDown={e=>e.preventDefault()}
              style={{fontSize:sc(11),fontWeight:700,color:T.acc,background:'transparent',border:`1px solid ${T.acc}`,borderRadius:5,padding:'2px 9px',cursor:'pointer',fontFamily:T.font}}>Undo</button>
          )}
        </div>
      ))}
    </div>
  );
}

// Palantír 2.0 shell: frame + surface switch (Today default, Files, Activity), editable, at
// /palantir2. Today and Activity ship in Session 6; Team lands in Session 7. Internal view
// state for now; real URL sub-routes are the Session 8 sweep.
import React,{useEffect,useState} from "react";
import { useNavigate } from "react-router-dom";
import { StoreProvider, useStore } from "./data/store";
import { T, sc, ss, SCALE_VAR, FONT_LINK } from "./theme";
import Today from "./views/Today";
import Files from "./views/Files";
import Activity from "./views/Activity";
import ToastHost from "./components/Toasts";
import BatchBar from "./components/BatchBar";

const NAV=[{id:'today',label:'Today',on:true},{id:'files',label:'Files',on:true},{id:'team',label:'Team'},{id:'activity',label:'Activity',on:true}];

function readScale(){try{const v=parseFloat(localStorage.getItem('pal2-scale'));return v>=0.7&&v<=1.6?v:1.0;}catch(e){return 1.0;}}
function readView(){try{const v=localStorage.getItem('pal2-view');return ['today','files','activity'].includes(v)?v:'today';}catch(e){return 'today';}}

function Shell(){
  const navigate=useNavigate();
  const {live,lastSync,reload,loading,saving,clearSel}=useStore();
  const [scale,setScale]=useState(readScale);
  const [view,setView]=useState(readView);

  useEffect(()=>{const l=document.createElement('link');l.href=FONT_LINK;l.rel='stylesheet';document.head.appendChild(l);
    return()=>{if(document.head.contains(l))document.head.removeChild(l);};},[]);
  useEffect(()=>{const onKey=e=>{if(e.key==='Escape')clearSel();};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[clearSel]);

  const setScaleP=(v)=>{setScale(v);try{localStorage.setItem('pal2-scale',String(v));}catch(e){/* noop */}};
  const setViewP=(v)=>{setView(v);clearSel();try{localStorage.setItem('pal2-view',v);}catch(e){/* noop */}};
  const synced=lastSync?lastSync.toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'}):'';

  return(
    <div style={{[SCALE_VAR]:scale,fontFamily:T.font,display:'flex',flexDirection:'column',height:'100vh',background:T.bg,overflow:'hidden',color:T.tx}}>
      <div style={{background:T.hdr,borderBottom:`1px solid ${T.bd}`,padding:'0 12px',display:'flex',alignItems:'center',height:44,flexShrink:0}}>
        <button onClick={()=>navigate('/')} style={{background:'rgba(91,156,246,0.12)',border:'1px solid rgba(91,156,246,0.2)',borderRadius:5,padding:'3px 9px',fontSize:sc(10),fontWeight:700,color:T.acc,cursor:'pointer',marginRight:10,fontFamily:T.font,letterSpacing:'0.02em',flexShrink:0}}>KarlOS</button>
        <span style={{fontFamily:T.serif,fontSize:sc(14),fontWeight:600,color:T.acc2,letterSpacing:'0.06em',marginRight:8,flexShrink:0}}>Palantír</span>
        <span style={{fontSize:sc(9),fontWeight:700,color:T.acc,background:'rgba(91,156,246,0.12)',borderRadius:8,padding:'1px 6px',marginRight:12,flexShrink:0}}>v2 · editing</span>
        <div style={{display:'flex',gap:0,overflow:'hidden'}}>
          {NAV.map(n=>(
            <span key={n.id} onClick={n.on?()=>setViewP(n.id):undefined} title={n.on?'':'Coming in a later session'}
              style={{padding:'4px 10px',fontSize:sc(11),fontWeight:view===n.id?700:500,
              color:n.on?(view===n.id?T.acc:T.tx2):T.tx3,borderBottom:`2px solid ${view===n.id?T.acc:'transparent'}`,whiteSpace:'nowrap',
              cursor:n.on?'pointer':'not-allowed',userSelect:'none'}}>{n.label}</span>
          ))}
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:sc(10),color:T.tx3}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:saving?T.y:(live?T.g:T.tx3),display:'inline-block'}}/>
            {saving?'saving…':(live?'live':'offline')}{synced?(' · '+synced):''}
          </span>
          <button onClick={()=>reload()} style={{...ss.btn,fontSize:sc(11),opacity:loading?0.5:1}} disabled={loading}>Reload</button>
        </div>
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {view==='today'?<Today/>:view==='activity'?<Activity/>:<Files/>}
      </div>

      <div style={{height:32,background:T.hdr,borderTop:`1px solid ${T.bd}`,display:'flex',alignItems:'center',justifyContent:'center',gap:10,flexShrink:0,userSelect:'none'}}>
        <span style={{fontSize:sc(11),fontFamily:T.serif,color:T.tx3,letterSpacing:'0.04em'}}>Palantír</span>
        <span style={{color:T.bd2,fontSize:12}}>·</span>
        <span style={{fontSize:sc(10),color:T.tx3}}>A</span>
        <input type="range" min={0.7} max={1.6} step={0.05} value={scale} onChange={e=>setScaleP(parseFloat(e.target.value))} style={{width:140,cursor:'pointer',accentColor:T.acc}}/>
        <span style={{fontSize:sc(14),color:T.tx3}}>A</span>
        <span style={{fontSize:sc(10),color:T.tx3,fontFamily:T.mono,minWidth:34}}>{Math.round(scale*100)}%</span>
      </div>

      <ToastHost/>
      <BatchBar/>
    </div>
  );
}

export default function App(){
  return <StoreProvider><Shell/></StoreProvider>;
}

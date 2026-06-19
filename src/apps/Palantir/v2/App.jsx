// Palantír 2.0 shell: frame + Files surface, editable (Session 5a), at /palantir2.
import React,{useEffect,useState} from "react";
import { useNavigate } from "react-router-dom";
import { StoreProvider, useStore } from "./data/store";
import { T, sc, ss, SCALE_VAR, FONT_LINK } from "./theme";
import Files from "./views/Files";
import ToastHost from "./components/Toasts";
import BatchBar from "./components/BatchBar";

const NAV=[{id:'files',label:'Files',on:true},{id:'today',label:'Today'},{id:'team',label:'Team'},{id:'activity',label:'Activity'}];

function readScale(){try{const v=parseFloat(localStorage.getItem('pal2-scale'));return v>=0.7&&v<=1.6?v:1.0;}catch(e){return 1.0;}}

function Shell(){
  const navigate=useNavigate();
  const {live,lastSync,reload,loading,saving,clearSel}=useStore();
  const [scale,setScale]=useState(readScale);

  useEffect(()=>{const l=document.createElement('link');l.href=FONT_LINK;l.rel='stylesheet';document.head.appendChild(l);
    return()=>{if(document.head.contains(l))document.head.removeChild(l);};},[]);
  useEffect(()=>{const onKey=e=>{if(e.key==='Escape')clearSel();};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[clearSel]);

  const setScaleP=(v)=>{setScale(v);try{localStorage.setItem('pal2-scale',String(v));}catch(e){/* noop */}};
  const synced=lastSync?lastSync.toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'}):'';

  return(
    <div style={{[SCALE_VAR]:scale,fontFamily:T.font,display:'flex',flexDirection:'column',height:'100vh',background:T.bg,overflow:'hidden',color:T.tx}}>
      <div style={{background:T.hdr,borderBottom:`1px solid ${T.bd}`,padding:'0 12px',display:'flex',alignItems:'center',height:44,flexShrink:0}}>
        <button onClick={()=>navigate('/')} style={{background:'rgba(91,156,246,0.12)',border:'1px solid rgba(91,156,246,0.2)',borderRadius:5,padding:'3px 9px',fontSize:sc(10),fontWeight:700,color:T.acc,cursor:'pointer',marginRight:10,fontFamily:T.font,letterSpacing:'0.02em',flexShrink:0}}>KarlOS</button>
        <span style={{fontFamily:T.serif,fontSize:sc(14),fontWeight:600,color:T.acc2,letterSpacing:'0.06em',marginRight:8,flexShrink:0}}>Palantír</span>
        <span style={{fontSize:sc(9),fontWeight:700,color:T.acc,background:'rgba(91,156,246,0.12)',borderRadius:8,padding:'1px 6px',marginRight:12,flexShrink:0}}>v2 · editing</span>
        <div style={{display:'flex',gap:0,overflow:'hidden'}}>
          {NAV.map(n=>(
            <span key={n.id} title={n.on?'':'Coming in a later session'} style={{padding:'4px 10px',fontSize:sc(11),fontWeight:500,
              color:n.on?T.acc:T.tx3,borderBottom:`2px solid ${n.on?T.acc:'transparent'}`,whiteSpace:'nowrap',
              cursor:n.on?'default':'not-allowed'}}>{n.label}</span>
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
        <Files/>
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

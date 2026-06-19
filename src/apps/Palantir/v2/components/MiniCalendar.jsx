// The universal date picker (blueprint 4.2b): month grid + Today/Tmrw/next Mon/TBD,
// w/o per week row (week-of), m/o on the month (month-of), confirmed/tentative toggle.
// Emits a FlexDate. Replaces v1 FlexDateInput app-wide.
import React,{useState} from "react";
import { T, sc, TYPE } from "../theme";
import { HoverBtn } from "./overlay";

const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad=(n)=>String(n).padStart(2,'0');
const iso=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export default function MiniCalendar({onPick,initialConfidence='confirmed'}){
  const now=new Date(); const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const todayIso=iso(today);
  const [base,setBase]=useState({y:today.getFullYear(),m:today.getMonth()});
  const [conf,setConf]=useState(initialConfidence);
  const fd=(o)=>onPick({precision:'exact',date:null,startDate:null,endDate:null,year:null,month:null,weekStartDate:null,label:'',confidence:conf,...o});

  const step=(d)=>{let m=base.m+d,y=base.y; if(m<0){m=11;y--;} if(m>11){m=0;y++;} setBase({y,m});};
  const {y,m}=base;
  const first=new Date(y,m,1);
  const offset=(first.getDay()+6)%7;                 // Monday-based lead blanks
  const dim=new Date(y,m+1,0).getDate();
  const weeks=Math.ceil((offset+dim)/7);

  const shortcut=(n)=>{const d=new Date(today);d.setDate(today.getDate()+n);return d;};
  const nextMon=(()=>{const d=new Date(today);let add=(1-d.getDay()+7)%7; if(add===0)add=7; d.setDate(d.getDate()+add); return d;})();

  const dayBtn={fontSize:sc(10),padding:'4px 0',borderRadius:4,fontFamily:T.mono,minWidth:20,textAlign:'center'};
  const qBtn={flex:1,fontSize:sc(9),fontWeight:700,border:`1px solid ${T.bd2}`,borderRadius:4,padding:'3px 0',background:T.s2};

  return(
    <div style={{width:228}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}>
        <HoverBtn title="Previous month" onClick={()=>step(-1)} style={{border:`1px solid ${T.bd2}`,borderRadius:4,fontSize:sc(11),padding:'1px 7px'}} hoverColor={T.acc} hoverBg="transparent">‹</HoverBtn>
        <span style={{display:'flex',alignItems:'center',gap:6}}>
          <b style={{fontSize:sc(11),color:T.tx,fontWeight:600}}>{MONTHS[m]} {y}</b>
          <HoverBtn title={'Month of '+MONTHS[m]} onClick={()=>fd({precision:'month',month:m+1,year:y})}
            style={{fontSize:sc(8),fontWeight:700,border:`1px solid ${T.bd2}`,borderRadius:4,padding:'1px 6px'}} hoverColor={T.acc} hoverBg="transparent">m/o</HoverBtn>
        </span>
        <HoverBtn title="Next month" onClick={()=>step(1)} style={{border:`1px solid ${T.bd2}`,borderRadius:4,fontSize:sc(11),padding:'1px 7px'}} hoverColor={T.acc} hoverBg="transparent">›</HoverBtn>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:8}}>
        {[['Today',today],['Tmrw',shortcut(1)],[MONTHS_SHORT[nextMon.getMonth()]+' '+nextMon.getDate(),nextMon]].map(([label,d],i)=>(
          <HoverBtn key={i} onClick={()=>fd({precision:'exact',date:iso(d)})} style={qBtn} hoverColor={T.acc} hoverBg="transparent" baseColor={T.tx2}>{label}</HoverBtn>
        ))}
        <HoverBtn onClick={()=>fd({precision:'tbd',label:''})} style={qBtn} hoverColor={T.acc} hoverBg="transparent" baseColor={T.tx2}>TBD</HoverBtn>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'17px repeat(7,1fr)',gap:2,marginBottom:6}}>
        <span/>
        {['M','T','W','T','F','S','S'].map((d,i)=><span key={i} style={{fontSize:sc(8),fontWeight:700,color:T.tx3,textAlign:'center',padding:'2px 0'}}>{d}</span>)}
        {Array.from({length:weeks}).map((_,r)=>{
          const monday=new Date(y,m,1-offset+r*7);
          return(
            <React.Fragment key={r}>
              <HoverBtn title={'Week of '+MONTHS_SHORT[monday.getMonth()]+' '+monday.getDate()} onClick={()=>fd({precision:'week',weekStartDate:iso(monday)})}
                style={{fontSize:sc(7),fontWeight:700,padding:'4px 0',borderRadius:4,color:T.tx3}} hoverColor={T.acc} hoverBg="rgba(91,156,246,0.15)">w/o</HoverBtn>
              {Array.from({length:7}).map((__,c)=>{
                const dnum=r*7+c-offset+1;
                if(dnum<1||dnum>dim)return <span key={c}/>;
                const d=new Date(y,m,dnum); const di=iso(d); const isToday=di===todayIso;
                return(
                  <HoverBtn key={c} onClick={()=>fd({precision:'exact',date:di})} style={{...dayBtn,boxShadow:isToday?`0 0 0 1px ${T.acc} inset`:'none',color:isToday?T.acc:T.tx2}} hoverColor="#fff" hoverBg={T.acc} baseColor={isToday?T.acc:T.tx2}>{dnum}</HoverBtn>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{display:'flex',gap:4,borderTop:`1px solid ${T.bd}`,paddingTop:7}}>
        {['confirmed','tentative'].map(c=>(
          <button key={c} onMouseDown={e=>e.preventDefault()} onClick={()=>setConf(c)}
            style={{flex:1,fontSize:sc(9),fontWeight:600,border:`1px solid ${conf===c?T.acc:T.bd2}`,borderRadius:4,padding:'3px 0',
              background:conf===c?'rgba(91,156,246,0.12)':'transparent',color:conf===c?T.acc:T.tx3,cursor:'pointer',fontFamily:T.font,textTransform:'capitalize'}}>{c}</button>
        ))}
      </div>
    </div>
  );
}

// Activity surface (blueprint 4.1): the event stream (pal_events: hand log + system events as
// one stream) with filters, applied-package cards, and a snapshots list + view. Restore and
// manual snapshot are write paths gated to the cutover (they need the new restore RPC and a
// live test), so this surface is read-only this session: stream, view, and a v1 JSON export.
import React,{useState,useEffect} from "react";
import { useStore } from "../data/store";
import { T, sc, ss, wrap2 } from "../theme";
import { Chip, Empty } from "../components/primitives";
import { activityItems } from "../data/derive";
import { fetchSnapshot } from "../data/client";
import { exportV1 } from "../data/mutations";

const fmtDT=(ts)=>{const d=new Date(ts);return isNaN(d)?'':d.toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});};
const FILTERS=[['all','All'],['claude','Claude updates'],['mine','My edits']];

const card={border:`1px solid ${T.bd}`,borderRadius:8,background:T.s1,marginBottom:9,overflow:'hidden'};
const head={display:'flex',alignItems:'center',gap:8,padding:'8px 11px'};

function PackageCard({m,item}){
  const [open,setOpen]=useState(false);
  const c=item.counts||{};
  const parts=[];
  if(c.completed)parts.push(c.completed+' completed');
  if(c.created)parts.push(c.created+' created');
  if(c.updated)parts.push(c.updated+' updated');
  if(c.logged)parts.push(c.logged+' logged');
  if(c.other)parts.push(c.other+' other');
  return(
    <div style={card}>
      <div style={head}>
        <span style={{color:T.acc,fontSize:sc(12)}}>⬇</span>
        <span style={{flex:1,fontSize:sc(12),fontWeight:600,color:T.tx,...wrap2}}>{item.header?.summary||('Applied package '+String(item.packageId).slice(0,8))}</span>
        <Chip text="applied" bg={'rgba(63,182,139,0.12)'} tx={T.g} small/>
        <span style={{fontSize:sc(10),color:T.tx3,flexShrink:0}}>{fmtDT(item.created_at)}</span>
      </div>
      <div style={{padding:'0 11px 9px',fontSize:sc(11),color:T.tx2}}>
        {parts.join(' · ')||'No itemized changes recorded.'}
        {item.children.length>0&&<button onClick={()=>setOpen(o=>!o)} style={{...ss.btn,fontSize:sc(10),padding:'2px 8px',marginLeft:8}}>{open?'Hide':'View'} contents</button>}
        {open&&(
          <div style={{marginTop:7,borderTop:`1px solid ${T.bd}`,paddingTop:7,display:'flex',flexDirection:'column',gap:3}}>
            {item.children.slice(0,60).map(e=>(
              <div key={e.id} style={{fontSize:sc(10),color:T.tx2,...wrap2}}>
                <span style={{color:T.tx3}}>{e.kind}</span> {e.summary||''}{e.file_id&&m.fileById[e.file_id]?<span style={{color:T.tx3}}> · {m.fileById[e.file_id].title}</span>:null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({m,event}){
  const file=event.file_id?m.fileById[event.file_id]:null;
  const claude=event.actor==='claude';
  return(
    <div style={card}>
      <div style={head}>
        <span style={{color:claude?T.acc:T.acc2,fontSize:sc(12)}}>{claude?'⬇':'✎'}</span>
        <span style={{fontSize:sc(11),fontWeight:700,color:claude?T.acc:T.acc2,flexShrink:0}}>{claude?'Claude':'Karl'}</span>
        <span style={{flex:1,fontSize:sc(11),color:T.tx,...wrap2}}>{event.summary||event.kind}</span>
        {file&&<span style={{fontSize:sc(10),color:T.tx3,flexShrink:0,...wrap2,maxWidth:160}}>{file.title}</span>}
        <span style={{fontSize:sc(10),color:T.tx3,flexShrink:0}}>{fmtDT(event.event_date||event.created_at)}</span>
      </div>
    </div>
  );
}

function snapCounts(state){
  if(!state||typeof state!=='object')return [];
  const out=[];
  const files=Array.isArray(state.files)?state.files:null;
  if(files){
    out.push(['files',files.length]);
    let t=0,d=0;
    files.forEach(f=>{ if(Array.isArray(f.tasks))t+=f.tasks.length; if(Array.isArray(f.standaloneTasks))t+=f.standaloneTasks.length; if(Array.isArray(f.deliverables))d+=f.deliverables.length; });
    if(t)out.push(['tasks',t]); if(d)out.push(['outputs',d]);
  }
  if(Array.isArray(state.people))out.push(['people',state.people.length]);
  return out;
}

function SnapshotRow({snap}){
  const [open,setOpen]=useState(false);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(open&&!data&&!loading){ setLoading(true); fetchSnapshot(snap.id).then(d=>{setData(d);setLoading(false);}); }
  },[open,data,loading,snap.id]);
  const counts=data?snapCounts(data.state):[];
  return(
    <div style={{border:`1px solid ${T.bd}`,borderRadius:7,marginBottom:5,overflow:'hidden',background:T.s1}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:'7px 9px',cursor:'pointer',userSelect:'none'}}>
        <div style={{fontSize:sc(11),fontWeight:600,color:T.tx,...wrap2}}>#{snap.id} · {snap.label||'snapshot'}</div>
        <div style={{fontSize:sc(10),color:T.tx3,marginTop:2}}>{fmtDT(snap.created_at)} · {snap.trigger||'auto'}</div>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${T.bd}`,padding:'7px 9px',background:T.s2}}>
          {loading&&<span style={{fontSize:sc(10),color:T.tx3}}>Loading…</span>}
          {data&&(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {counts.length===0&&<span style={{fontSize:sc(10),color:T.tx3}}>State captured.</span>}
                {counts.map(([k,v])=><Chip key={k} text={v+' '+k} bg={T.s3} tx={T.tx2} small/>)}
              </div>
              <span title="Restore activates at cutover (needs the pal_restore_snapshot function)" style={{fontSize:sc(10),color:T.tx3,fontStyle:'italic'}}>Restore arrives with the cutover.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Activity(){
  const {model,snapshots,showToast}=useStore();
  const [filter,setFilter]=useState('all');
  if(!model)return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:T.tx3,fontSize:sc(12)}}>Loading…</div>;
  const items=activityItems(model,{filter});

  const exportJson=async()=>{
    showToast('Preparing export…');
    const {data,error}=await exportV1();
    if(error){showToast('Export failed: '+error.message);return;}
    try{
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='palantir-state-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      showToast('Downloaded v1 JSON');
    }catch(e){showToast('Export failed: '+(e?.message||e));}
  };

  return(
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px 24px'}}>
        <div style={{marginBottom:12}}>
          <h2 style={{fontSize:sc(15),fontWeight:700,color:T.tx}}>Activity</h2>
          <div style={{fontSize:sc(11),color:T.tx3}}>Every write, by anyone, as one stream. Replaces the Import screen and Snapshots modal.</div>
        </div>
        <div style={{display:'flex',gap:5,marginBottom:12}}>
          {FILTERS.map(([k,lab])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{...ss.btn,fontSize:sc(10),padding:'3px 9px',
              background:filter===k?T.acc:'transparent',color:filter===k?'#fff':T.tx2,border:`1px solid ${filter===k?T.acc:T.bd}`}}>{lab}</button>
          ))}
          <span style={{marginLeft:'auto',fontSize:sc(10),color:T.tx3,alignSelf:'center'}}>{items.length} entries</span>
        </div>
        {items.length===0&&<Empty>No activity yet for this filter.</Empty>}
        {items.map((it,i)=>it.type==='package'
          ? <PackageCard key={it.packageId||i} m={model} item={it}/>
          : <EventCard key={it.event.id||i} m={model} event={it.event}/>)}
      </div>

      <div style={{width:264,flexShrink:0,borderLeft:`1px solid ${T.bd}`,padding:'16px 14px 22px',overflowY:'auto'}}>
        <div style={{...ss.lbl,marginBottom:8}}>Snapshots</div>
        {(!snapshots||snapshots.length===0)&&<Empty>No snapshots.</Empty>}
        {(snapshots||[]).map(s=><SnapshotRow key={s.id} snap={s}/>)}
        <div style={{...ss.lbl,margin:'16px 0 8px'}}>Export</div>
        <button onClick={exportJson} style={{...ss.btn,width:'100%',textAlign:'left',padding:'8px 10px'}}>⬇ Download JSON (v1 format)</button>
        <div style={{fontSize:sc(10),color:T.tx3,marginTop:6,fontStyle:'italic'}}>Manual snapshot and restore activate at cutover.</div>
      </div>
    </div>
  );
}

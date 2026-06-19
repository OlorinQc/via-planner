// Store: loads pal_ tables, builds the derive model, subscribes to Realtime, and (5a) owns
// the write path, undo toasts, and selection. Optimistic row writes to pal_ + debounced
// re-derive into palantir_state keep v1 and the chat bridge consistent until cutover.
import React,{createContext,useContext,useEffect,useState,useRef,useCallback,useMemo} from "react";
import { fetchAll, subscribeAll } from "./client";
import { updateRow, getV1UpdatedAt, exportV1, writeV1 } from "./mutations";
import { buildModel } from "./derive";

const Ctx=createContext(null);
export const useStore=()=>useContext(Ctx);

const TABLE={tasks:'pal_tasks',files:'pal_files',outputs:'pal_outputs',flags:'pal_flags',links:'pal_links'};
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const pick=(obj,keys)=>{const o={};for(const k of keys)o[k]=obj?obj[k]:null;return o;};
let _tid=0;

export function StoreProvider({children}){
  const [raw,setRaw]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [live,setLive]=useState(false);
  const [lastSync,setLastSync]=useState(null);
  const [saving,setSaving]=useState(false);
  const [toasts,setToasts]=useState([]);
  const [selected,setSelected]=useState(()=>new Set());

  const rawRef=useRef(null); rawRef.current=raw;
  const v1Meta=useRef(null);
  const selfWriteUntil=useRef(0);
  const reloadTimer=useRef(null);
  const syncTimer=useRef(null);

  const load=useCallback(async()=>{
    try{
      const [data,v1]=await Promise.all([fetchAll(),getV1UpdatedAt()]);
      setRaw(data); v1Meta.current=v1; setError(null); setLastSync(new Date());
    }catch(e){setError(e?.message||String(e));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const unsub=subscribeAll(
      ()=>{ if(Date.now()<selfWriteUntil.current)return;
        if(reloadTimer.current)clearTimeout(reloadTimer.current);
        reloadTimer.current=setTimeout(()=>load(),500);
      },
      (status)=>setLive(status==='SUBSCRIBED')
    );
    return ()=>{if(reloadTimer.current)clearTimeout(reloadTimer.current);unsub();};
  },[load]);

  const dismiss=useCallback((id)=>setToasts(ts=>ts.filter(t=>t.id!==id)),[]);
  const showToast=useCallback((msg,undo)=>{
    const id=++_tid; setToasts(ts=>[...ts,{id,msg,undo}]);
    setTimeout(()=>dismiss(id),8000);
    return id;
  },[dismiss]);

  const doSync=useCallback(async()=>{
    setSaving(true);
    try{
      const cur=await getV1UpdatedAt();
      if(cur&&v1Meta.current&&cur!==v1Meta.current){
        showToast('External update detected, reloading'); await load(); return;
      }
      const {data:blob,error:exErr}=await exportV1();
      if(exErr){showToast('Sync failed: '+exErr.message);return;}
      const {now,error:wErr}=await writeV1(blob);
      if(wErr){showToast('Sync failed: '+wErr.message);return;}
      v1Meta.current=now; setLastSync(new Date());
    }catch(e){showToast('Sync error: '+(e?.message||e));}
    finally{setSaving(false);}
  },[load,showToast]);
  const scheduleSync=useCallback(()=>{ if(syncTimer.current)clearTimeout(syncTimer.current); syncTimer.current=setTimeout(()=>doSync(),900); },[doSync]);

  const patchLocal=useCallback((key,id,patch)=>{
    setRaw(prev=>prev?{...prev,[key]:prev[key].map(r=>r.id===id?{...r,...patch}:r)}:prev);
  },[]);
  const editRow=useCallback(async(key,id,patch,opts={})=>{
    const table=TABLE[key]; if(!table)return;
    const before=rawRef.current?.[key]?.find(r=>r.id===id);
    const prevSlice=pick(before,Object.keys(patch));
    selfWriteUntil.current=Date.now()+1800;
    patchLocal(key,id,patch);
    const {error:e}=await updateRow(table,id,patch);
    if(e){ patchLocal(key,id,prevSlice); showToast('Save failed: '+e.message); return; }
    selfWriteUntil.current=Date.now()+1800;
    scheduleSync();
    if(opts.toast){
      const undo=opts.undo===false?null:async()=>{
        selfWriteUntil.current=Date.now()+1800;
        patchLocal(key,id,prevSlice); await updateRow(table,id,prevSlice); scheduleSync();
      };
      showToast(opts.toast,undo);
    }
  },[patchLocal,scheduleSync,showToast]);

  const saveTask=useCallback((id,patch,opts)=>editRow('tasks',id,patch,opts),[editRow]);
  const saveFile=useCallback((id,patch,opts)=>editRow('files',id,patch,opts),[editRow]);
  const saveOutput=useCallback((id,patch,opts)=>editRow('outputs',id,patch,opts),[editRow]);
  const toggleDone=useCallback((task)=>{
    const done=['completed','cancelled'].includes(task.status);
    if(done) saveTask(task.id,{status:'not_started',completed_at:null},{toast:'Reopened · saved'});
    else saveTask(task.id,{status:'completed',completed_at:todayStr()},{toast:'Completed · saved'});
  },[saveTask]);
  const setDue=useCallback((key,id,flex)=>editRow(key,id,{due:flex},{toast:'Date set · saved'}),[editRow]);
  const setAssignees=useCallback((id,ids)=>saveTask(id,{assignee_ids:ids},{toast:'Assignees updated · saved'}),[saveTask]);
  const saveMemory=useCallback((fileId,html)=>editRow('files',fileId,{memory:html}),[editRow]);

  const clearSel=useCallback(()=>setSelected(s=>s.size?new Set():s),[]);
  const toggleSelect=useCallback((id)=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;}),[]);
  const batchDone=useCallback((ids)=>{ ids.forEach(id=>saveTask(id,{status:'completed',completed_at:todayStr()})); showToast(ids.length+' completed · saved'); clearSel(); },[saveTask,showToast,clearSel]);
  const batchDue=useCallback((ids,flex)=>{ ids.forEach(id=>editRow('tasks',id,{due:flex})); showToast(ids.length+' rescheduled · saved'); clearSel(); },[editRow,showToast,clearSel]);
  const batchAssign=useCallback((ids,personId)=>{
    ids.forEach(id=>{ const t=rawRef.current?.tasks?.find(x=>x.id===id); const cur=t?.assignee_ids||[]; if(!cur.includes(personId)) saveTask(id,{assignee_ids:[...cur,personId]}); });
    showToast(ids.length+' reassigned · saved'); clearSel();
  },[saveTask,showToast,clearSel]);

  const model=useMemo(()=>raw?buildModel(raw):null,[raw]);
  const actions=useMemo(()=>({saveTask,saveFile,saveOutput,toggleDone,setDue,setAssignees,saveMemory,batchDone,batchDue,batchAssign}),
    [saveTask,saveFile,saveOutput,toggleDone,setDue,setAssignees,saveMemory,batchDone,batchDue,batchAssign]);
  const value=useMemo(()=>({model,loading,error,live,lastSync,saving,reload:load,toasts,showToast,dismiss,selected,toggleSelect,clearSel,actions}),
    [model,loading,error,live,lastSync,saving,load,toasts,showToast,dismiss,selected,toggleSelect,clearSel,actions]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

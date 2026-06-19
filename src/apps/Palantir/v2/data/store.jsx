// Store: loads pal_ tables, builds the derive model, subscribes to Realtime.
// Read-only this session (no mutating actions yet; those arrive in Session 5).
import React,{createContext,useContext,useEffect,useState,useRef,useCallback,useMemo} from "react";
import { fetchAll, subscribeAll } from "./client";
import { buildModel } from "./derive";

const Ctx=createContext(null);
export const useStore=()=>useContext(Ctx);

export function StoreProvider({children}){
  const [raw,setRaw]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [live,setLive]=useState(false);
  const [lastSync,setLastSync]=useState(null);
  const debounce=useRef(null);

  const load=useCallback(async()=>{
    try{
      const data=await fetchAll();
      setRaw(data);setError(null);setLastSync(new Date());
    }catch(e){setError(e?.message||String(e));}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const unsub=subscribeAll(
      ()=>{ // a row changed somewhere: debounce a full refetch (read-only scaffold)
        if(debounce.current)clearTimeout(debounce.current);
        debounce.current=setTimeout(()=>{load();},400);
      },
      (status)=>{ setLive(status==='SUBSCRIBED'); }
    );
    return ()=>{if(debounce.current)clearTimeout(debounce.current);unsub();};
  },[load]);

  const model=useMemo(()=>raw?buildModel(raw):null,[raw]);
  const value=useMemo(()=>({model,loading,error,live,lastSync,reload:load}),[model,loading,error,live,lastSync,load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

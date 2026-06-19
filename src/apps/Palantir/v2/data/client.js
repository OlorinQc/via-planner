// Supabase read layer for Palantír 2.0. pal_ tables (+ people, campaigns) for the live model,
// plus snapshot metadata for the Activity surface (the heavy state blob is loaded on demand).
import { supabase } from "../../../../supabase";

export const ENTITIES=[
  ["people","pal_people"],
  ["files","pal_files"],
  ["outputs","pal_outputs"],
  ["tasks","pal_tasks"],
  ["flags","pal_flags"],
  ["links","pal_links"],
  ["events","pal_events"],
  ["campaigns","pal_campaigns"],
];

export async function fetchAll(){
  const out={};
  await Promise.all(ENTITIES.map(async([key,table])=>{
    const{data,error}=await supabase.from(table).select('*');
    if(error){console.error('[palantir2] read '+table,error.message);out[key]=[];}
    else out[key]=data||[];
  }));
  return out;
}

// Snapshot list for Activity: metadata only (no state blob), newest first.
export async function fetchSnapshots(){
  const {data,error}=await supabase.from('palantir_snapshots').select('id,label,trigger,created_at').order('created_at',{ascending:false}).limit(100);
  if(error){console.error('[palantir2] read snapshots',error.message);return [];}
  return data||[];
}

// One snapshot with its full v1-shape state, loaded only when viewed.
export async function fetchSnapshot(id){
  const {data,error}=await supabase.from('palantir_snapshots').select('id,label,trigger,created_at,state').eq('id',id).maybeSingle();
  if(error){console.error('[palantir2] read snapshot '+id,error.message);return null;}
  return data||null;
}

// Subscribe to Realtime on every pal_ table. onChange(table,payload) fires per row event;
// onStatus(status) reports channel state ('SUBSCRIBED' etc.).
export function subscribeAll(onChange,onStatus){
  const channel=supabase.channel('palantir2-live');
  ENTITIES.forEach(([,table])=>{
    channel.on('postgres_changes',{event:'*',schema:'public',table},(payload)=>onChange(table,payload));
  });
  channel.subscribe((status)=>{if(onStatus)onStatus(status);});
  return ()=>{try{supabase.removeChannel(channel);}catch(e){/* noop */}};
}

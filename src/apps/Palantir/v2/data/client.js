// Supabase read layer for Palantír 2.0 (read-only this session). One concern: pal_ tables.
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

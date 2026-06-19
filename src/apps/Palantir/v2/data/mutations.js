// Write layer (Session 5a). Transitional pre-cutover model: write rows to pal_ for the
// normalized truth, then re-derive palantir_state via pal_export_state so v1 and the daily
// chat bridge stay consistent. At cutover (Session 6) the palantir_state sync is dropped.
import { supabase } from "../../../../supabase";

export async function updateRow(table,id,patch){
  return supabase.from(table).update(patch).eq('id',id);
}
export async function insertRow(table,row){
  return supabase.from(table).insert(row).select().maybeSingle();
}
export async function deleteRow(table,id){
  return supabase.from(table).delete().eq('id',id);
}

// Optimistic-concurrency token: current canonical palantir_state.updated_at.
export async function getV1UpdatedAt(){
  const {data}=await supabase.from('palantir_state').select('updated_at').eq('id',1).maybeSingle();
  return data?.updated_at||null;
}

// Rebuild the v1 blob from pal_ (authenticated-callable, INVOKER).
export async function exportV1(){
  return supabase.rpc('pal_export_state');
}

// Write the rebuilt blob back into the canonical row.
export async function writeV1(blob){
  const {data:{user}}=await supabase.auth.getUser();
  const now=new Date().toISOString();
  const {error}=await supabase.from('palantir_state').upsert({id:1,state:blob,updated_at:now,user_id:user?.id});
  return {now,error};
}

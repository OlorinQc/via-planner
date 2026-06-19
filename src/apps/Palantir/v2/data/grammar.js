// Capture grammar (blueprint 4.2b): typed tokens are the keyboard fast lane only, never
// required, and fold into the same chips the click buttons set. scanLive consumes only
// space-closed tokens so a half-typed @name or date is never eaten mid-keystroke; the
// composer re-runs it with a trailing space on submit to catch the final token.
// Tokens: leading "Q:/RISK:/BLOCKED:" kind, leading "Name:" file route (Today capture only,
// when ctx.files is supplied), leading "> output:" routing, "@name",
// dates (today, tmrw, weekday, "jun 20", "w/o jun 15" week-of, "m/o jul" month-of, tbd).

const MONTHS=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const MO="(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
const WD={sun:0,sunday:0,mon:1,monday:1,tue:2,tuesday:2,wed:3,wednesday:3,thu:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};

const pad=(n)=>String(n).padStart(2,'0');
const iso=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const startOfToday=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const monday=(d)=>{const x=new Date(d);const off=(x.getDay()+6)%7;x.setDate(x.getDate()-off);return x;};
const monthIndex=(s)=>MONTHS.indexOf(String(s).slice(0,3).toLowerCase());
const deburr=(x)=>String(x==null?'':x).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

const BASE={precision:'exact',date:null,startDate:null,endDate:null,year:null,month:null,weekStartDate:null,label:'',confidence:'confirmed'};
const mk=(o)=>({...BASE,...o});

// Year inference: choose the year that puts the date nearest to upcoming (allow ~31d into the past).
function inferYear(monthIdx,day){
  const t=startOfToday(); let y=t.getFullYear();
  const cand=new Date(y,monthIdx,day||1);
  if((cand-t)/864e5 < -31) y+=1;
  return y;
}
const exactFlex=(d)=>mk({precision:'exact',date:iso(d)});
const weekFlex=(d)=>mk({precision:'week',weekStartDate:iso(monday(d))});
const monthFlex=(idx)=>mk({precision:'month',month:idx+1,year:inferYear(idx,1)});
const tbdFlex=()=>mk({precision:'tbd'});

function nextWeekday(name){
  const target=WD[String(name).toLowerCase()]; if(target==null)return null;
  const t=startOfToday(); let add=(target-t.getDay()+7)%7; if(add===0)add=7;
  return addDays(t,add);
}
function monthDay(monStr,dayStr){
  const idx=monthIndex(monStr); const day=parseInt(dayStr,10);
  if(idx<0||!(day>=1&&day<=31))return null;
  return new Date(inferYear(idx,day),idx,day);
}

export function normKind(s){
  const k=String(s||'').toLowerCase();
  if(k==='q'||k==='question')return 'question';
  if(k==='risk')return 'risk';
  if(k==='blocked'||k==='blocker')return 'blocker';
  return null;
}

export function findPerson(people,tok){
  const t=deburr(tok).replace(/[^a-z]/g,''); if(!t)return null;
  const cand=[...people].sort((a,b)=>(Number(b.active)-Number(a.active)));
  const initials=(n)=>deburr(n).split(/[\s-]+/).filter(Boolean).map(w=>w[0]).join('');
  let hit=cand.find(p=>initials(p.name)===t);                                  // exact initials, e.g. @wat
  if(!hit)hit=cand.find(p=>initials(p.name).startsWith(t));                    // @wa -> William-Antoine (wat)
  if(!hit)hit=cand.find(p=>deburr(p.name).split(/[\s-]+/)[0].startsWith(t));   // given name
  if(!hit)hit=cand.find(p=>deburr(p.name).startsWith(t));                      // full name
  return hit?hit.id:null;
}

export function findOutput(outputs,name){
  const q=deburr(name).trim(); if(!q)return null;
  let hit=outputs.find(o=>deburr(o.title).startsWith(q));
  if(!hit)hit=outputs.find(o=>deburr(o.title).includes(q));
  return hit||null;
}

// File route for the Today quick-add ("Dorval: call Philippe"). Active files win ties.
export function findFile(files,name){
  const q=deburr(name).trim(); if(!q)return null;
  const cand=[...files].sort((a,b)=>(Number(!a.archived)-Number(!b.archived)));
  let hit=cand.find(f=>deburr(f.title).startsWith(q));
  if(!hit)hit=cand.find(f=>deburr(f.title).includes(q));
  return hit||null;
}

function scanDate(text){
  let m;
  if((m=text.match(new RegExp(`\\bw/o\\s+${MO}\\.?\\s+(\\d{1,2})\\b\\s`,'i')))){const d=monthDay(m[1],m[2]);if(d)return{due:weekFlex(d),rest:text.replace(m[0],' ')};}
  if((m=text.match(new RegExp(`\\bm/o\\s+${MO}\\b\\s`,'i')))){const idx=monthIndex(m[1]);if(idx>=0)return{due:monthFlex(idx),rest:text.replace(m[0],' ')};}
  if((m=text.match(/\b(today|tod)\b\s/i)))return{due:exactFlex(startOfToday()),rest:text.replace(m[0],' ')};
  if((m=text.match(/\b(tmrw|tomorrow)\b\s/i)))return{due:exactFlex(addDays(startOfToday(),1)),rest:text.replace(m[0],' ')};
  if((m=text.match(/\b(sun|sunday|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday)\b\s/i))){const d=nextWeekday(m[1]);if(d)return{due:exactFlex(d),rest:text.replace(m[0],' ')};}
  if((m=text.match(new RegExp(`\\b${MO}\\.?\\s+(\\d{1,2})\\b\\s`,'i')))){const d=monthDay(m[1],m[2]);if(d)return{due:exactFlex(d),rest:text.replace(m[0],' ')};}
  if((m=text.match(/\btbd\b\s/i)))return{due:tbdFlex(),rest:text.replace(m[0],' ')};
  return{due:null,rest:text};
}

// Consume space-closed tokens from the input. Returns leftover title text plus whatever was
// extracted; the composer merges this into its chip state and replaces the input text.
export function scanLive(input,ctx={}){
  const people=ctx.people||[],outputs=ctx.outputs||[],files=ctx.files||null;
  let text=String(input==null?'':input);
  const found={assigneeIds:[],due:null,outputId:null,flagKind:null,fileId:null};

  const km=text.match(/^\s*(q|risk|blocked|blocker)\s*:\s*/i);
  if(km){found.flagKind=normKind(km[1]);text=text.slice(km[0].length);}

  // File route (Today only): leading "Name:" that resolves to a known file.
  if(files&&files.length){
    const fm=text.match(/^\s*([^:>@\n]{1,60}?)\s*:\s+/);
    if(fm){const f=findFile(files,fm[1].trim());if(f){found.fileId=f.id;text=text.slice(fm[0].length);}}
  }

  const om=text.match(/^\s*>\s*([^:>]+):\s*/);
  if(om){const o=findOutput(outputs,om[1].trim());if(o){found.outputId=o.id;text=text.slice(om[0].length);}}

  text=text.replace(/@([^\s@]+)(\s+)/g,(whole,tok)=>{const id=findPerson(people,tok);if(id){if(!found.assigneeIds.includes(id))found.assigneeIds.push(id);return '';}return whole;});

  const ds=scanDate(text);
  if(ds.due){found.due=ds.due;text=ds.rest;}

  return {text:text.replace(/\s{2,}/g,' ').replace(/^\s+/,''),...found};
}

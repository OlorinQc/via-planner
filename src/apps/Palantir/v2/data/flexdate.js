// FlexDate: single home for all date math (blueprint 4.3). pal_ stores FlexDate jsonb.

const MONTHS_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const _today=new Date();
export const TODAY=new Date(_today.getFullYear(),_today.getMonth(),_today.getDate());

export const pd=(s)=>{if(!s||typeof s!=='string')return null;const p=s.split("-").map(Number);if(p.length<3)return null;return new Date(p[0],p[1]-1,p[2]);};
export const fmt=(s)=>{const d=pd(s);return d?d.toLocaleDateString("en-CA",{month:"short",day:"numeric"}):null;};
export const daysFromToday=(s)=>{const d=pd(s);return d==null?null:Math.floor((d-TODAY)/864e5);};
export const dueState=(s)=>{const n=daysFromToday(s);if(n==null)return null;return n<0?"overdue":n===0?"today":n<=3?"soon":"ok";};

// Representative single date for a FlexDate (for color/sort only).
export const flexToExact=(fd)=>{
  if(!fd)return null;
  if(typeof fd==='string')return fd;
  if(fd.precision==='exact')return fd.date||null;
  if(fd.precision==='range')return fd.startDate||null;
  if(fd.precision==='week')return fd.weekStartDate||null;
  return null;
};

export const fmtFlex=(fd)=>{
  if(!fd)return null;
  if(typeof fd==='string')return fmt(fd);
  const{precision,date,startDate,endDate,year,month,weekStartDate,label,confidence}=fd;
  const c=confidence==='tentative'?'~':'';
  if(precision==='tbd')return label||'TBD';
  if(precision==='exact'&&date)return c+fmt(date);
  if(precision==='range'&&startDate&&endDate)return c+fmt(startDate)+' – '+fmt(endDate);
  if(precision==='week'&&weekStartDate){const d=pd(weekStartDate);return d?c+'Week of '+MONTHS_SHORT[d.getMonth()]+' '+d.getDate():null;}
  if(precision==='month'&&year&&month!=null)return c+MONTHS_SHORT[month-1]+' '+year;
  return label||null;
};

export const flexDueState=(fd)=>dueState(flexToExact(fd));

// Sort comparator: dated first (ascending), undated last.
export const compareDue=(a,b)=>{
  const da=flexToExact(a),db=flexToExact(b);
  if(!da&&!db)return 0;
  if(!da)return 1;
  if(!db)return -1;
  return da<db?-1:da>db?1:0;
};

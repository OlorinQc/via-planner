// Palantír 2.0 — theme tokens, type scale, status maps.
// Single home for visual identity (blueprint 4.2). Evolution of v1 T/ss.

export const FONT_LINK="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";

export const T={
  bg:'#080a10',s1:'#0f1219',s2:'#141824',s3:'#1a1f2e',
  bd:'rgba(255,255,255,0.06)',bd2:'rgba(255,255,255,0.11)',bd3:'rgba(255,255,255,0.03)',
  tx:'#dde1ec',tx2:'#7e8a9e',tx3:'#3e4a5a',
  acc:'#5b9cf6',acc2:'#a8b8d0',
  g:'#3fb68b',y:'#d4922a',r:'#d95f5f',
  hdr:'#0a0c14',
  font:"'IBM Plex Sans', system-ui, sans-serif",
  mono:"'IBM Plex Mono', monospace",
  serif:"'Cinzel', serif",
};

// rem-style scaling: one scoped CSS variable drives all type sizes (replaces v1 zoom).
export const SCALE_VAR='--pal-scale';
export const sc=(n)=>`calc(${n}px * var(${SCALE_VAR}, 1))`;

// Five sizes only (blueprint 4.2): nothing below 10.
export const TYPE={xs:10,sm:11,base:12,md:13,lg:15};

export const ss={
  inp:{width:'100%',background:T.s2,border:`1px solid ${T.bd2}`,borderRadius:5,color:T.tx,fontSize:sc(12),padding:'5px 8px',outline:'none',fontFamily:T.font},
  btn:{cursor:'pointer',fontSize:sc(11),fontWeight:500,borderRadius:5,padding:'4px 10px',border:`1px solid ${T.bd2}`,background:T.s2,color:T.tx2,fontFamily:T.font},
  btnP:{cursor:'pointer',fontSize:sc(11),fontWeight:600,borderRadius:5,padding:'5px 12px',border:'none',background:T.acc,color:'#fff',fontFamily:T.font},
  lbl:{fontSize:sc(9),fontWeight:700,color:T.tx3,textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:3,fontFamily:T.font},
};

export const trunc={overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'};
export const wrap2={overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',wordBreak:'break-word'};

// ── Status maps (pal_ vocabulary) ──
export const FILE_STATUS={
  active:{bg:'rgba(91,156,246,0.10)',tx:T.acc,label:'Active'},
  monitoring:{bg:'rgba(212,146,42,0.10)',tx:T.y,label:'Monitoring'},
  paused:{bg:'rgba(62,74,90,0.20)',tx:T.tx2,label:'On Ice'},
  completed:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Completed'},
  archived:{bg:'rgba(62,74,90,0.10)',tx:T.tx3,label:'Archived'},
};
export const FILE_PRI_ORDER=['urgent','high','medium','low'];
export const FILE_PRI={
  urgent:{tx:T.r,label:'Urgent'},
  high:{tx:T.y,label:'High'},
  medium:{tx:T.acc,label:'Medium'},
  low:{tx:T.tx2,label:'Low'},
};
export const TASK_STATUS={
  not_started:{bg:'rgba(62,74,90,0.18)',tx:T.tx2,label:'To Do'},
  in_progress:{bg:'rgba(91,156,246,0.10)',tx:T.acc,label:'In Progress'},
  waiting:{bg:'rgba(168,184,208,0.10)',tx:T.acc2,label:'Waiting'},
  blocked:{bg:'rgba(217,95,95,0.12)',tx:T.r,label:'Blocked'},
  completed:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Done'},
  cancelled:{bg:'rgba(62,74,90,0.10)',tx:T.tx3,label:'Cancelled'},
};
export const OUTPUT_STATUS={
  not_started:{bg:'rgba(62,74,90,0.18)',tx:T.tx2,label:'Not Started'},
  in_progress:{bg:'rgba(91,156,246,0.10)',tx:T.acc,label:'In Progress'},
  in_review:{bg:'rgba(168,184,208,0.12)',tx:T.acc2,label:'In Review'},
  in_approval:{bg:'rgba(212,146,42,0.12)',tx:T.y,label:'In Approval'},
  approved:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Approved'},
  published:{bg:'rgba(63,182,139,0.18)',tx:T.g,label:'Published'},
  completed:{bg:'rgba(63,182,139,0.10)',tx:T.g,label:'Completed'},
  blocked:{bg:'rgba(217,95,95,0.12)',tx:T.r,label:'Blocked'},
  cancelled:{bg:'rgba(62,74,90,0.10)',tx:T.tx3,label:'Cancelled'},
};
export const FLAG_KIND={
  question:{bg:'rgba(91,156,246,0.12)',tx:T.acc,label:'Question'},
  risk:{bg:'rgba(212,146,42,0.12)',tx:T.y,label:'Risk'},
  blocker:{bg:'rgba(217,95,95,0.12)',tx:T.r,label:'Blocked'},
};
export const SENS={
  low:{label:'Low',tx:T.tx2},
  medium:{label:'Medium',tx:T.y},
  high:{label:'High',tx:T.r},
};
export const DUE={
  overdue:{bg:'rgba(217,95,95,0.14)',tx:T.r},
  today:{bg:'rgba(212,146,42,0.14)',tx:T.y},
  soon:{bg:'rgba(212,186,42,0.10)',tx:'#b8960a'},
  ok:{bg:'rgba(63,182,139,0.09)',tx:T.g},
};
const OUTPUT_TYPE_LABELS={
  communication_plan:'Communication Plan',press_release:'Press Release',media_statement:'Media Statement',
  qa:'Q&A',message_map:'Message Map',briefing_note:'Briefing Note',internal_comms:'Internal Communication',
  employee_comms:'Employee Communication',passenger_comms:'Passenger Communication',stakeholder_comms:'Stakeholder Note',
  social_content:'Social Content',speech:'Speech',board_document:'Board Document',website_publication:'Website Publication',
  newswire:'Newswire Release',video:'Video',report:'Report',other:'Output',
};
export const outputTypeLabel=(v)=>OUTPUT_TYPE_LABELS[v]||(v?String(v).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'Output');
export const DONE_TASK=['completed','cancelled'];
export const isTaskDone=(t)=>DONE_TASK.includes(t.status);

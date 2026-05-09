import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TODAY = new Date();
const toStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const TODAY_STR = toStr(TODAY);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WD = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const T_ST = ["Urgent","In Progress","To Plan","Waiting","Done"];
const P_ST = ["Active","Watch","On Ice","Completed"];
const EX_T = ["Media","Government","Partner","Other"];

const SC = {
  "Urgent":      { bg:"#fee2e2", tx:"#991b1b", dot:"#ef4444" },
  "In Progress": { bg:"#fef3c7", tx:"#92400e", dot:"#f59e0b" },
  "To Plan":     { bg:"#dbeafe", tx:"#1e40af", dot:"#3b82f6" },
  "Waiting":     { bg:"#f3f4f6", tx:"#4b5563", dot:"#9ca3af" },
  "Done":        { bg:"#dcfce7", tx:"#166534", dot:"#22c55e" },
};
const PC = {
  "Active":    { bg:"#dbeafe", tx:"#1e40af" },
  "Watch":     { bg:"#fef3c7", tx:"#92400e" },
  "On Ice":    { bg:"#f3f4f6", tx:"#4b5563" },
  "Completed": { bg:"#dcfce7", tx:"#166534" },
};
const DC = {
  overdue: { bg:"#fee2e2", tx:"#991b1b" },
  today:   { bg:"#fef3c7", tx:"#92400e" },
  soon:    { bg:"#fef9c3", tx:"#854d0e" },
  ok:      { bg:"#f0fdf4", tx:"#15803d" },
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
let _u = 6000;
const uid = () => `x${++_u}`;
const pd  = s => { if (!s) return null; const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const ds  = s => { if (!s) return null; const n = Math.floor((pd(s)-TODAY)/864e5); return n<0?"overdue":n===0?"today":n<=3?"soon":"ok"; };
const fmt = s => s ? pd(s).toLocaleDateString("en-CA",{month:"short",day:"numeric"}) : null;
const getMon = d => { const day=d.getDay(), diff=day===0?-6:1-day, m=new Date(d); m.setDate(d.getDate()+diff); return m; };
const weeksOfMonth = (yr,mo) => {
  const first=new Date(yr,mo,1), last=new Date(yr,mo+1,0);
  let mon=getMon(first); const wks=[];
  while (mon<=last) {
    const wk=[]; for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);wk.push(d);} wks.push(wk);
    mon=new Date(mon); mon.setDate(mon.getDate()+7);
  }
  return wks;
};
const wkDays = d => { const m=getMon(d); return Array.from({length:7},(_,i)=>{const x=new Date(m);x.setDate(m.getDate()+i);return x;}); };
const isBlocked = (task,tasks) => {const deps=Array.isArray(task.dependsOn)?task.dependsOn:[];return deps.length>0&&deps.some(id=>{const t=tasks.find(x=>x.id===id);return t&&t.status!=="Done";});};
const approvalDisplay = task => {
  if (!task.approvalChain?.length) return null;
  const pend = task.approvalChain.find(a=>a.status==="pending");
  if (pend) return `Awaiting: ${pend.name}`;
  if (task.approvalChain.find(a=>a.status==="rejected")) return "Rejected";
  if (task.approvalChain.every(a=>a.status==="approved")) return "Approved";
  return null;
};

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const INIT_TEAM = ["Karl","William","Marie-Élise","Sarah","Sylvie","Lise","Félix","Denis","Ève-Danièle"];

const IP = [
  {id:"p01",title:"Gare de Dorval",status:"Active",lead:"Karl",background:"Package de communications complet à envoyer à Phil Normand. Inclut plan de comm, communiqué et messages clés.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p02",title:"Messages Alto",status:"Active",lead:"Karl",background:"Messages clés généraux pour la transition Alto. Chercher discours de Vincent Robitaille.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p03",title:"Rapport trimestriel",status:"Active",lead:"Karl",background:"Communiqué pour le conseil d'administration. À aligner avec le rapport au ministre et intégrer les messages de leçons apprises.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p04",title:"Calendrier institutionnel",status:"Active",lead:"Karl",background:"Collecte des tâches actuelles et prévues de l'équipe comm externe pour remise à Casacom.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p05",title:"Reputation Score",status:"Active",lead:"Karl",background:"Rapport de suivi du Reputation Score. Amélioration des prochains rapports.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p06",title:"Champions",status:"Active",lead:"William",background:"Contrats à venir et présentation à Philippe. Commentaires sur le plan.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p07",title:"Messages et approche — Gaspé",status:"Active",lead:"Karl",background:"Revoir les déclarations de Mathieu dans les médias et ajuster les messages clés avant le 15 mai.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p08",title:"LDRR Engine Contract",status:"Active",lead:"Karl",background:"Communications internes pour la visite du fournisseur. Coordonner avec Susan Williams. Visite le 20 mai.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p09",title:"Révision des pratiques d'équipe",status:"Active",lead:"Karl",background:"21 ou 22 mai. Évaluation de ce qui fonctionne et ce qui doit changer. Modèle TC pour la boîte média. Réintégrer les GR dans la rotation de garde.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p10",title:"Assemblée publique annuelle (APA) 2025",status:"Active",lead:"Karl",background:"APA préenregistrée. Enregistrement chez CASACOM le 10 juin. Mise en ligne sur YouTube le 16 juillet à 16h. Interprétation en langue des signes incluse.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p11",title:"FAM trip",status:"Active",lead:"William",background:"Sécuriser la visibilité de VIA Rail en échange de sièges Business.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p12",title:"Casacom — Planification estivale",status:"Active",lead:"William",background:"Timeline avec Casacom et planification des livrables pour cet été.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p13",title:"Calendrier corporatif",status:"Active",lead:"William",background:"Confirmer qui tient le calendrier à jour. Renvoyer aux BU. Karl doit en parler avec Philippe Normand.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p14",title:"Photojournaliste Globe and Mail",status:"Active",lead:"William",background:"Couverture terrain Sudbury-White River. Assurer suivi de la visibilité.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p15",title:"Recyclage contenu web et GEO",status:"Watch",lead:"Karl",background:"Rencontrer Litsa Kalambokis pour intégrer la stratégie de recyclage de contenu web et GEO.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p16",title:"Winter Schedule",status:"Watch",lead:"Karl",background:"Préparation du deck de présentation pour l'horaire hiver.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p17",title:"Formations CASACOM",status:"Watch",lead:"Karl",background:"Conseil stratégique. Examiner les formations offertes par Casacom pour l'équipe, incluant Marie-Élise.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p18",title:"Liste enjeux / KPI / Médias",status:"Watch",lead:"Karl",background:"One-pager stratégique pour le narratif. Contenu passif, VIA Explained, thought leadership. Pour Phil N.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p19",title:"VIA Narrative Structure",status:"Active",lead:"Karl",background:"Finaliser la structure narrative et partager avec l'équipe.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p20",title:"Comms Plan ONTC",status:"Watch",lead:"Karl",background:"Protocole de communications à créer et intégrer dans le contrat légal.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p21",title:"Strategic Roadmap",status:"Active",lead:"Karl",background:"Appliquer le narratif aux 6 piliers stratégiques. Demander le document complet à Jamie.",archived:false,updatedAt:TODAY_STR,links:[{id:"lnk01",label:"SharePoint Deck",url:"https://viarailonline.sharepoint.com/:p:/s/PublicAffairsandCommunications/IQAxX58-M3ZmTaH9f9NOK95lAQI-nN79Y6_G4ybxngDRjJc"}],updateLog:[]},
  {id:"p22",title:"Mise à jour plan de crise",status:"Active",lead:"Karl",background:"Briefer Philippe Normand sur l'état et les lacunes. Rôles: Sylvie (Cell Lead), William (Scribe), Marie-Élise (boîte média), Casacom (messages), LAM 3 (Lead). Intégrer Everbridge.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p23",title:"Accès Casacom — Janna",status:"Watch",lead:"Karl",background:"Confirmer et activer les accès Casacom avec Janna.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p24",title:"Gare du Palais — Pivot médiatique",status:"Watch",lead:"Karl",background:"Projet sur la glace. Informer Jean-Philippe.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p25",title:"Annonce LDRR",status:"Watch",lead:"William",background:"Attendre la discussion entre Susan et Arnaud avant de procéder.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
  {id:"p26",title:"CAD",status:"Watch",lead:"William",background:"À définir avec William.",archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]},
];

const mkT = (id,pid,title,assignees,status,due,deps=[],gate="",notes="") => ({id,projectId:pid,title,assignees,status,dueDate:due,dependsOn:deps,gate,notes,link:null,approvalChain:[]});

const IT = [
  mkT("t001","p01","Réinjecter les messages du narratif dans le projet",["Karl"],"Urgent","2026-05-13"),
  mkT("t002","p01","Préparer le plan de communications",["Karl"],"Urgent","2026-05-13"),
  mkT("t003","p01","Compléter les messages clés",["Karl"],"Urgent","2026-05-13"),
  mkT("t004","p01","Rédiger le communiqué de presse",["Karl"],"Urgent","2026-05-13",["t003"]),
  mkT("t005","p01","Envoyer le package à Phil Normand",["Karl"],"Urgent","2026-05-13",["t004"]),
  mkT("t006","p02","Chercher les discours de Vincent Robitaille",["Karl"],"Urgent","2026-05-11",[],"","Pour la transition"),
  mkT("t007","p02","Compléter les messages clés généraux",["Karl"],"Urgent","2026-05-11",["t006"]),
  mkT("t008","p03","Rédiger le communiqué pour le board",["Karl"],"Urgent","2026-05-12"),
  mkT("t009","p03","Aligner avec le rapport au ministre",["Karl"],"Urgent","2026-05-12"),
  mkT("t010","p03","Intégrer les messages de leçons apprises",["Karl"],"Urgent","2026-05-12",["t008","t009"]),
  mkT("t011","p04","Collecte des tâches d'équipe comm externe",["Karl"],"Urgent","2026-05-12",[],"","Deadline mardi 12 mai"),
  mkT("t012","p04","Consolider le calendrier et remettre à Casacom",["Karl"],"To Plan",null,["t011"]),
  mkT("t013","p05","Obtenir le rapport final du Reputation Score",["Karl"],"Urgent","2026-05-08",[],"","MEGA MAX priority"),
  mkT("t014","p05","Discuter de l'ajout de fonctionnalités aux rapports",["Karl"],"To Plan",null),
  mkT("t015","p06","Finaliser les contrats à venir",["William"],"In Progress","2026-05-14"),
  mkT("t016","p06","Intégrer les commentaires sur le plan",["William"],"In Progress","2026-05-14"),
  mkT("t017","p06","Présentation à Philippe",["William"],"In Progress","2026-05-14",["t015","t016"]),
  mkT("t018","p07","Revoir les déclarations de Mathieu dans les médias",["Karl"],"In Progress","2026-05-15"),
  mkT("t019","p07","Ajuster les messages clés en conséquence",["Karl"],"In Progress","2026-05-15",["t018"]),
  mkT("t020","p08","Coordonner avec Susan Williams pour les comms internes",["Karl"],"In Progress","2026-05-20"),
  mkT("t021","p08","Préparer avant la visite du fournisseur",["Karl"],"In Progress","2026-05-20",["t020"]),
  mkT("t022","p09","Identifier ce qui fonctionne et ce qui doit changer",["Karl"],"In Progress","2026-05-22"),
  mkT("t023","p09","Identifier un leader ou ressource anglophone",["Karl"],"To Plan","2026-05-22"),
  mkT("t024","p09","Réintégrer les GR dans la rotation de garde",["Karl"],"To Plan","2026-05-22"),
  mkT("t025","p09","Évaluer fermeture boîte média aux heures ouvrables",["Karl"],"To Plan","2026-05-22",[],"","Modèle TC"),
  mkT("t026","p10","Publier le communiqué de presse de l'APA",["Karl"],"In Progress","2026-05-14"),
  mkT("t027","p10","Période de questions du public",["Karl"],"In Progress","2026-05-21",["t026"],"","15-21 mai"),
  mkT("t028","p10","Dry run avec Jonathan, Mathieu et Carl",["Karl"],"To Plan","2026-06-08",["t027"],"","Déjà aux agendas"),
  mkT("t029","p10","Enregistrement de l'APA chez CASACOM",["Karl"],"To Plan","2026-06-10",["t028"]),
  mkT("t030","p10","Postproduction et préparation du Q&R",["Karl"],"To Plan","2026-07-10",["t029"],"","CASACOM + langue des signes"),
  mkT("t031","p10","Mise en ligne de l'APA sur YouTube à 16h",["Karl"],"To Plan","2026-07-16",["t030"]),
  mkT("t032","p11","Sécuriser la visibilité VIA en échange de sièges Business",["William"],"In Progress",null),
  mkT("t033","p12","Établir la timeline avec Casacom pour l'été",["William"],"In Progress",null),
  mkT("t034","p12","Confirmer la planification des livrables",["William"],"To Plan",null,["t033"]),
  mkT("t035","p13","Suivi avec Laurence — confirmer qui tient le calendrier",["William"],"In Progress",null),
  mkT("t036","p13","Renvoyer aux BU pour confirmation",["William"],"To Plan",null,["t035"]),
  mkT("t037","p13","Karl discute du calendrier avec Philippe Normand",["Karl"],"To Plan",null),
  mkT("t038","p14","Assurer le suivi de la couverture terrain",["William"],"In Progress",null),
  mkT("t039","p15","Rencontrer Litsa Kalambokis — stratégie de recyclage",["Karl"],"To Plan",null),
  mkT("t040","p16","Préparer le deck de présentation",["Karl"],"To Plan",null),
  mkT("t041","p17","Examiner les formations offertes par Casacom",["Karl"],"To Plan",null),
  mkT("t042","p17","Vérifier les formations à compléter pour Marie-Élise",["William"],"To Plan",null),
  mkT("t043","p18","Préparer la liste des enjeux en cours",["Karl"],"To Plan",null),
  mkT("t044","p18","Compiler les rapports KPI",["Karl"],"To Plan",null),
  mkT("t045","p18","Constituer la liste des médias",["Karl"],"To Plan",null),
  mkT("t046","p18","Rédiger le one-pager stratégique pour le narratif",["Karl"],"To Plan",null,[],"","Contenu passif, VIA Explained, thought leadership"),
  mkT("t047","p19","Finaliser la structure du narratif",["Karl"],"To Plan",null),
  mkT("t048","p19","Partager la structure avec l'équipe",["Karl"],"To Plan",null,["t047"]),
  mkT("t049","p20","Rédiger le protocole de communications",["Karl"],"To Plan",null),
  mkT("t050","p20","Intégrer le protocole dans le contrat légal",["Karl"],"To Plan",null,["t049"],"Attendre version finale du contrat"),
  mkT("t051","p21","Demander à Jamie le document complet",["Karl"],"To Plan",null),
  mkT("t052","p21","Décomposer le narratif par pilier stratégique",["Karl"],"To Plan",null,["t051"],"","6 piliers"),
  mkT("t053","p21","Créer des micro-narratifs cohérents par pilier",["Karl"],"To Plan",null,["t052"]),
  mkT("t054","p22","Mettre à jour le plan avec les départs récents",["Karl"],"To Plan",null),
  mkT("t055","p22","Briefer Philippe Normand — état et lacunes",["Karl"],"To Plan",null,["t054"]),
  mkT("t056","p22","Confirmer les rôles d'équipe en crise",["Karl"],"To Plan",null,[],"","Sylvie: Cell Lead | William: Scribe | Marie-Élise: boîte média | Casacom: messages | LAM 3: Lead"),
  mkT("t057","p22","Intégrer tout le monde sur Everbridge",["Karl"],"To Plan",null,["t056"]),
  mkT("t058","p23","Confirmer et activer les accès Casacom avec Janna",["Karl"],"To Plan",null),
  mkT("t059","p24","Informer Jean-Philippe que le projet est sur la glace",["Karl"],"Waiting",null,[],"Projet suspendu"),
  mkT("t060","p25","Attendre discussion Susan et Arnaud",["William"],"Waiting",null,[],"Discussion Susan + Arnaud requise"),
  mkT("t061","p26","Définir le périmètre du dossier avec William",["William","Karl"],"To Plan",null),
];

const INIT_TEMPLATES = [
  {id:"tpl01",name:"Press Conference",description:"Standard press conference communications package",taskTemplates:[
    {title:"Draft key messages",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Approve key messages",assignees:["Karl"],status:"To Plan",gate:"Requires approved draft",notes:""},
    {title:"Draft press release",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Media list",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Spokesperson briefing notes",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Logistics coordination",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Run of show",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Media accreditation",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Post-event media monitoring",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
  ]},
  {id:"tpl02",name:"Quarterly Report",description:"Standard quarterly report communications process",taskTemplates:[
    {title:"Draft communiqué for board",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Align with ministerial report",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Integrate lessons learned",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Legal review",assignees:["Karl"],status:"To Plan",gate:"Requires full draft",notes:""},
    {title:"Executive sign-off",assignees:["Karl"],status:"To Plan",gate:"Requires legal clearance",notes:""},
    {title:"Board submission",assignees:["Karl"],status:"To Plan",gate:"Requires sign-off",notes:""},
    {title:"Public release",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
  ]},
  {id:"tpl03",name:"Media Statement",description:"Reactive or proactive media statement",taskTemplates:[
    {title:"Draft key messages",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Draft statement",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Legal review",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Executive approval",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Distribute to media",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
    {title:"Monitor coverage",assignees:["Karl"],status:"To Plan",gate:"",notes:""},
  ]},
];

const INIT_COL_WIDTHS = {Urgent:250,"In Progress":250,"To Plan":250,Waiting:250,Done:250};
const INIT_STATE = { teamMembers: INIT_TEAM, projects: IP, tasks: IT, contacts: [], templates: INIT_TEMPLATES, globalContacts: [], uiPrefs: { dashColWidths: INIT_COL_WIDTHS, projectSplit: 360 } };

// ─── STYLES ───────────────────────────────────────────────────────────────────
const ss = {
  card: { background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 12px" },
  input: { width:"100%", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:6, color:"#111827", fontSize:12, padding:"5px 8px", outline:"none" },
  sel:   { width:"100%", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:6, color:"#111827", fontSize:12, padding:"5px 8px", outline:"none" },
  btn:   { cursor:"pointer", fontSize:11, fontWeight:600, borderRadius:6, padding:"4px 10px", border:"1px solid #e5e7eb", background:"#fff", color:"#374151" },
  btnPrimary: { cursor:"pointer", fontSize:11, fontWeight:600, borderRadius:6, padding:"5px 12px", border:"none", background:"#2563eb", color:"#fff" },
  label: { fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.4px", display:"block", marginBottom:3 },
};

const Chip = ({text,bg,tx,small}) => (
  <span style={{fontSize:small?9:10,fontWeight:600,padding:small?"1px 5px":"2px 8px",borderRadius:10,background:bg,color:tx,whiteSpace:"nowrap",display:"inline-block"}}>{text}</span>
);
const DotSt = ({status}) => { const c=SC[status]; return <Chip text={status} bg={c?.bg} tx={c?.tx}/>; };
const DueChip = ({date}) => { if(!date) return null; const c=DC[ds(date)]; return <Chip text={fmt(date)} bg={c.bg} tx={c.tx}/>; };
const Fld = ({label,children,mb=10}) => <div style={{marginBottom:mb}}><span style={ss.label}>{label}</span>{children}</div>;
const Inp = ({value,onChange,placeholder,rows}) => rows
  ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...ss.input,resize:"vertical",lineHeight:1.5}}/>
  : <input value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={ss.input}/>;

function RichTextEditor({value, onChange, minHeight=80}) {
  const ref = useRef(null);
  const focused = useRef(false);
  useEffect(()=>{ if(ref.current&&!focused.current) ref.current.innerHTML=value||""; },[value]);
  const exec = cmd => { ref.current.focus(); document.execCommand(cmd,false,null); setTimeout(()=>onChange(ref.current.innerHTML),10); };
  const btnStyle = extra => ({...ss.btn,fontSize:11,padding:"1px 7px",lineHeight:"18px",...extra});
  return (
    <div style={{border:"1px solid #e5e7eb",borderRadius:6,background:"#f9fafb",overflow:"hidden"}}>
      <div style={{display:"flex",gap:3,padding:"4px 6px",borderBottom:"1px solid #f3f4f6",background:"#fff",flexWrap:"wrap"}}>
        <button onMouseDown={e=>{e.preventDefault();exec("bold");}} style={btnStyle({fontWeight:700})}>B</button>
        <button onMouseDown={e=>{e.preventDefault();exec("italic");}} style={btnStyle({fontStyle:"italic"})}>I</button>
        <button onMouseDown={e=>{e.preventDefault();exec("underline");}} style={btnStyle({textDecoration:"underline"})}>U</button>
        <button onMouseDown={e=>{e.preventDefault();exec("insertUnorderedList");}} style={btnStyle({})}>• List</button>
        <button onMouseDown={e=>{e.preventDefault();exec("insertOrderedList");}} style={btnStyle({})}>1. List</button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onFocus={()=>{focused.current=true;}}
        onBlur={()=>{focused.current=false;onChange(ref.current.innerHTML);}}
        onInput={()=>onChange(ref.current.innerHTML)}
        style={{minHeight,padding:"8px 10px",fontSize:13,color:"#374151",lineHeight:1.6,outline:"none",overflowY:"auto"}}/>
    </div>
  );
}

function ResizeHandle({onResize}) {
  const dragging = useRef(false), startX = useRef(0);
  const onMouseDown = e => {
    e.preventDefault();
    dragging.current=true; startX.current=e.clientX;
    const onMove = e => { if(!dragging.current)return; const d=e.clientX-startX.current; startX.current=e.clientX; onResize(d); };
    const onUp   = () => { dragging.current=false; document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); };
    document.addEventListener("mousemove",onMove); document.addEventListener("mouseup",onUp);
  };
  return <div onMouseDown={onMouseDown} title="Drag to resize"
    style={{width:5,cursor:"col-resize",flexShrink:0,background:"transparent",transition:"background .15s",zIndex:10}}
    onMouseEnter={e=>e.currentTarget.style.background="#3b82f6"}
    onMouseLeave={e=>e.currentTarget.style.background="transparent"}/>;
}

const Overlay = ({onClose,children,wide}) => (
  <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:50,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:60}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:10,padding:"1.25rem",width:wide?680:460,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 40px rgba(0,0,0,0.15)"}}>
      {children}
    </div>
  </div>
);

const ModalH = ({title,onClose}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f3f4f6"}}>
    <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{title}</span>
    <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:18,color:"#9ca3af",lineHeight:1}}>×</button>
  </div>
);

// ─── TASK DETAIL PANEL ────────────────────────────────────────────────────────
function TaskPanel({taskId,data,onClose,saveTask,delTask,onOpenTask}) {
  const task = data.tasks.find(t=>t.id===taskId);
  if (!task) return null;
  const proj = data.projects.find(p=>p.id===task.projectId);
  const projTasks = data.tasks.filter(t=>t.projectId===task.projectId&&t.id!==taskId);
  const blocked = isBlocked(task, data.tasks);
  const appr = approvalDisplay(task);
  const [newApprName,setNewApprName] = useState("");

  const upd = ch => saveTask(taskId, ch);

  // Combined approver pool: team + global contacts
  const approverPool = [
    ...data.teamMembers.map(m=>({name:m,title:""})),
    ...(data.globalContacts||[]).map(c=>({name:c.name,title:c.title}))
  ].filter((v,i,a)=>a.findIndex(x=>x.name===v.name)===i);

  const addApprover = name => {
    if (!name) return;
    const contact = approverPool.find(c=>c.name===name);
    upd({approvalChain:[...task.approvalChain,{id:uid(),name,title:contact?.title||"",status:"pending",note:""}]});
  };
  const setApproval = (aid,status) => upd({approvalChain:task.approvalChain.map(a=>a.id===aid?{...a,status}:a)});
  const removeApprover = aid => upd({approvalChain:task.approvalChain.filter(a=>a.id!==aid)});

  return (
    <div style={{width:380,flexShrink:0,borderLeft:"1px solid #e5e7eb",background:"#fff",overflowY:"auto",maxHeight:"100%"}}>
      <div style={{padding:"12px 14px",borderBottom:"1px solid #f3f4f6",display:"flex",alignItems:"flex-start",gap:8,position:"sticky",top:0,background:"#fff",zIndex:5}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,fontWeight:600,color:"#9ca3af",textTransform:"uppercase",marginBottom:3}}>{proj?.title}</div>
          <textarea value={task.title} onChange={e=>upd({title:e.target.value})} rows={2}
            style={{width:"100%",border:"none",outline:"none",background:"transparent",fontSize:14,fontWeight:600,color:"#111827",resize:"none",lineHeight:1.4}}/>
        </div>
        <button onClick={onClose} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:18,lineHeight:1,padding:2}}>×</button>
      </div>
      <div style={{padding:"12px 14px"}}>
        {blocked && <div style={{background:"#fee2e2",color:"#991b1b",borderRadius:6,padding:"6px 10px",fontSize:11,marginBottom:12,fontWeight:500}}>⛔ Blocked by an incomplete dependency</div>}
        {appr && <div style={{background:appr.startsWith("Approved")?DC.ok.bg:DC.overdue.bg,color:appr.startsWith("Approved")?DC.ok.tx:DC.overdue.tx,borderRadius:6,padding:"6px 10px",fontSize:11,marginBottom:12,fontWeight:500}}>📋 {appr}</div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <Fld label="Status" mb={0}>
            <select value={task.status} onChange={e=>upd({status:e.target.value})} style={ss.sel}>
              {T_ST.map(s=><option key={s}>{s}</option>)}
            </select>
          </Fld>
          <Fld label="Due Date" mb={0}>
            <input type="date" value={task.dueDate||""} onChange={e=>upd({dueDate:e.target.value||null})} style={ss.sel}/>
          </Fld>
        </div>

        <Fld label="Assigned To">
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>
            {task.assignees.map(a=>(
              <span key={a} style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:"#dbeafe",color:"#1e40af",display:"flex",alignItems:"center",gap:3}}>
                {a}<button onClick={()=>upd({assignees:task.assignees.filter(x=>x!==a)})} style={{background:"transparent",border:"none",cursor:"pointer",color:"#1e40af",padding:0,fontSize:10,lineHeight:1}}>×</button>
              </span>
            ))}
          </div>
          <select value="" onChange={e=>{if(e.target.value&&!task.assignees.includes(e.target.value))upd({assignees:[...task.assignees,e.target.value]});}} style={ss.sel}>
            <option value="">+ Add assignee</option>
            {data.teamMembers.filter(m=>!task.assignees.includes(m)).map(m=><option key={m}>{m}</option>)}
          </select>
        </Fld>

        <Fld label="Dependencies">
          {task.dependsOn.length>0 && task.dependsOn.map(did=>{
            const dep=data.tasks.find(t=>t.id===did);
            return dep ? (
              <div key={did} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #f9fafb"}}>
                <span style={{fontSize:9,padding:"1px 5px",borderRadius:10,background:dep.status==="Done"?"#dcfce7":"#fee2e2",color:dep.status==="Done"?"#166534":"#991b1b"}}>
                  {dep.status==="Done"?"✓":"⏳"}
                </span>
                {onOpenTask
                  ? <button onClick={()=>onOpenTask(did)} style={{flex:1,background:"transparent",border:"none",cursor:"pointer",fontSize:12,color:"#2563eb",textAlign:"left",padding:0,textDecoration:"underline"}}>{dep.title}</button>
                  : <span style={{flex:1,fontSize:12,color:"#374151"}}>{dep.title}</span>}
                <button onClick={()=>upd({dependsOn:task.dependsOn.filter(x=>x!==did)})} style={{background:"transparent",border:"none",cursor:"pointer",color:"#d1d5db",fontSize:13}}>×</button>
              </div>
            ) : null;
          })}
          <select value="" onChange={e=>{if(e.target.value&&!task.dependsOn.includes(e.target.value))upd({dependsOn:[...task.dependsOn,e.target.value]});}} style={{...ss.sel,marginTop:4}}>
            <option value="">+ Add dependency</option>
            {projTasks.filter(t=>!task.dependsOn.includes(t.id)).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Fld>

        <Fld label="Gate / External Blocker">
          <Inp value={task.gate} onChange={v=>upd({gate:v})} placeholder="e.g. Waiting for legal confirmation..."/>
        </Fld>

        <Fld label="Notes">
          <Inp value={task.notes} onChange={v=>upd({notes:v})} placeholder="Notes..." rows={2}/>
        </Fld>

        <Fld label="Link">
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:4}}>
            <Inp value={task.link?.label||""} onChange={v=>upd({link:{...task.link,label:v}})} placeholder="Label"/>
            <Inp value={task.link?.url||""} onChange={v=>upd({link:{...task.link,url:v}})} placeholder="URL"/>
          </div>
        </Fld>

        <Fld label={`Approval Chain (${task.approvalChain.filter(a=>a.status==="approved").length}/${task.approvalChain.length} approved)`}>
          {task.approvalChain.map((a,i)=>{
            const isActive = i===0||task.approvalChain[i-1]?.status==="approved";
            return (
              <div key={a.id} style={{padding:"6px 8px",borderRadius:6,border:"1px solid #e5e7eb",marginBottom:4,background:a.status==="approved"?"#f0fdf4":a.status==="rejected"?"#fef2f2":"#fafafa"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,fontWeight:600,color:"#374151",flex:1}}>{i+1}. {a.name}</span>
                  {a.title && <span style={{fontSize:9,color:"#9ca3af"}}>{a.title}</span>}
                  <Chip text={a.status} bg={a.status==="approved"?DC.ok.bg:a.status==="rejected"?DC.overdue.bg:"#f3f4f6"} tx={a.status==="approved"?DC.ok.tx:a.status==="rejected"?DC.overdue.tx:"#6b7280"} small/>
                  {isActive && a.status==="pending" && <><button onClick={()=>setApproval(a.id,"approved")} style={{...ss.btn,fontSize:9,padding:"2px 6px",background:"#dcfce7",border:"1px solid #86efac",color:"#166534"}}>✓</button><button onClick={()=>setApproval(a.id,"rejected")} style={{...ss.btn,fontSize:9,padding:"2px 6px",background:"#fee2e2",border:"1px solid #fca5a5",color:"#991b1b"}}>✗</button></>}
                  <button onClick={()=>removeApprover(a.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:"#d1d5db",fontSize:12}}>×</button>
                </div>
              </div>
            );
          })}
          <div style={{display:"flex",gap:4,marginTop:4}}>
            <select value={newApprName} onChange={e=>setNewApprName(e.target.value)} style={{...ss.sel,flex:1}}>
              <option value="">Select approver...</option>
              {approverPool.filter(c=>!task.approvalChain.find(a=>a.name===c.name)).map(c=>(
                <option key={c.name} value={c.name}>{c.name}{c.title?` — ${c.title}`:""}</option>
              ))}
            </select>
            <button onClick={()=>{addApprover(newApprName);setNewApprName("");}} disabled={!newApprName} style={{...ss.btnPrimary,fontSize:11}}>Add</button>
          </div>
        </Fld>

        <button onClick={()=>{if(window.confirm("Delete this task?"))delTask(taskId);}} style={{width:"100%",padding:7,background:"transparent",border:"1px solid #fecaca",borderRadius:6,color:"#ef4444",fontSize:11,cursor:"pointer",marginTop:4}}>
          Delete task
        </button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({data,filter,setFilter,selTask,setSelTask,saveTask,delTask,saveUiPref}) {
  const cols = T_ST;
  const filtered = filter==="All" ? data.tasks : data.tasks.filter(t=>t.assignees.includes(filter));
  const colWidths = data.uiPrefs?.dashColWidths || INIT_COL_WIDTHS;

  const resizeCol = (col, delta) => {
    const current = colWidths[col] || 250;
    saveUiPref("dashColWidths", {...colWidths, [col]: Math.max(160, current+delta)});
  };

  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div style={{flex:1,overflowX:"auto",padding:12,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",gap:0,minWidth:"max-content",alignItems:"stretch",height:"100%",flex:1}}>
          {cols.map(col=>{
            const colTasks = filtered.filter(t=>t.status===col);
            const c = SC[col];
            const w = colWidths[col] || 250;
            return (
              <div key={col} style={{display:"flex",flexShrink:0}}>
                <div style={{width:w,background:"#f9fafb",borderRadius:8,border:"1px solid #e5e7eb",display:"flex",flexDirection:"column"}}>
                  <div style={{padding:"8px 10px 6px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #e5e7eb"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:c.dot,display:"inline-block"}}/>
                      <span style={{fontSize:12,fontWeight:700,color:"#111827"}}>{col}</span>
                    </div>
                    <span style={{fontSize:10,background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"0 6px",color:"#6b7280",fontWeight:600}}>{colTasks.length}</span>
                  </div>
                  <div style={{padding:6,display:"flex",flexDirection:"column",gap:5,flex:1,overflowY:"auto",minHeight:0}}>
                    {colTasks.map(task=>{
                      const proj = data.projects.find(p=>p.id===task.projectId);
                      const blocked = isBlocked(task, data.tasks);
                      const appr = approvalDisplay(task);
                      const dstatus = ds(task.dueDate);
                      return (
                        <div key={task.id} onClick={()=>setSelTask(selTask===task.id?null:task.id)}
                          style={{...ss.card,cursor:"pointer",border:`1.5px solid ${selTask===task.id?"#3b82f6":"#e5e7eb"}`}}>
                          {proj && <div style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:3,letterSpacing:"0.3px"}}>{proj.title}</div>}
                          <div style={{fontSize:12,color:"#111827",lineHeight:1.4,marginBottom:6}}>{task.title}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:3,alignItems:"center"}}>
                            {task.assignees.map(a=><Chip key={a} text={a} bg="#dbeafe" tx="#1e40af" small/>)}
                            {blocked && <Chip text="⛔ Blocked" bg="#fee2e2" tx="#991b1b" small/>}
                            {appr && !blocked && <Chip text="📋 Review" bg="#fef3c7" tx="#92400e" small/>}
                            {task.dueDate && dstatus && <span style={{marginLeft:"auto"}}><DueChip date={task.dueDate}/></span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <ResizeHandle onResize={d=>resizeCol(col,d)}/>
              </div>
            );
          })}
        </div>
      </div>
      {selTask && <TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={delTask} onOpenTask={setSelTask}/>}
    </div>
  );
}

// ─── CONTEXT PANEL ────────────────────────────────────────────────────────────
function ContextPanel({proj,data,saveProject,addLog,onClose,width}) {
  const [addingLog,setAddingLog] = useState(false);
  const [logText,setLogText]     = useState("");
  return (
    <div style={{flex:1,borderLeft:"1px solid #e5e7eb",display:"flex",flexDirection:"column",background:"#fff",minWidth:0}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"center",gap:8,flexShrink:0,background:"#f8faff"}}>
        <span style={{fontSize:13,fontWeight:700,flex:1,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.title}</span>
        <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:18,color:"#9ca3af",lineHeight:1,padding:2}}>×</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
        <div style={{marginBottom:20}}>
          <span style={ss.label}>Background</span>
          <RichTextEditor value={proj.background||""} onChange={v=>saveProject(proj.id,{background:v})} minHeight={120}/>
        </div>
        <div>
          <span style={ss.label}>Update Log</span>
          {addingLog ? (
            <div style={{marginBottom:10}}>
              <RichTextEditor value={logText} onChange={setLogText} minHeight={80}/>
              <div style={{display:"flex",gap:4,marginTop:6}}>
                <button onClick={()=>{if(logText.trim()){addLog(proj.id,logText);setLogText("");setAddingLog(false);}}} style={ss.btnPrimary}>Add entry</button>
                <button onClick={()=>{setAddingLog(false);setLogText("");}} style={ss.btn}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setAddingLog(true)} style={{...ss.btn,fontSize:10,marginBottom:8}}>+ Add update</button>
          )}
          {proj.updateLog.length===0&&<div style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>No updates yet.</div>}
          {proj.updateLog.map(entry=>(
            <div key={entry.id} style={{padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
              <div style={{fontSize:10,fontWeight:600,color:"#9ca3af",marginBottom:3}}>{fmt(entry.date)}</div>
              <div style={{fontSize:13,color:"#374151",lineHeight:1.6,userSelect:"text"}} dangerouslySetInnerHTML={{__html:entry.text}}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PROJECT ACCORDION ────────────────────────────────────────────────────────
function ProjectAccordion({proj,data,expanded,onToggle,saveProject,saveTask,delTask,newTask,saveContact,newContact,delContact,addLog}) {
  const [newContactF,setNCF] = useState({name:"",title:"",type:"internal",businessUnit:"",organization:"",externalType:"Media",notes:""});
  const [addingTask,setAddingTask] = useState(false);
  const [newTaskTitle,setNTT] = useState("");
  const [addingContact,setAddingContact] = useState(false);
  const [selTask,setSelTask] = useState(null);
  const tasks = data.tasks.filter(t=>t.projectId===proj.id);
  const contacts = data.contacts.filter(c=>c.projectId===proj.id);
  const pc = PC[proj.status] || {bg:"#f3f4f6",tx:"#4b5563"};

  return (
    <div style={{border:"1px solid #e5e7eb",borderRadius:8,marginBottom:8,overflow:"hidden",background:"#fff"}}>
      <div onClick={onToggle} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",background:expanded?"#f8faff":"#fff"}}>
        <span style={{fontSize:12,fontWeight:600,flex:1,color:"#111827"}}>{proj.title}</span>
        <Chip text={proj.status} bg={pc.bg} tx={pc.tx}/>
        <span style={{fontSize:11,color:"#9ca3af"}}>{proj.lead}</span>
        <span style={{fontSize:10,background:"#f3f4f6",color:"#6b7280",borderRadius:10,padding:"1px 6px",fontWeight:600}}>{tasks.length}</span>
        <span style={{color:"#9ca3af",fontSize:14,marginLeft:4}}>{expanded?"▾":"▸"}</span>
      </div>

      {expanded && (
        <div style={{borderTop:"1px solid #f3f4f6",padding:"12px 14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <Fld label="Status" mb={0}>
              <select value={proj.status} onChange={e=>saveProject(proj.id,{status:e.target.value})} style={ss.sel}>
                {P_ST.map(s=><option key={s}>{s}</option>)}
              </select>
            </Fld>
            <Fld label="Lead" mb={0}>
              <select value={proj.lead} onChange={e=>saveProject(proj.id,{lead:e.target.value})} style={ss.sel}>
                {data.teamMembers.map(m=><option key={m}>{m}</option>)}
              </select>
            </Fld>
          </div>

          <Fld label="Links">
            {proj.links.map(lnk=>(
              <div key={lnk.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <a href={lnk.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#2563eb",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lnk.label||lnk.url}</a>
                <button onClick={()=>saveProject(proj.id,{links:proj.links.filter(l=>l.id!==lnk.id)})} style={{background:"transparent",border:"none",cursor:"pointer",color:"#d1d5db",fontSize:13}}>×</button>
              </div>
            ))}
            <button onClick={()=>{const label=prompt("Link label:");const url=prompt("URL:");if(url)saveProject(proj.id,{links:[...proj.links,{id:uid(),label:label||url,url}]});}} style={{...ss.btn,fontSize:10,marginTop:2}}>+ Add link</button>
          </Fld>

          {/* Key Contacts */}
          <Fld label={`Key Contacts (${contacts.length})`}>
            {contacts.map(c=>(
              <div key={c.id} style={{padding:"6px 8px",border:"1px solid #e5e7eb",borderRadius:6,marginBottom:4,fontSize:11}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontWeight:600,color:"#111827",flex:1}}>{c.name}</span>
                  <Chip text={c.type==="internal"?"Internal":"External"} bg={c.type==="internal"?"#dbeafe":"#fef3c7"} tx={c.type==="internal"?"#1e40af":"#92400e"} small/>
                  <button onClick={()=>delContact(c.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:"#d1d5db",fontSize:13}}>×</button>
                </div>
                <div style={{color:"#6b7280",marginTop:2}}>{c.title}{c.type==="internal"&&c.businessUnit?` · ${c.businessUnit}`:""}{c.type==="external"&&c.organization?` · ${c.organization}`:""}</div>
                {c.notes && <div style={{color:"#9ca3af",fontStyle:"italic",marginTop:2}}>{c.notes}</div>}
              </div>
            ))}
            {addingContact ? (
              <div style={{border:"1px solid #e5e7eb",borderRadius:6,padding:"8px 10px",marginTop:4}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                  <Fld label="Name" mb={0}><Inp value={newContactF.name} onChange={v=>setNCF(x=>({...x,name:v}))} placeholder="Name"/></Fld>
                  <Fld label="Title" mb={0}><Inp value={newContactF.title} onChange={v=>setNCF(x=>({...x,title:v}))} placeholder="Title"/></Fld>
                  <Fld label="Type" mb={0}>
                    <select value={newContactF.type} onChange={e=>setNCF(x=>({...x,type:e.target.value}))} style={ss.sel}>
                      <option value="internal">Internal</option><option value="external">External</option>
                    </select>
                  </Fld>
                  {newContactF.type==="internal"
                    ? <Fld label="Business Unit" mb={0}><Inp value={newContactF.businessUnit} onChange={v=>setNCF(x=>({...x,businessUnit:v}))} placeholder="BU name"/></Fld>
                    : <Fld label="Type" mb={0}><select value={newContactF.externalType} onChange={e=>setNCF(x=>({...x,externalType:e.target.value}))} style={ss.sel}>{EX_T.map(t=><option key={t}>{t}</option>)}</select></Fld>
                  }
                </div>
                {newContactF.type==="external" && <Fld label="Organization" mb={6}><Inp value={newContactF.organization} onChange={v=>setNCF(x=>({...x,organization:v}))} placeholder="Organization"/></Fld>}
                <Fld label="Notes" mb={6}><Inp value={newContactF.notes} onChange={v=>setNCF(x=>({...x,notes:v}))} placeholder="Scope of responsibility..."/></Fld>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{if(newContactF.name.trim()){newContact({...newContactF,projectId:proj.id});setNCF({name:"",title:"",type:"internal",businessUnit:"",organization:"",externalType:"Media",notes:""});setAddingContact(false);}}} style={ss.btnPrimary}>Add contact</button>
                  <button onClick={()=>setAddingContact(false)} style={ss.btn}>Cancel</button>
                </div>
              </div>
            ) : <button onClick={()=>setAddingContact(true)} style={{...ss.btn,fontSize:10}}>+ Add contact</button>}
          </Fld>

          {/* Tasks Table */}
          <Fld label={`Tasks (${tasks.length})`}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{borderBottom:"1px solid #e5e7eb"}}>
                  {["Task","Assignee(s)","Status","Due","Dependency"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"4px 6px",fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map(task=>{
                  const blocked = isBlocked(task, data.tasks);
                  const depTitles = task.dependsOn.map(id=>data.tasks.find(t=>t.id===id)?.title?.slice(0,20)).filter(Boolean).join(", ");
                  return (
                    <tr key={task.id} onClick={()=>setSelTask(selTask===task.id?null:task.id)}
                      style={{borderBottom:"1px solid #f9fafb",cursor:"pointer",background:selTask===task.id?"#f0f6ff":"transparent"}}>
                      <td style={{padding:"5px 6px",maxWidth:180}}>
                        <div style={{color:"#111827",fontWeight:500}}>{task.title}</div>
                        {blocked && <span style={{fontSize:9,color:"#ef4444"}}>⛔ blocked</span>}
                        {task.gate && <div style={{fontSize:9,color:"#9ca3af",fontStyle:"italic"}}>Gate: {task.gate}</div>}
                      </td>
                      <td style={{padding:"5px 6px",whiteSpace:"nowrap"}}>{task.assignees.join(", ")}</td>
                      <td style={{padding:"5px 6px"}}><DotSt status={task.status}/></td>
                      <td style={{padding:"5px 6px",whiteSpace:"nowrap"}}>{task.dueDate?<DueChip date={task.dueDate}/>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                      <td style={{padding:"5px 6px",color:"#9ca3af",fontSize:10}}>{depTitles||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {selTask && data.tasks.find(t=>t.id===selTask)?.projectId===proj.id && (
              <div style={{marginTop:8,border:"1px solid #e5e7eb",borderRadius:8,overflow:"hidden"}}>
                <TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}}/>
              </div>
            )}
            {addingTask ? (
              <div style={{marginTop:6,display:"flex",gap:4}}>
                <input autoFocus value={newTaskTitle} onChange={e=>setNTT(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&newTaskTitle.trim()){newTask({title:newTaskTitle.trim(),projectId:proj.id,assignees:["Karl"],status:"To Plan",dueDate:null,dependsOn:[],gate:"",notes:"",link:null,approvalChain:[]});setNTT("");setAddingTask(false);}if(e.key==="Escape")setAddingTask(false);}}
                  placeholder="Task title..." style={{...ss.input,flex:1}}/>
                <button onClick={()=>setAddingTask(false)} style={ss.btn}>Cancel</button>
              </div>
            ) : (
              <button onClick={()=>setAddingTask(true)} style={{...ss.btn,marginTop:6,fontSize:10}}>+ Add task</button>
            )}
          </Fld>

          <div style={{display:"flex",gap:6,marginTop:4,paddingTop:8,borderTop:"1px solid #f3f4f6"}}>
            <button onClick={()=>{if(window.confirm(`Archive "${proj.title}"?`))saveProject(proj.id,{archived:true});}} style={{...ss.btn,fontSize:10}}>Archive</button>
            <button onClick={()=>{if(window.confirm(`Delete project "${proj.title}" and all its tasks?`)){}}} style={{...ss.btn,fontSize:10,color:"#ef4444",borderColor:"#fecaca"}}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsView({data,saveProject,saveTask,delTask,newTask,saveContact,newContact,delContact,addLog,showAddProject,saveUiPref}) {
  const [expanded,setExpanded] = useState(null);
  const [filter,setFilter] = useState("all");
  const projects = data.projects.filter(p=>!p.archived);
  const filtered = filter==="all" ? projects : projects.filter(p=>p.status===filter);
  const activeProj = expanded ? data.projects.find(p=>p.id===expanded) : null;
  const splitW = data.uiPrefs?.projectSplit || 360;

  const handleToggle = id => setExpanded(e => e===id ? null : id);

  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Left: fixed-width accordion list */}
      <div style={{width:splitW,flexShrink:0,overflowY:"auto",padding:12,borderRight:"1px solid #e5e7eb"}}>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
          {["all",...P_ST].map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{...ss.btn,background:filter===s?"#1e40af":"#fff",color:filter===s?"#fff":"#374151",border:`1px solid ${filter===s?"#1e40af":"#e5e7eb"}`}}>
              {s==="all"?"All":s}
            </button>
          ))}
          <button onClick={showAddProject} style={{...ss.btnPrimary,marginLeft:"auto"}}>+ New project</button>
        </div>
        {filtered.map(p=>(
          <ProjectAccordion key={p.id} proj={p} data={data} expanded={expanded===p.id}
            onToggle={()=>handleToggle(p.id)}
            saveProject={saveProject} saveTask={saveTask} delTask={delTask} newTask={newTask}
            saveContact={saveContact} newContact={newContact} delContact={delContact} addLog={addLog}/>
        ))}
      </div>
      {/* Resize handle */}
      {activeProj && <ResizeHandle onResize={d=>saveUiPref("projectSplit", Math.max(240, splitW+d))}/>}
      {/* Right: context panel */}
      {activeProj && <ContextPanel proj={activeProj} data={data} saveProject={saveProject} addLog={addLog} onClose={()=>setExpanded(null)}/>}
    </div>
  );
}

// ─── MY TASKS ─────────────────────────────────────────────────────────────────
function MyTasksView({data,saveTask,delTask}) {
  const [selTask,setSelTask] = useState(null);
  const [sortBy,setSortBy] = useState("status");
  const myTasks = data.tasks.filter(t=>t.assignees.includes("Karl")&&t.status!=="Done");
  const sorted = [...myTasks].sort((a,b)=>{
    if(sortBy==="date") { if(!a.dueDate&&!b.dueDate)return 0; if(!a.dueDate)return 1; if(!b.dueDate)return -1; return a.dueDate.localeCompare(b.dueDate); }
    const order = {"Urgent":0,"In Progress":1,"To Plan":2,"Waiting":3,"Done":4};
    return (order[a.status]||0)-(order[b.status]||0);
  });

  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div style={{flex:1,padding:12,overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
          <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>Karl's tasks ({myTasks.length} open)</span>
          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
            {["status","date"].map(s=><button key={s} onClick={()=>setSortBy(s)} style={{...ss.btn,background:sortBy===s?"#1e40af":"#fff",color:sortBy===s?"#fff":"#374151",border:`1px solid ${sortBy===s?"#1e40af":"#e5e7eb"}`}}>Sort by {s}</button>)}
          </div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{borderBottom:"2px solid #e5e7eb"}}>
              {["Project","Task","Status","Due","Blocker"].map(h=>(
                <th key={h} style={{textAlign:"left",padding:"4px 8px",fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(task=>{
              const proj = data.projects.find(p=>p.id===task.projectId);
              const blocked = isBlocked(task, data.tasks);
              return (
                <tr key={task.id} onClick={()=>setSelTask(selTask===task.id?null:task.id)}
                  style={{borderBottom:"1px solid #f3f4f6",cursor:"pointer",background:selTask===task.id?"#f0f6ff":"transparent"}}>
                  <td style={{padding:"6px 8px",color:"#6b7280",fontSize:11,whiteSpace:"nowrap"}}>{proj?.title}</td>
                  <td style={{padding:"6px 8px",color:"#111827",fontWeight:500}}>{task.title}</td>
                  <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}><DotSt status={task.status}/></td>
                  <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{task.dueDate?<DueChip date={task.dueDate}/>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                  <td style={{padding:"6px 8px"}}>{blocked?<Chip text="⛔ Blocked" bg="#fee2e2" tx="#991b1b" small/>:task.gate?<span style={{fontSize:10,color:"#9ca3af",fontStyle:"italic"}}>{task.gate.slice(0,30)}</span>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selTask && <TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}}/>}
    </div>
  );
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
function CalendarView({data,calView,setCalView,saveTask,delTask}) {
  const [refDate,setRefDate] = useState(TODAY);
  const [selTask,setSelTask] = useState(null);
  const yr = refDate.getFullYear(), mo = refDate.getMonth();

  const tasksByDate = useMemo(()=>{
    const map = {};
    data.tasks.filter(t=>t.dueDate&&t.status!=="Done").forEach(t=>{
      if(!map[t.dueDate]) map[t.dueDate]=[];
      map[t.dueDate].push(t);
    });
    return map;
  },[data.tasks]);

  const projForWeek = wk => {
    const dates = wk.map(toStr);
    const pids = new Set(data.tasks.filter(t=>t.dueDate&&dates.includes(t.dueDate)&&t.status!=="Done").map(t=>t.projectId));
    return data.projects.filter(p=>pids.has(p.id));
  };

  if (calView==="yearly") {
    return (
      <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div style={{flex:1,padding:12,overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setFullYear(d.getFullYear()-1);return x;})} style={ss.btn}>‹</button>
          <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{yr}</span>
          <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setFullYear(d.getFullYear()+1);return x;})} style={ss.btn}>›</button>
        </div>
        {Array.from({length:12},(_,m)=>{
          const wks = weeksOfMonth(yr,m);
          return (
            <div key={m} style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px"}}>{MONTHS[m]}</div>
              {wks.map((wk,wi)=>{
                const projs = projForWeek(wk);
                const wStart=toStr(wk[0]), wEnd=toStr(wk[6]);
                return (
                  <div key={wi} style={{display:"flex",gap:6,alignItems:"center",padding:"3px 0",borderBottom:"1px solid #f3f4f6"}}>
                    <span style={{fontSize:9,color:"#9ca3af",width:80,flexShrink:0}}>
                      {wk[0].getDate()}/{m+1} – {wk[6].getDate()}/{m+1}
                    </span>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {projs.map(p=><Chip key={p.id} text={p.title} bg="#dbeafe" tx="#1e40af" small/>)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {selTask && <TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}
      </div>
    );
  }

  if (calView==="monthly") {
    const months = [mo, (mo+1)%12];
    const years  = [yr, mo===11?yr+1:yr];
    return (
      <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div style={{flex:1,padding:12,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexShrink:0}}>
          <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setMonth(d.getMonth()-1);return x;})} style={ss.btn}>‹</button>
          <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{MONTHS[mo]} – {MONTHS[months[1]]} {yr}</span>
          <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setMonth(d.getMonth()+1);return x;})} style={ss.btn}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,flex:1,minHeight:0,overflow:"auto"}}>
          {months.map((m,mi)=>{
            const y = years[mi];
            const wks = weeksOfMonth(y,m);
            return (
              <div key={mi} style={{display:"flex",flexDirection:"column"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:6,textTransform:"uppercase"}}>{MONTHS[m]} {y}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:2}}>
                  {WD.map(d=><div key={d} style={{fontSize:11,fontWeight:600,color:"#9ca3af",textAlign:"center",padding:"3px 0"}}>{d}</div>)}
                </div>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:1}}>
                  {wks.map((wk,wi)=>(
                    <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,flex:1}}>
                      {wk.map((day,di)=>{
                        const dStr=toStr(day), isToday=dStr===TODAY_STR, inMonth=day.getMonth()===m;
                        const dayTasks=(tasksByDate[dStr]||[]).slice(0,3);
                        return (
                          <div key={di} style={{padding:"3px 4px",background:isToday?"#eff6ff":inMonth?"#fff":"#fafafa",border:`1px solid ${isToday?"#3b82f6":"#f3f4f6"}`,borderRadius:3,minHeight:52}}>
                            <div style={{fontSize:11,fontWeight:isToday?700:400,color:inMonth?"#374151":"#d1d5db",marginBottom:2}}>{day.getDate()}</div>
                            {dayTasks.map(t=>{
                              const c=SC[t.status];
                              return <div key={t.id} onClick={()=>setSelTask(selTask===t.id?null:t.id)} style={{fontSize:10,background:selTask===t.id?"#3b82f6":c.bg,color:selTask===t.id?"#fff":c.tx,borderRadius:2,padding:"1px 4px",marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer"}}>{t.title.slice(0,18)}</div>;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selTask && <TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}
      </div>
    );
  }

  // Weekly view
  const days = wkDays(refDate);
  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
    <div style={{flex:1,padding:12,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexShrink:0}}>
        <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setDate(d.getDate()-7);return x;})} style={ss.btn}>‹</button>
        <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>Week of {fmt(toStr(days[0]))} – {fmt(toStr(days[6]))}</span>
        <button onClick={()=>setRefDate(d=>{const x=new Date(d);x.setDate(d.getDate()+7);return x;})} style={ss.btn}>›</button>
        <button onClick={()=>setRefDate(TODAY)} style={{...ss.btn,fontSize:11}}>Today</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,flex:1,minHeight:0,overflow:"auto"}}>
        {days.map((day,di)=>{
          const dStr=toStr(day), isToday=dStr===TODAY_STR;
          const dayTasks = tasksByDate[dStr]||[];
          return (
            <div key={di} style={{background:isToday?"#eff6ff":"#f9fafb",border:`1px solid ${isToday?"#3b82f6":"#e5e7eb"}`,borderRadius:6,padding:"8px 8px",display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:12,fontWeight:700,color:isToday?"#1d4ed8":"#374151",marginBottom:6,flexShrink:0}}>
                {WD[di]}<br/><span style={{fontSize:14}}>{day.getDate()}</span>
              </div>
              <div style={{flex:1,overflowY:"auto",minHeight:0}}>
                {dayTasks.map(t=>{
                  const proj=data.projects.find(p=>p.id===t.projectId);
                  const c=SC[t.status];
                  return (
                    <div key={t.id} onClick={()=>setSelTask(selTask===t.id?null:t.id)} style={{background:selTask===t.id?"#eff6ff":"#fff",border:`1px solid ${selTask===t.id?"#3b82f6":"#e5e7eb"}`,borderRadius:4,padding:"5px 7px",marginBottom:4,cursor:"pointer"}}>
                      <div style={{fontSize:10,fontWeight:600,color:"#9ca3af",textTransform:"uppercase",marginBottom:1}}>{proj?.title?.slice(0,30)}</div>
                      <div style={{fontSize:12,color:"#111827",lineHeight:1.3}}>{t.title}</div>
                      <div style={{marginTop:4,display:"flex",gap:3,flexWrap:"wrap"}}>
                        {t.assignees.map(a=><Chip key={a} text={a} bg="#dbeafe" tx="#1e40af" small/>)}
                        <span style={{marginLeft:"auto"}}><Chip text={t.status} bg={c.bg} tx={c.tx} small/></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    {selTask && <TaskPanel taskId={selTask} data={data} onClose={()=>setSelTask(null)} saveTask={saveTask} delTask={id=>{delTask(id);setSelTask(null);}} onOpenTask={setSelTask}/>}
    </div>
  );
}
// ─── MODALS ───────────────────────────────────────────────────────────────────
function BriefingModal({data,onClose,setView}) {
  const urgent  = data.tasks.filter(t=>{ const s=ds(t.dueDate); return (s==="overdue"||s==="today")&&t.status!=="Done"; });
  const soon    = data.tasks.filter(t=>ds(t.dueDate)==="soon"&&t.status!=="Done");
  const Row = ({task}) => {
    const proj = data.projects.find(p=>p.id===task.projectId);
    return (
      <div style={{padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,marginBottom:5,background:"#f9fafb"}}>
        <div style={{fontSize:9,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{proj?.title}</div>
        <div style={{fontSize:12,color:"#111827",fontWeight:500}}>{task.title}</div>
        <div style={{marginTop:3,display:"flex",gap:4,alignItems:"center"}}>
          {task.assignees.map(a=><Chip key={a} text={a} bg="#dbeafe" tx="#1e40af" small/>)}
          {task.dueDate&&<span style={{marginLeft:"auto"}}><DueChip date={task.dueDate}/></span>}
        </div>
      </div>
    );
  };
  return (
    <Overlay onClose={onClose}>
      <ModalH title="Today's Briefing — May 8, 2026" onClose={onClose}/>
      {urgent.length>0&&<><div style={{fontSize:10,fontWeight:700,color:"#991b1b",textTransform:"uppercase",marginBottom:6}}>Today / Overdue ({urgent.length})</div>{urgent.map(t=><Row key={t.id} task={t}/>)}</>}
      {soon.length>0&&<><div style={{fontSize:10,fontWeight:700,color:"#92400e",textTransform:"uppercase",margin:"10px 0 6px"}}>Next 3 days ({soon.length})</div>{soon.map(t=><Row key={t.id} task={t}/>)}</>}
      {urgent.length===0&&soon.length===0&&<div style={{textAlign:"center",padding:"2rem",color:"#9ca3af",fontSize:14}}>No immediate deadlines. Clear horizon.</div>}
    </Overlay>
  );
}

function TemplatesModal({data,onClose,createFromTemplate}) {
  const [selTpl,setSelTpl] = useState(null);
  const [projName,setProjName] = useState("");
  return (
    <Overlay onClose={onClose} wide>
      <ModalH title="Project Templates" onClose={onClose}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {data.templates.map(t=>(
          <div key={t.id} onClick={()=>setSelTpl(t.id)} style={{padding:"10px 12px",border:`1.5px solid ${selTpl===t.id?"#2563eb":"#e5e7eb"}`,borderRadius:7,cursor:"pointer",background:selTpl===t.id?"#eff6ff":"#fff"}}>
            <div style={{fontSize:12,fontWeight:600,color:"#111827"}}>{t.name}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{t.description}</div>
            <div style={{fontSize:10,color:"#6b7280",marginTop:4}}>{t.taskTemplates.length} tasks</div>
          </div>
        ))}
      </div>
      {selTpl && (
        <>
          <div style={{border:"1px solid #e5e7eb",borderRadius:6,padding:"8px 10px",marginBottom:10,background:"#f9fafb"}}>
            {data.templates.find(t=>t.id===selTpl)?.taskTemplates.map((t,i)=>(
              <div key={i} style={{fontSize:11,color:"#374151",padding:"2px 0",borderBottom:"1px solid #f3f4f6"}}>{i+1}. {t.title}</div>
            ))}
          </div>
          <Fld label="New project name">
            <Inp value={projName} onChange={setProjName} placeholder="e.g. Press Conference — Budget 2026"/>
          </Fld>
          <button onClick={()=>{if(projName.trim()){createFromTemplate(selTpl,projName.trim());onClose();}}} style={ss.btnPrimary}>Create project from template</button>
        </>
      )}
    </Overlay>
  );
}

function ImportModal({onClose,onImport}) {
  const [json,setJson] = useState("");
  const [err,setErr] = useState("");
  const tryImport = () => {
    try { const d=JSON.parse(json); onImport(d); onClose(); }
    catch(e) { setErr("Invalid JSON. Please check the format and try again."); }
  };
  return (
    <Overlay onClose={onClose} wide>
      <ModalH title="Import from Notes" onClose={onClose}/>
      <div style={{background:"#f0f6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"10px 12px",marginBottom:12,fontSize:12,color:"#1e40af"}}>
        <strong>How to use:</strong> Paste your raw notes in the chat above. Claude will parse them, show you a structured preview, you confirm verbally, and Claude provides an import block to paste here.
      </div>
      <Fld label="Paste confirmed import JSON here">
        <Inp value={json} onChange={setJson} placeholder='{"projects":[...],"tasks":[...],"updates":[...]}' rows={8}/>
      </Fld>
      {err && <div style={{color:"#ef4444",fontSize:11,marginBottom:8}}>{err}</div>}
      <button onClick={tryImport} style={ss.btnPrimary}>Import</button>
    </Overlay>
  );
}

function AddProjectModal({data,onClose,onCreate}) {
  const [form,setForm] = useState({title:"",status:"Active",lead:"Karl",background:""});
  return (
    <Overlay onClose={onClose}>
      <ModalH title="New Project" onClose={onClose}/>
      <Fld label="Title"><Inp value={form.title} onChange={v=>setForm(x=>({...x,title:v}))} placeholder="Project name"/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Fld label="Status"><select value={form.status} onChange={e=>setForm(x=>({...x,status:e.target.value}))} style={ss.sel}>{P_ST.map(s=><option key={s}>{s}</option>)}</select></Fld>
        <Fld label="Lead"><select value={form.lead} onChange={e=>setForm(x=>({...x,lead:e.target.value}))} style={ss.sel}>{data.teamMembers.map(m=><option key={m}>{m}</option>)}</select></Fld>
      </div>
      <Fld label="Background"><Inp value={form.background} onChange={v=>setForm(x=>({...x,background:v}))} placeholder="Context..." rows={3}/></Fld>
      <button onClick={()=>{if(form.title.trim()){onCreate(form);onClose();}}} style={ss.btnPrimary}>Create project</button>
    </Overlay>
  );
}

function TeamModal({data,onClose,setData}) {
  const [newMember,setNewMember] = useState("");
  const [newContact,setNewContact] = useState({name:"",title:""});
  const gc = data.globalContacts||[];
  return (
    <Overlay onClose={onClose} wide>
      <ModalH title="Team & Contacts" onClose={onClose}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:8}}>Team Members</div>
          <div style={{marginBottom:10}}>
            {data.teamMembers.map(m=>(
              <div key={m} style={{display:"flex",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f3f4f6"}}>
                <span style={{flex:1,fontSize:13,color:"#111827"}}>{m}</span>
                {m!=="Karl"&&<button onClick={()=>setData(d=>({...d,teamMembers:d.teamMembers.filter(x=>x!==m)}))} style={{background:"transparent",border:"none",cursor:"pointer",color:"#d1d5db",fontSize:14}}>×</button>}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <Inp value={newMember} onChange={setNewMember} placeholder="New team member"/>
            <button onClick={()=>{if(newMember.trim()&&!data.teamMembers.includes(newMember.trim())){setData(d=>({...d,teamMembers:[...d.teamMembers,newMember.trim()]}));setNewMember("");}}} style={ss.btnPrimary}>Add</button>
          </div>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:8}}>Key Contacts (Approval Pool)</div>
          <div style={{marginBottom:10,maxHeight:200,overflowY:"auto"}}>
            {gc.length===0&&<div style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>No contacts yet.</div>}
            {gc.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f3f4f6"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#111827"}}>{c.name}</div>
                  {c.title&&<div style={{fontSize:10,color:"#6b7280"}}>{c.title}</div>}
                </div>
                <button onClick={()=>setData(d=>({...d,globalContacts:d.globalContacts.filter(x=>x.id!==c.id)}))} style={{background:"transparent",border:"none",cursor:"pointer",color:"#d1d5db",fontSize:14}}>×</button>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
            <Inp value={newContact.name} onChange={v=>setNewContact(x=>({...x,name:v}))} placeholder="Name"/>
            <Inp value={newContact.title} onChange={v=>setNewContact(x=>({...x,title:v}))} placeholder="Title / Role"/>
          </div>
          <button onClick={()=>{if(newContact.name.trim()){setData(d=>({...d,globalContacts:[...(d.globalContacts||[]),{id:uid(),...newContact}]}));setNewContact({name:"",title:""});}}} style={ss.btnPrimary}>Add contact</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data,setData]         = useState(null);
  const [view,setView]         = useState("dashboard");
  const [calView,setCalView]   = useState("monthly");
  const [filter,setFilter]     = useState("All");
  const [selTask,setSelTask]    = useState(null);
  const [saved,setSaved]       = useState(true);
  const [modal,setModal]       = useState(null); // "briefing"|"templates"|"import"|"addProject"|"team"
  const saveRef = useRef(null);
  const navigate = useNavigate();

  useEffect(()=>{
    (async()=>{
      try {
        const { data: row } = await supabase.from("planner_state").select("state").eq("id",1).maybeSingle();
        if (row?.state && Object.keys(row.state).length > 0) setData(row.state);
        else setData(INIT_STATE);
      } catch { setData(INIT_STATE); }
    })();
  },[]);

  useEffect(()=>{
    if (!data) return;
    setSaved(false);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async()=>{
      try {
        await supabase.from("planner_state").upsert({ id:1, state:data, updated_at:new Date().toISOString() });
        setSaved(true);
      } catch(e){ console.error(e); }
    },800);
  },[data]);

  const upd = fn => setData(d => ({...d,...fn(d)}));
  const saveProject  = (id,ch)  => setData(d=>({...d,projects:d.projects.map(p=>p.id===id?{...p,...ch,updatedAt:TODAY_STR}:p)}));
  const saveTask     = (id,ch)  => setData(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,...ch}:t)}));
  const delTask      = id       => setData(d=>({...d,tasks:d.tasks.filter(t=>t.id!==id)}));
  const newTask      = t        => setData(d=>({...d,tasks:[...d.tasks,{id:uid(),...t}]}));
  const saveContact  = (id,ch)  => setData(d=>({...d,contacts:d.contacts.map(c=>c.id===id?{...c,...ch}:c)}));
  const newContact   = c        => setData(d=>({...d,contacts:[...d.contacts,{id:uid(),...c}]}));
  const delContact   = id       => setData(d=>({...d,contacts:d.contacts.filter(c=>c.id!==id)}));
  const addLog       = (pid,txt)=> setData(d=>({...d,projects:d.projects.map(p=>p.id===pid?{...p,updateLog:[{id:uid(),date:TODAY_STR,text:txt},...p.updateLog],updatedAt:TODAY_STR}:p)}));

  const createFromTemplate = (tplId,title) => {
    const tpl = data.templates.find(t=>t.id===tplId);
    if (!tpl) return;
    const pid = uid();
    const newProj = {id:pid,title,status:"Active",lead:"Karl",background:tpl.description,archived:false,updatedAt:TODAY_STR,links:[],updateLog:[]};
    const newTasks = tpl.taskTemplates.map(tt=>({id:uid(),projectId:pid,...tt,dueDate:null,dependsOn:[],link:null,approvalChain:[]}));
    setData(d=>({...d,projects:[...d.projects,newProj],tasks:[...d.tasks,...newTasks]}));
  };

  const saveUiPref  = (key,val) => setData(d=>({...d,uiPrefs:{...(d.uiPrefs||{}), [key]:val}}));

  const handleImport = (imp) => {
    setData(d=>{
      let nd = {...d};
      if (imp.projects) nd.projects = [...nd.projects,...imp.projects.map(p=>({id:uid(),archived:false,updatedAt:TODAY_STR,links:[],updateLog:[],...p}))];
      if (imp.tasks)    nd.tasks    = [...nd.tasks,...imp.tasks.map(t=>({id:uid(),approvalChain:[],dependsOn:[],assignees:[],link:null,notes:"",gate:"",...t}))];
      if (imp.updates)  imp.updates.forEach(u=>{const p=nd.projects.find(x=>x.id===u.projectId||x.title===u.projectTitle);if(p)p.updateLog=[{id:uid(),date:TODAY_STR,text:u.text},...(p.updateLog||[])];});
      if (imp.backgroundUpdates) imp.backgroundUpdates.forEach(bu=>{const p=nd.projects.find(x=>x.id===bu.projectId||x.title===bu.projectTitle);if(p)p.background=bu.background;});
      return nd;
    });
  };

  if (!data) return <div style={{padding:"2rem",textAlign:"center",color:"#9ca3af",fontSize:14}}>Loading...</div>;

  const urgentCount = data.tasks.filter(t=>{ const s=ds(t.dueDate); return (s==="overdue"||s==="today")&&t.status!=="Done"; }).length;
  const doneCount   = data.tasks.filter(t=>t.status==="Done").length;

  const NAV = [
    {id:"dashboard",label:"Dashboard"},
    {id:"projects",  label:"Projects"},
    {id:"mytasks",   label:"My Tasks"},
    {id:"calendar",  label:"Calendar"},
  ];

  return (
    <div style={{fontFamily:"system-ui,sans-serif",height:"100vh",display:"flex",flexDirection:"column",background:"#f3f4f6",overflow:"hidden"}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid #e5e7eb",padding:"0 14px",display:"flex",alignItems:"center",gap:0,flexShrink:0,height:46}}>
        <button onClick={()=>navigate("/")} title="Back to hub" style={{
          background:"#1e3a5f",border:"none",borderRadius:6,padding:"4px 10px",
          fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",marginRight:10,letterSpacing:"-0.3px"
        }}>KH</button>
        <div style={{display:"flex",gap:2,marginRight:12}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)} style={{padding:"4px 12px",fontSize:12,fontWeight:600,border:"none",background:"transparent",cursor:"pointer",color:view===n.id?"#1d4ed8":"#6b7280",borderBottom:`2px solid ${view===n.id?"#2563eb":"transparent"}`,borderRadius:0}}>
              {n.label}
            </button>
          ))}
        </div>
        {view==="calendar"&&(
          <div style={{display:"flex",gap:3,marginRight:10}}>
            {["yearly","monthly","weekly"].map(cv=>(
              <button key={cv} onClick={()=>setCalView(cv)} style={{...ss.btn,fontSize:10,background:calView===cv?"#1e40af":"#fff",color:calView===cv?"#fff":"#374151",border:`1px solid ${calView===cv?"#1e40af":"#e5e7eb"}`,textTransform:"capitalize"}}>
                {cv}
              </button>
            ))}
          </div>
        )}
        {view==="dashboard"&&(
          <div style={{marginRight:8}}>
            <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...ss.sel,width:"auto",fontSize:11,padding:"3px 8px"}}>
              {["All",...data.teamMembers].map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
        <div style={{width:1,height:20,background:"#e5e7eb",margin:"0 16px 0 8px",flexShrink:0}}/>
        <span style={{fontSize:10,color:"#9ca3af",marginRight:10}}>{doneCount}/{data.tasks.length} done</span>
        <button onClick={()=>setModal("briefing")} style={{...ss.btn,fontSize:11,marginRight:4,position:"relative"}}>
          ☀ Briefing
          {urgentCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#ef4444",color:"#fff",borderRadius:10,fontSize:8,padding:"0 4px",fontWeight:700}}>{urgentCount}</span>}
        </button>
        <button onClick={()=>setModal("templates")} style={{...ss.btn,fontSize:11,marginRight:4}}>Templates</button>
        <button onClick={()=>setModal("import")} style={{...ss.btn,fontSize:11,marginRight:4}}>From Notes</button>
        <button onClick={()=>setModal("team")} style={{...ss.btn,fontSize:11,marginRight:6}}>Team</button>
        <span style={{fontSize:10,color:saved?"#22c55e":"#9ca3af"}}>{saved?"✓ Saved":"..."}</span>
        <button onClick={()=>{if(window.confirm("Reset all data to defaults?"))setData(INIT_STATE);}} title="Reset" style={{...ss.btn,marginLeft:6,fontSize:10,padding:"2px 6px"}}>↺</button>
      </div>

      {/* Body */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {view==="dashboard" && <Dashboard data={data} filter={filter} setFilter={setFilter} selTask={selTask} setSelTask={setSelTask} saveTask={saveTask} delTask={delTask} saveUiPref={saveUiPref}/>}
        {view==="projects"  && <div style={{flex:1,overflow:"hidden",display:"flex"}}><ProjectsView data={data} saveProject={saveProject} saveTask={saveTask} delTask={delTask} newTask={newTask} saveContact={saveContact} newContact={newContact} delContact={delContact} addLog={addLog} showAddProject={()=>setModal("addProject")} saveUiPref={saveUiPref}/></div>}
        {view==="mytasks"   && <MyTasksView data={data} saveTask={saveTask} delTask={delTask}/>}
        {view==="calendar"  && <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}><CalendarView data={data} calView={calView} setCalView={setCalView} saveTask={saveTask} delTask={delTask}/></div>}
      </div>

      {/* Modals */}
      {modal==="briefing"   && <BriefingModal data={data} onClose={()=>setModal(null)} setView={setView}/>}
      {modal==="templates"  && <TemplatesModal data={data} onClose={()=>setModal(null)} createFromTemplate={createFromTemplate}/>}
      {modal==="import"     && <ImportModal onClose={()=>setModal(null)} onImport={handleImport}/>}
      {modal==="addProject" && <AddProjectModal data={data} onClose={()=>setModal(null)} onCreate={p=>setData(d=>({...d,projects:[...d.projects,{id:uid(),archived:false,updatedAt:TODAY_STR,links:[],updateLog:[],...p}]}))}/>}
      {modal==="team"       && <TeamModal data={data} onClose={()=>setModal(null)} setData={setData}/>}
    </div>
  );
}

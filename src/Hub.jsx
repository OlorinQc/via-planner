import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";

const APPS = [
  {
    id: "via-planner",
    path: "/via-planner",
    label: "VIA Planner",
    description: "Projects, tasks, calendar and team management",
    icon: "🚆",
    color: "#1e3a5f",
    light: "#dbeafe",
  },
  // Future apps go here
];

const COMING_SOON = [
  { label: "House Manager", icon: "🏠", description: "Renovation tracking and budgets" },
  { label: "Finance Tracker", icon: "💰", description: "Budget sheets and bank summaries" },
];

export default function Hub() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{
      minHeight:"100vh", background:"#f3f4f6",
      fontFamily:"system-ui,sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background:"#1e3a5f", padding:"0 24px",
        display:"flex", alignItems:"center", height:52, gap:12
      }}>
        <div style={{
          width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.15)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:13, fontWeight:800, color:"#fff", letterSpacing:"-0.5px"
        }}>KH</div>
        <span style={{fontSize:15,fontWeight:700,color:"#fff",flex:1}}>KH Tools</span>
        <button onClick={handleSignOut} style={{
          background:"transparent", border:"1px solid rgba(255,255,255,0.25)",
          borderRadius:6, padding:"4px 12px", fontSize:11, color:"rgba(255,255,255,0.8)",
          cursor:"pointer", fontWeight:500
        }}>Sign out</button>
      </div>

      {/* Content */}
      <div style={{maxWidth:800, margin:"0 auto", padding:"40px 24px"}}>
        <div style={{marginBottom:32}}>
          <div style={{fontSize:22,fontWeight:700,color:"#111827",marginBottom:6}}>Your tools</div>
          <div style={{fontSize:13,color:"#6b7280"}}>Select an app to get started.</div>
        </div>

        {/* Active apps */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16,marginBottom:40}}>
          {APPS.map(app=>(
            <div key={app.id} onClick={()=>navigate(app.path)}
              style={{
                background:"#fff", borderRadius:12, padding:"20px",
                border:"1px solid #e5e7eb", cursor:"pointer",
                transition:"box-shadow .15s, transform .15s",
                boxShadow:"0 1px 3px rgba(0,0,0,0.06)"
              }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)";e.currentTarget.style.transform="translateY(0)";}}
            >
              <div style={{
                width:44, height:44, borderRadius:10,
                background:app.light, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:22, marginBottom:14
              }}>{app.icon}</div>
              <div style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:4}}>{app.label}</div>
              <div style={{fontSize:12,color:"#6b7280",lineHeight:1.5}}>{app.description}</div>
              <div style={{marginTop:14,fontSize:11,fontWeight:600,color:app.color}}>Open →</div>
            </div>
          ))}
        </div>

        {/* Coming soon */}
        {COMING_SOON.length > 0 && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>
              Coming soon
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16}}>
              {COMING_SOON.map(app=>(
                <div key={app.label} style={{
                  background:"#fff", borderRadius:12, padding:"20px",
                  border:"1px solid #e5e7eb", opacity:0.5
                }}>
                  <div style={{
                    width:44, height:44, borderRadius:10,
                    background:"#f3f4f6", display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:22, marginBottom:14
                  }}>{app.icon}</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:4}}>{app.label}</div>
                  <div style={{fontSize:12,color:"#6b7280",lineHeight:1.5}}>{app.description}</div>
                  <div style={{marginTop:14,fontSize:11,fontWeight:500,color:"#9ca3af"}}>Not yet available</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

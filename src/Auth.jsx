import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleLogin = async e => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg,#1e3a5f 0%,#0f2027 100%)",
      fontFamily:"system-ui,sans-serif"
    }}>
      <div style={{
        background:"#fff", borderRadius:14, padding:"2.5rem 2rem",
        width:340, boxShadow:"0 24px 60px rgba(0,0,0,0.35)"
      }}>
        {/* Logo area */}
        <div style={{textAlign:"center",marginBottom:"1.75rem"}}>
          <div style={{
            width:52, height:52, borderRadius:14, background:"#1e3a5f",
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            marginBottom:12
          }}>
            <span style={{color:"#fff",fontWeight:800,fontSize:20,letterSpacing:"-1px"}}>KH</span>
          </div>
          <div style={{fontSize:20,fontWeight:700,color:"#111827",marginBottom:4}}>KH Tools</div>
          <div style={{fontSize:13,color:"#6b7280"}}>Sign in to continue</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:5}}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="you@example.com" required autoFocus
              style={{width:"100%",padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:8,
                fontSize:13,color:"#111827",background:"#f9fafb",outline:"none",boxSizing:"border-box"}}
            />
          </div>

          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:5}}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{width:"100%",padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:8,
                fontSize:13,color:"#111827",background:"#f9fafb",outline:"none",boxSizing:"border-box"}}
            />
          </div>

          {error && (
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,
              padding:"8px 12px",fontSize:12,color:"#991b1b",marginBottom:14}}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width:"100%", padding:"10px", borderRadius:8, border:"none",
            background: loading ? "#93c5fd" : "#1e3a5f",
            color:"#fff", fontSize:13, fontWeight:600, cursor: loading ? "not-allowed" : "pointer",
            transition:"background .2s"
          }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

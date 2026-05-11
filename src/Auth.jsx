import { useState } from "react";
import { supabase } from "./supabase";
import doorNoKarlOSImg from "./assets/KarlOS_Door_NoKarlOS1.png";
import "./Hub.css";

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
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success, onAuthStateChange fires in main.jsx which switches to Hub immediately
  };

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    background: "rgba(6,6,8,0.75)",
    border: "1px solid rgba(180,180,200,0.2)",
    borderRadius: 7,
    fontSize: 13,
    color: "#dddde8",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    display: "block",
    fontSize: 10,
    fontWeight: 600,
    color: "#56565e",
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    marginBottom: 6,
  };

  return (
    <div className="hub-root">

      {/* Door pane — identical layout to Hub */}
      <div className="hub-door-pane" style={{ position: "relative" }}>
        <img src={doorNoKarlOSImg} alt="" className="hub-door-img" />

        {/* Login form — centered over the door */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          width: 252,
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 15,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontStyle: "italic",
            background: "linear-gradient(130deg, #dddde8 0%, #8c8ca0 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 28,
          }}>
            Speak, friend, and enter
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14, textAlign: "left" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(180,180,200,0.45)"}
                onBlur={e  => e.target.style.borderColor = "rgba(180,180,200,0.2)"}
              />
            </div>

            <div style={{ marginBottom: 22, textAlign: "left" }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(180,180,200,0.45)"}
                onBlur={e  => e.target.style.borderColor = "rgba(180,180,200,0.2)"}
              />
            </div>

            {error && (
              <div style={{
                fontSize: 11, color: "#a87070", letterSpacing: "0.04em",
                marginBottom: 14, textAlign: "left",
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%",
              padding: "9px",
              background: "rgba(6,6,8,0.9)",
              border: "1px solid rgba(180,180,200,0.22)",
              borderRadius: 7,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: loading ? "#36363e" : "#9090a4",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "border-color 0.2s, color 0.2s",
            }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = "rgba(180,180,200,0.5)"; e.currentTarget.style.color = "#dddde8"; }}}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(180,180,200,0.22)"; e.currentTarget.style.color = loading ? "#36363e" : "#9090a4"; }}
            >
              {loading ? "···" : "Mellon"}
            </button>
          </form>
        </div>
      </div>

      {/* Right pane — empty placeholder to match Hub proportions */}
      <div style={{ flex: 1 }} />

    </div>
  );
}

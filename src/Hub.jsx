import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import doorImg from "./assets/KarlOS_Door1.png";
import doorNoKarlOSImg from "./assets/KarlOS_Door_NoKarlOS1.png";
import "./Hub.css";

const apps = [
  {
    id: "planner",
    title: "Work Planner",
    desc: "Plan work, deadlines, and projects.",
    route: "/planner",
    active: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <line x1="14" y1="17.5" x2="20" y2="17.5" />
        <line x1="17" y1="14" x2="17" y2="21" />
      </svg>
    ),
  },
  {
    id: "palantir",
    title: "Palantír",
    desc: "File control · deliverables · team workload",
    route: "/palantir",
    active: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="12" cy="12" rx="9" ry="9" />
        <ellipse cx="12" cy="12" rx="4" ry="4" />
        <line x1="12" y1="3" x2="12" y2="8" />
        <line x1="12" y1="16" x2="12" y2="21" />
        <line x1="3" y1="12" x2="8" y2="12" />
        <line x1="16" y1="12" x2="21" y2="12" />
      </svg>
    ),
  },
  {
    id: "palantir2",
    title: "Palantír v2",
    desc: "2.0 rebuild · Today, Files, Activity (preview)",
    route: "/palantir2",
    active: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="12" cy="12" rx="9" ry="9" />
        <ellipse cx="12" cy="12" rx="4" ry="4" />
        <line x1="12" y1="3" x2="12" y2="8" />
        <line x1="12" y1="16" x2="12" y2="21" />
        <line x1="3" y1="12" x2="8" y2="12" />
        <line x1="16" y1="12" x2="21" y2="12" />
        <line x1="15.5" y1="15.5" x2="18.5" y2="18.5" />
      </svg>
    ),
  },
  {
    id: "durins-works",
    title: "Durin's Works",
    desc: "Renovation plans · shopping runs · seasonal upkeep",
    route: "/durins-works",
    active: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "celebrimbors-ruler",
    title: "Celebrimbor's Ruler",
    desc: "Measure rooms from a single photo.",
    route: "/celebrimbors-ruler",
    active: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="9" width="20" height="6" rx="1" />
        <line x1="6" y1="9" x2="6" y2="12" />
        <line x1="10" y1="9" x2="10" y2="11" />
        <line x1="14" y1="9" x2="14" y2="11" />
        <line x1="18" y1="9" x2="18" y2="12" />
      </svg>
    ),
  },
];

export default function Hub({ unlocking = false }) {
  const navigate = useNavigate();
  // If not unlocking (normal load), show immediately. If unlocking, start hidden then reveal.
  const [revealed, setRevealed] = useState(!unlocking);

  useEffect(() => {
    if (unlocking) {
      // Trigger CSS transition after first paint
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setRevealed(true))
      );
      return () => cancelAnimationFrame(raf);
    }
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const revealTransition = "opacity 1s ease";

  return (
    <div className="hub-root">

      {/* Door pane with stacked images */}
      <div className="hub-door-pane" style={{ position: "relative" }}>
        {/* Base door — always visible */}
        <img src={doorNoKarlOSImg} alt="" className="hub-door-img" />
        {/* KarlOS door — fades in on reveal */}
        <img src={doorImg} alt="KarlOS" style={{
          position: "absolute",
          inset: 0,
          margin: "auto",
          maxHeight: "85vh",
          maxWidth: "100%",
          objectFit: "contain",
          mixBlendMode: "lighten",
          userSelect: "none",
          pointerEvents: "none",
          opacity: revealed ? 0.92 : 0,
          transition: unlocking ? revealTransition : "none",
        }} />
      </div>

      {/* Cards pane — fades in on reveal */}
      <div className="hub-cards-pane" style={{
        opacity: revealed ? 1 : 0,
        transition: unlocking ? revealTransition : "none",
      }}>
        <div className="hub-cards-list">
          {apps.map((app) => (
            <button
              key={app.id}
              className={`hub-card${app.active ? "" : " hub-card-soon"}`}
              onClick={() => app.active && navigate(app.route)}
              disabled={!app.active}
            >
              <div className="hub-card-header">
                <span className="hub-card-icon" style={app.active ? undefined : { opacity: 0.25 }}>{app.icon}</span>
                <span className="hub-card-title" style={app.active ? undefined : { opacity: 0.25 }}>{app.title}</span>
                {!app.active && <span className="hub-soon-badge">Soon</span>}
              </div>
              <div className="hub-card-desc" style={app.active ? undefined : { opacity: 0.25 }}>{app.desc}</div>
            </button>
          ))}

          <div className="hub-card hub-card-soon">
            <div className="hub-card-header">
              <span className="hub-card-icon" style={{ opacity: 0.25 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <span className="hub-card-title" style={{ opacity: 0.25 }}>Coming soon</span>
              <span className="hub-soon-badge">+ More</span>
            </div>
            <div className="hub-card-desc" style={{ opacity: 0.25 }}>Your next tool.</div>
          </div>
        </div>

        <button className="hub-sign-out" onClick={handleSignOut}>Sign out</button>
      </div>

    </div>
  );
}

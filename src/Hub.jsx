import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import doorImg from "./assets/KarlOS_Door.png";
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
    id: "house",
    title: "House Manager",
    desc: "Track renovations and maintenance.",
    route: "/house",
    active: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export default function Hub() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="hub-root">
      <div className="hub-door-pane">
        <img src={doorImg} alt="KarlOS Door" className="hub-door-img" />
      </div>

      <div className="hub-cards-pane">
        <div className="hub-cards-list">
          {apps.map((app) => (
            <button
              key={app.id}
              className="hub-card"
              onClick={() => app.active && navigate(app.route)}
            >
              <div className="hub-card-header">
                <span className="hub-card-icon">{app.icon}</span>
                <span className="hub-card-title">{app.title}</span>
              </div>
              <div className="hub-card-desc">{app.desc}</div>
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

        <button className="hub-sign-out" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}

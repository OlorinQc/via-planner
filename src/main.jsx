import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase";
import Auth from "./Auth";
import Hub from "./Hub";
import ViaPlanner from "./apps/ViaPlanner/App";
import PalantirApp from "./apps/Palantir/App";
import DurinsWorksApp from "./apps/Durin's Works/App";

function AppRouter({ unlocking }) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Hub unlocking={unlocking} />} />
        <Route path="/planner" element={<ViaPlanner />} />
        <Route path="/palantir" element={<PalantirApp />} />
	<Route path="/durins-works" element={<DurinsWorksApp />} />
        {/* /house will be added when House Manager is ready */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function Root() {
  const [session,   setSession]   = useState(undefined);
  const [unlocking, setUnlocking] = useState(false);
  const initialDone = useRef(false);

  useEffect(() => {
    // Restore existing session silently — no animation
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      initialDone.current = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!initialDone.current) return; // handled by getSession above

        if (_event === "SIGNED_IN" && session) {
          // Switch to Hub immediately; Hub handles the 1s reveal animation
          setUnlocking(true);
          setSession(session);
        } else if (_event === "SIGNED_OUT") {
          setUnlocking(false);
          setSession(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Initial load — black screen while checking session
  if (session === undefined) {
    return <div style={{ height: "100vh", background: "#060608" }} />;
  }

  if (!session) {
    return <Auth />;
  }

  return <AppRouter unlocking={unlocking} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

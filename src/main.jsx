import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase";
import Auth from "./Auth";
import Hub from "./Hub";
import ViaPlanner from "./apps/ViaPlanner/App";

function AppRouter({ session }) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/planner" element={<ViaPlanner />} />
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
    // Restore existing session silently (no animation)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      initialDone.current = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!initialDone.current) return; // handled by getSession above

        if (_event === "SIGNED_IN" && session) {
          // Fresh login — play door animation before switching to Hub
          setUnlocking(true);
          setTimeout(() => {
            setSession(session);
            setUnlocking(false);
          }, 950);
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

  // Not logged in, or in the middle of the unlock animation
  if (!session || unlocking) {
    return <Auth unlocking={unlocking} />;
  }

  return <AppRouter session={session} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

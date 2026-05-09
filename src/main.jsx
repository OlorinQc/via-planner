import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase";
import Auth from "./Auth";
import Hub from "./Hub";
import ViaPlanner from "./apps/ViaPlanner/App";

function AppRouter() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
        background:"#0f2027",fontFamily:"system-ui,sans-serif"}}>
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>Loading…</div>
      </div>
    );
  }

  if (!session) return <Auth />;

  return (
    <Routes>
      <Route path="/"            element={<Hub />} />
      <Route path="/via-planner" element={<ViaPlanner />} />
      <Route path="*"            element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>
);

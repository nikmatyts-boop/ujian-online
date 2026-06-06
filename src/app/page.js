"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/db";
import LoginView from "@/components/LoginView";
import AdminDashboard from "@/components/AdminDashboard";
import GuruDashboard from "@/components/GuruDashboard";
import MuridDashboard from "@/components/MuridDashboard";
import OrangTuaDashboard from "@/components/OrangTuaDashboard";

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const currentUserRef = useRef(null);

  // Keep ref in sync for use in beforeunload
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Restore session from localStorage on load
  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = localStorage.getItem("exam_active_user");
      if (savedUser) {
        const user = JSON.parse(savedUser);
        // Re-mark as online in DB in case tab was closed without logout
        const logs = await db.get("loginLogs");
        const existing = logs.find(l => l.username === user.username);
        const newLog = {
          ...(existing || {}),
          username: user.username,
          nama: user.nama,
          role: user.role,
          loginTime: existing?.loginTime || new Date().toLocaleTimeString(),
          isOnline: true,
        };
        await db.save("loginLogs", newLog);
        setCurrentUser(user);
      }
      setIsRestoring(false);
    };
    restoreSession();

    // Mark user as offline when tab/browser is closed
    const handleBeforeUnload = async () => {
      const user = currentUserRef.current;
      if (user) {
        // Use sendBeacon for reliable fire-and-forget on tab close
        // But since we use Supabase REST, we do a best-effort fetch
        const logs = await db.get("loginLogs");
        const idx = logs.findIndex(l => l.username === user.username);
        if (idx > -1) {
          logs[idx].isOnline = false;
          await db.save("loginLogs", logs[idx]);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem("exam_active_user", JSON.stringify(user));
  };

  const handleLogout = async () => {
    if (currentUser) {
      const logs = await db.get("loginLogs");
      const idx = logs.findIndex((l) => l.username === currentUser.username);
      if (idx > -1) {
        logs[idx].isOnline = false;
        await db.save("loginLogs", logs[idx]);
        db.notify("LOGIN_CHANGE", { username: currentUser.username, status: "offline" });
      }
    }

    setCurrentUser(null);
    localStorage.removeItem("exam_active_user");
  };

  // Show nothing while restoring session to avoid flicker
  if (isRestoring) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Memulai aplikasi...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  switch (currentUser.role) {
    case "admin":
      return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
    case "guru":
      return <GuruDashboard user={currentUser} onLogout={handleLogout} />;
    case "murid":
      return <MuridDashboard user={currentUser} onLogout={handleLogout} />;
    case "ortu":
      return <OrangTuaDashboard user={currentUser} onLogout={handleLogout} />;
    default:
      return (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2>Role tidak dikenali.</h2>
          <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
        </div>
      );
  }
}

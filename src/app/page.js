"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import LoginView from "@/components/LoginView";
import AdminDashboard from "@/components/AdminDashboard";
import GuruDashboard from "@/components/GuruDashboard";
import MuridDashboard from "@/components/MuridDashboard";
import OrangTuaDashboard from "@/components/OrangTuaDashboard";

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null);

  // Restore session from localStorage on load
  useEffect(() => {
    const savedUser = localStorage.getItem("exam_active_user");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
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

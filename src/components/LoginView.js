"use client";

import { useState } from "react";
import { db } from "@/lib/db";

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username dan password tidak boleh kosong.");
      return;
    }

    const users = await db.get("users");
    const user = users.find(
      (u) => u.username === username.trim() && u.password === password.trim()
    );

    if (user) {
      // Check if murid is already logged in on another device
      const logs = await db.get("loginLogs");
      const existingLogIdx = logs.findIndex((l) => l.username === user.username);

      if (user.role === "murid" && existingLogIdx > -1 && logs[existingLogIdx].isOnline) {
        setError("Akun ini sudah login di perangkat lain. Silakan logout dari perangkat sebelumnya terlebih dahulu, atau hubungi Guru/Admin.");
        return;
      }
      
      const newLog = {
        username: user.username,
        nama: user.nama,
        role: user.role,
        loginTime: new Date().toLocaleTimeString(),
        isOnline: true,
      };

      if (existingLogIdx > -1) {
        logs[existingLogIdx] = newLog;
      } else {
        logs.push(newLog);
      }
      
      await db.save("loginLogs", newLog);
      db.notify("LOGIN_CHANGE", { username: user.username, status: "online" });
      
      onLoginSuccess(user);
    } else {
      setError("Username atau password salah.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", letterSpacing: "-0.5px" }}>
            EXAM<span style={{ color: "var(--color-primary)" }}>PRO</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Portal Ujian Sekolah Modern & Real-Time
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid var(--color-danger)",
              color: "var(--color-danger)",
              padding: "12px",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              marginBottom: "20px",
              fontWeight: "500",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username (NIP / NISN / Ortu User)</label>
            <input
              type="text"
              id="username"
              className="form-control"
              placeholder="Masukkan username Anda"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
            Masuk ke Dashboard
          </button>
        </form>

        <div style={{ marginTop: "24px", borderTop: "1px solid var(--card-border)", paddingTop: "16px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", marginBottom: "8px" }}>
            KUNCI LOGIN UJI COBA (PASSWORD SAMA DENGAN USERNAME):
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", color: "var(--text-secondary)" }}>
            <div><strong>Admin:</strong> admin</div>
            <div><strong>Guru:</strong> 19700101</div>
            <div><strong>Murid 1:</strong> 1001001</div>
            <div><strong>Murid 2:</strong> 1001002</div>
            <div style={{ gridColumn: "span 2" }}><strong>Orang Tua:</strong> ortu_alfi</div>
          </div>
        </div>
      </div>
    </div>
  );
}

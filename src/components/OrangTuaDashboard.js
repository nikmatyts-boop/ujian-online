"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";

export default function OrangTuaDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const init = async () => {
      await loadData();
    };
    init();

    // Reload data if submissions happen
    const unsubscribe = db.subscribe(async (msg) => {
      if (msg.type === "EXAM_SUBMITTED") {
        await loadData();
      }
    });

    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    const [allUsers, allExams, allSessions, allSubjects] = await Promise.all([
      db.get("users"),
      db.get("exams"),
      db.get("sessions"),
      db.get("subjects")
    ]);

    // Find children
    const child = allUsers.find(u => u.username === user.studentNisn);
    setStudent(child);

    if (child) {
      // Filter finished sessions for this student
      const studentSessions = allSessions.filter(
        s => s.nisn === child.username && s.isFinished
      );
      setSessions(studentSessions);
    }

    setExams(allExams);
    setSubjects(allSubjects);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          EXAM<span>PRO</span>
        </div>
        <ul className="sidebar-menu">
          <li className="sidebar-item active">Pantau Nilai Anak</li>
        </ul>
        <div className="sidebar-footer">
          <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
            Orang Tua: <strong>{user.nama}</strong>
          </div>
          <button className="btn btn-danger" style={{ width: "100%", padding: "8px 16px" }} onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header-bar">
          <div className="page-title">
            <h1>Portal Orang Tua</h1>
            <p>Memantau hasil perkembangan belajar dan nilai ujian anak Anda.</p>
          </div>
          <div className="user-profile-badge">
            <span className="user-role-tag">Orang Tua</span>
            <span>{user.nama}</span>
          </div>
        </header>

        {student ? (
          <div className="glass-card" style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Informasi Anak</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "16px" }}>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase" }}>Nama Siswa</p>
                <strong style={{ fontSize: "16px" }}>{student.nama}</strong>
              </div>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase" }}>NISN</p>
                <strong>{student.username}</strong>
              </div>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase" }}>Nomor HP</p>
                <span>{student.hp || "-"}</span>
              </div>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase" }}>Alamat</p>
                <span>{student.alamat || "-"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ marginBottom: "24px", color: "var(--color-danger)" }}>
            Data profil murid dengan NISN {user.studentNisn} tidak ditemukan. Hubungi admin sekolah.
          </div>
        )}

        <div className="glass-card">
          <h3 style={{ marginBottom: "16px" }}>Daftar Nilai Ujian</h3>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nama Ujian</th>
                  <th>Mata Pelajaran</th>
                  <th>Jawaban Benar</th>
                  <th>Jawaban Salah</th>
                  <th>Waktu Selesai</th>
                  <th>Nilai Akhir</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const exam = exams.find(e => e.id === s.examId);
                  const sub = subjects.find(su => su.id === exam?.subjectId);
                  if (!exam) return null;

                  const totalQuestions = exam.questions.length;
                  const score = Math.round((s.correct / totalQuestions) * 100);

                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: "600" }}>{exam.title}</td>
                      <td>{sub?.name || "Mata Pelajaran"}</td>
                      <td style={{ color: "var(--color-success)", fontWeight: "bold" }}>{s.correct}</td>
                      <td style={{ color: "var(--color-danger)", fontWeight: "bold" }}>{s.incorrect}</td>
                      <td>{s.endTime || "-"}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 12px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: score >= 70 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            color: score >= 70 ? "var(--color-success)" : "var(--color-danger)",
                            fontWeight: "800",
                            fontSize: "16px"
                          }}
                        >
                          {score}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                      Belum ada nilai ujian yang terekam untuk anak Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

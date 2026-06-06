"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";

export default function GuruDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");

  // Data States
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [exitRequests, setExitRequests] = useState([]);

  // Create Exam Form
  const [examTitle, setExamTitle] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("");
  const [examEndTime, setExamEndTime] = useState("");
  const [examRandom, setExamRandom] = useState(false);
  const [examIsMakeup, setExamIsMakeup] = useState(false);
  const [examAllowedStudents, setExamAllowedStudents] = useState([]);
  const [examExcludedStudents, setExamExcludedStudents] = useState([]);
  const [questions, setQuestions] = useState([
    { text: "", options: ["", "", "", ""], answer: 0 }
  ]);

  // Read Exam Modal (Lihat Soal)
  const [viewingExam, setViewingExam] = useState(null);

  // Edit Exam State (CRUD - Update)
  const [editingExam, setEditingExam] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editRandom, setEditRandom] = useState(false);
  const [editIsMakeup, setEditIsMakeup] = useState(false);
  const [editAllowedStudents, setEditAllowedStudents] = useState([]);
  const [editExcludedStudents, setEditExcludedStudents] = useState([]);
  const [editQuestions, setEditQuestions] = useState([]);

  // Filters for results
  const [filterClass, setFilterClass] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterExam, setFilterExam] = useState("");

  const [selectedMonitorExamId, setSelectedMonitorExamId] = useState(null);
  const [monFilterStatuses, setMonFilterStatuses] = useState({
    mengerjakan: true,
    selesai: true,
    belumMulai: true,
    diberhentikan: true,
    keluar: true
  });

  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    const init = async () => {
      await loadData();
    };
    init();

    // Subscribe to real-time events (login status, exam sessions)
    const unsubscribe = db.subscribe(async (msg) => {
      if (msg.type === "LOGIN_CHANGE" || msg.type === "EXAM_STATUS_CHANGE" || msg.type === "EXAM_SUBMITTED" || msg.type === "EXIT_REQUEST") {
        await loadData();
      }
    });

    // Also poll every 3 seconds for active UI updates
    const timer = setInterval(() => {
      loadData();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const loadData = async () => {
    const [c, s, e, l, sess, u, exitReqs] = await Promise.all([
      db.get("classes"),
      db.get("subjects"),
      db.get("exams"),
      db.get("loginLogs"),
      db.get("sessions"),
      db.get("users"),
      db.get("exitRequests")
    ]);
    setClasses(c);
    setSubjects(s);
    setExams(e.map(ex => ({ ...ex, questions: ex.questions || [] })));
    setLoginLogs(l);
    setSessions(sess);
    setUsers(u);
    setExitRequests(exitReqs.filter(r => r.status === "pending"));
  };

  const showMsg = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 4000);
  };

  // Add Question Input Block
  const addQuestionField = () => {
    setQuestions([...questions, { text: "", options: ["", "", "", ""], answer: 0 }]);
  };

  // Remove Question Field
  const removeQuestionField = (idx) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  // Update Question Form Values
  const updateQuestion = (idx, field, value) => {
    const updated = [...questions];
    if (field === "text") {
      updated[idx].text = value;
    } else if (field === "answer") {
      updated[idx].answer = parseInt(value, 10);
    }
    setQuestions(updated);
  };

  const updateOption = (qIdx, optIdx, val) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx] = val;
    setQuestions(updated);
  };

  // Save Exam (Create)
  const handleSaveExam = async (e) => {
    e.preventDefault();
    if (!examTitle || !examSubject || !examDate || !examStartTime || !examEndTime) {
      showMsg("Semua bidang Ujian termasuk Tanggal, Jam Mulai dan Jam Selesai harus diisi!", "danger");
      return;
    }

    const startDtStr = new Date(`${examDate}T${examStartTime}`).toISOString();
    const endDtStr = new Date(`${examDate}T${examEndTime}`).toISOString();
    
    if (new Date(endDtStr) <= new Date(startDtStr)) {
      showMsg("Jam Selesai harus setelah Jam Mulai!", "danger");
      return;
    }

    const sub = subjects.find(s => s.id === examSubject);
    if (!sub) return;

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim() || questions[i].options.some(o => !o.trim())) {
        showMsg(`Pertanyaan atau pilihan jawaban nomor ${i + 1} belum lengkap!`, "danger");
        return;
      }
    }

    const duration = Math.round((new Date(endDtStr) - new Date(startDtStr)) / 60000);

    const newExam = {
      id: "exam-" + Date.now(),
      title: examTitle.trim(),
      subjectId: examSubject,
      classId: sub.classId,
      duration,
      randomize: examRandom,
      isMakeup: examIsMakeup,
      allowedStudents: examIsMakeup ? examAllowedStudents : [],
      excludedStudents: !examIsMakeup ? examExcludedStudents : [],
      scheduledStart: startDtStr,
      scheduledEnd: endDtStr,
      teacherId: user.id,
      questions: questions.map((q, idx) => ({
        id: `q-${Date.now()}-${idx}`,
        text: q.text.trim(),
        options: q.options.map(o => o.trim()),
        answer: q.answer
      }))
    };

    const updatedExams = [...exams, newExam];
    await db.save("exams", newExam);
    setExams(updatedExams);

    // Reset Form
    setExamTitle("");
    setExamSubject("");
    setExamDate("");
    setExamStartTime("");
    setExamEndTime("");
    setExamRandom(false);
    setExamIsMakeup(false);
    setExamAllowedStudents([]);
    setExamExcludedStudents([]);
    setQuestions([{ text: "", options: ["", "", "", ""], answer: 0 }]);

    showMsg(`Ujian "${newExam.title}" berhasil dibuat!`);
    setActiveTab("overview");
  };

  // Delete Exam (Delete - CRUD)
  const handleDeleteExam = async (examId, title) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus ujian "${title}"? Tindakan ini juga akan menghapus semua riwayat sesi murid.`)) {
      return;
    }

    await db.delete("exams", "id", examId);
    const updatedExams = exams.filter(e => e.id !== examId);
    setExams(updatedExams);

    // Also clear session histories for that exam in local state
    const updatedSessions = sessions.filter(s => s.examId !== examId);
    setSessions(updatedSessions);

    showMsg(`Ujian "${title}" berhasil dihapus.`, "warning");
  };

  // Open Edit Exam (Update - CRUD)
  const handleStartEditExam = (ex) => {
    setEditingExam(ex);
    setEditTitle(ex.title);
    setEditSubjectId(ex.subjectId);
    
    // Parse scheduledStart & scheduledEnd back to input formats
    const parseLocal = (isoString) => {
      const d = new Date(isoString);
      const pad = n => n.toString().padStart(2, '0');
      return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
      };
    };

    if (ex.scheduledStart) {
      const { date, time } = parseLocal(ex.scheduledStart);
      setEditDate(date);
      setEditStartTime(time);
    }
    if (ex.scheduledEnd) {
      const { time } = parseLocal(ex.scheduledEnd);
      setEditEndTime(time);
    }
    
    setEditRandom(ex.randomize);
    setEditIsMakeup(ex.isMakeup || false);
    setEditAllowedStudents(ex.allowedStudents || []);
    setEditExcludedStudents(ex.excludedStudents || []);
    setEditQuestions(ex.questions.map(q => ({
      id: q.id,
      text: q.text,
      options: [...q.options],
      answer: q.answer
    })));
  };

  const addEditQuestionField = () => {
    setEditQuestions([...editQuestions, { id: `q-${Date.now()}-${editQuestions.length}`, text: "", options: ["", "", "", ""], answer: 0 }]);
  };

  const removeEditQuestionField = (idx) => {
    if (editQuestions.length === 1) return;
    setEditQuestions(editQuestions.filter((_, i) => i !== idx));
  };

  const updateEditQuestion = (idx, field, value) => {
    const updated = [...editQuestions];
    if (field === "text") {
      updated[idx].text = value;
    } else if (field === "answer") {
      updated[idx].answer = parseInt(value, 10);
    }
    setEditQuestions(updated);
  };

  const updateEditOption = (qIdx, optIdx, val) => {
    const updated = [...editQuestions];
    updated[qIdx].options[optIdx] = val;
    setEditQuestions(updated);
  };

  // Save Edit Exam (Update - CRUD)
  const handleSaveEditExam = async (e) => {
    e.preventDefault();
    if (!editTitle || !editSubjectId || !editDate || !editStartTime || !editEndTime) {
      showMsg("Semua bidang Ujian wajib diisi!", "danger");
      return;
    }

    const startDtStr = new Date(`${editDate}T${editStartTime}`).toISOString();
    const endDtStr = new Date(`${editDate}T${editEndTime}`).toISOString();
    
    if (new Date(endDtStr) <= new Date(startDtStr)) {
      showMsg("Jam Selesai harus setelah Jam Mulai!", "danger");
      return;
    }

    const sub = subjects.find(s => s.id === editSubjectId);
    if (!sub) return;

    // Validate questions
    for (let i = 0; i < editQuestions.length; i++) {
      if (!editQuestions[i].text.trim() || editQuestions[i].options.some(o => !o.trim())) {
        showMsg(`Pertanyaan atau pilihan jawaban nomor ${i + 1} belum lengkap!`, "danger");
        return;
      }
    }

    const duration = Math.round((new Date(endDtStr) - new Date(startDtStr)) / 60000);

    let updatedExamObj = null;

    const updated = exams.map(ex => {
      if (ex.id === editingExam.id) {
        updatedExamObj = {
          ...ex,
          title: editTitle.trim(),
          subjectId: editSubjectId,
          classId: sub.classId,
          duration,
          randomize: editRandom,
          isMakeup: editIsMakeup,
          allowedStudents: editIsMakeup ? editAllowedStudents : [],
          excludedStudents: !editIsMakeup ? editExcludedStudents : [],
          scheduledStart: startDtStr,
          scheduledEnd: endDtStr,
          questions: editQuestions.map(q => ({
            id: q.id,
            text: q.text.trim(),
            options: q.options.map(o => o.trim()),
            answer: q.answer
          }))
        };
        return updatedExamObj;
      }
      return ex;
    });

    if (updatedExamObj) {
      await db.save("exams", updatedExamObj);
    }
    setExams(updated);
    setEditingExam(null);
    showMsg(`Perubahan Ujian "${editTitle}" berhasil disimpan!`);
  };

  // Stop student exam session
  const stopStudentExam = async (sessionId, studentNama) => {
    let updatedSessionObj = null;

    const updatedSessions = sessions.map(s => {
      if (s.id === sessionId) {
        // Calculate grades on force stop
        const exam = exams.find(ex => ex.id === s.examId);
        let correct = 0;
        let incorrect = 0;
        if (exam && exam.questions) {
          exam.questions.forEach(q => {
            const stuAns = s.answers[q.id];
            if (stuAns === undefined) {
              incorrect++;
            } else if (parseInt(stuAns, 10) === q.answer) {
              correct++;
            } else {
              incorrect++;
            }
          });
        }

        updatedSessionObj = {
          ...s,
          isStopped: true,
          isFinished: true,
          correct,
          incorrect,
          endTime: new Date().toLocaleTimeString()
        };
        return updatedSessionObj;
      }
      return s;
    });

    if (updatedSessionObj) {
      await db.save("sessions", updatedSessionObj);
    }
    setSessions(updatedSessions);
    db.notify("EXAM_STATUS_CHANGE", { sessionId, isStopped: true });
    showMsg(`Ujian ${studentNama} berhasil diberhentikan!`, "warning");
  };

  // Logout Murid remotely (force logout from monitoring)
  const logoutStudent = async (nisn, studentNama) => {
    if (!window.confirm(`Logout ${studentNama} dari sistem? Murid akan dikeluarkan dari aplikasi.`)) return;

    // Set isOnline to false in loginLogs
    const logs = await db.get("loginLogs");
    const logEntry = logs.find(l => l.username === nisn);
    if (logEntry) {
      logEntry.isOnline = false;
      await db.save("loginLogs", logEntry);
    }

    db.notify("FORCE_LOGOUT", { username: nisn });
    showMsg(`${studentNama} berhasil di-logout dari sistem.`, "warning");
    await loadData();
  };

  // Approve exit request and logout student
  const approveExitRequest = async (request) => {
    // Update request status
    const updatedReq = { ...request, status: "approved" };
    await db.save("exitRequests", updatedReq);

    // Set student isOnline to false
    const logs = await db.get("loginLogs");
    const logEntry = logs.find(l => l.username === request.nisn);
    if (logEntry) {
      logEntry.isOnline = false;
      await db.save("loginLogs", logEntry);
    }

    db.notify("FORCE_LOGOUT", { username: request.nisn });
    showMsg(`Izin keluar ${request.nama} disetujui. Murid telah di-logout.`, "success");
    await loadData();
  };

  // Print results
  const triggerPrint = () => {
    window.print();
  };

  // Filtered Exam results logic
  const filteredSessions = sessions.filter(s => {
    if (!s.isFinished) return false;
    const exam = exams.find(e => e.id === s.examId);
    if (!exam) return false;

    const matchesClass = filterClass ? exam.classId === filterClass : true;
    const matchesSub = filterSubject ? exam.subjectId === filterSubject : true;
    const matchesExam = filterExam ? exam.id === filterExam : true;
    return matchesClass && matchesSub && matchesExam;
  });

  // Time Formatter helper
  const formatTimeSlot = (start, end) => {
    if (!start || !end) return "-";
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const dateStr = startDate.toLocaleDateString("id-ID", {
      dateStyle: "medium"
    });

    const startTimeStr = startDate.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    }).replace(".", ":");

    const endTimeStr = endDate.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    }).replace(".", ":");

    return `${dateStr} (${startTimeStr} - ${endTimeStr})`;
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar no-print">
        <div className="sidebar-logo">
          EXAM<span>PRO</span>
        </div>
        <ul className="sidebar-menu">
          <li className={`sidebar-item ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            Ringkasan
          </li>
          <li className={`sidebar-item ${activeTab === "buat-ujian" ? "active" : ""}`} onClick={() => setActiveTab("buat-ujian")}>
            Buat Ujian
          </li>
          <li className={`sidebar-item ${activeTab === "monitoring" ? "active" : ""}`} onClick={() => setActiveTab("monitoring")}>
            Live Monitoring
          </li>
          <li className={`sidebar-item ${activeTab === "nilai" ? "active" : ""}`} onClick={() => setActiveTab("nilai")}>
            Rekap & Cetak Nilai
          </li>
        </ul>
        <div className="sidebar-footer">
          <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
            NIP: <strong>{user.username}</strong>
          </div>
          <button className="btn btn-danger" style={{ width: "100%", padding: "8px 16px" }} onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header-bar no-print">
          <div className="page-title">
            <h1>Dashboard Guru</h1>
            <p>Kelola soal, pantau aktivitas siswa, dan cetak nilai secara real-time</p>
          </div>
          <div className="user-profile-badge">
            <span className="user-role-tag">Guru</span>
            <span>{user.nama}</span>
          </div>
        </header>

        {message.text && (
          <div
            className="no-print"
            style={{
              backgroundColor: message.type === "danger" ? "rgba(239, 68, 68, 0.15)" : message.type === "warning" ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
              border: `1px solid ${message.type === "danger" ? "var(--color-danger)" : message.type === "warning" ? "var(--color-warning)" : "var(--color-success)"}`,
              color: message.type === "danger" ? "var(--color-danger)" : message.type === "warning" ? "var(--color-warning)" : "var(--color-success)",
              padding: "12px",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              marginBottom: "20px",
              fontWeight: "600",
            }}
          >
            {message.text}
          </div>
        )}

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div>
            <div className="stats-grid no-print">
              <div className="stat-card">
                <span className="stat-label">Total Ujian Anda</span>
                <span className="stat-val">{exams.filter(e => e.teacherId === user.id).length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Murid Online</span>
                <span className="stat-val">{loginLogs.filter(l => l.role === "murid" && l.isOnline).length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Ujian Sedang Berjalan</span>
                <span className="stat-val">{sessions.filter(s => !s.isFinished).length}</span>
              </div>
            </div>

            <div className="glass-card">
              <h2 style={{ marginBottom: "16px" }} className="no-print">Manajemen Ujian Pro</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }} className="no-print">
                Di dashboard ini, Anda dapat mengelola (CRUD) ujian yang telah Anda buat, memantau pengerjaan secara langsung, dan mencetak laporan nilai.
              </p>
              
              <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>Daftar Ujian yang Anda Buat (CRUD)</h3>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Judul Ujian</th>
                      <th>Mata Pelajaran</th>
                      <th>Jadwal Ujian (Jam Sistem)</th>
                      <th>Durasi</th>
                      <th>Acak Soal</th>
                      <th className="no-print">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.filter(e => e.teacherId === user.id).map(ex => {
                      const sub = subjects.find(s => s.id === ex.subjectId);
                      const cls = classes.find(c => c.id === ex.classId);
                      return (
                        <tr key={ex.id}>
                          <td style={{ fontWeight: "600" }}>{ex.title}</td>
                          <td>{sub?.name} ({cls?.name})</td>
                          <td style={{ fontSize: "13px" }}>
                            {formatTimeSlot(ex.scheduledStart, ex.scheduledEnd)}
                          </td>
                          <td>{ex.duration} Menit</td>
                          <td>
                            <span className={`badge ${ex.randomize ? "badge-success" : "badge-warning"}`}>
                              {ex.randomize ? "YA" : "TIDAK"}
                            </span>
                          </td>
                          <td className="no-print">
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => setViewingExam(ex)}>
                                Lihat Soal
                              </button>
                              <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => handleStartEditExam(ex)}>
                                Edit
                              </button>
                              <button className="btn btn-danger" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => handleDeleteExam(ex.id, ex.title)}>
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {exams.filter(e => e.teacherId === user.id).length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                          Anda belum membuat ujian apa pun. Silakan buat di tab "Buat Ujian".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Buat Ujian */}
        {activeTab === "buat-ujian" && (
          <div className="glass-card">
            <h3 style={{ marginBottom: "20px" }}>Buat Paket Ujian</h3>
            <form onSubmit={handleSaveExam}>
              <div className="form-group">
                <label>Judul Ujian</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Masukkan nama ujian (misal: UTS Matematika)"
                  value={examTitle}
                  onChange={e => setExamTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Pilih Mata Pelajaran (Kelas Terikat)</label>
                <select
                  className="form-control"
                  value={examSubject}
                  onChange={e => setExamSubject(e.target.value)}
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects.map(sub => {
                    const cls = classes.find(c => c.id === sub.classId);
                    return (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({cls?.name || "Kelas Tidak Dikenal"})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label>Tanggal Ujian</label>
                  <input
                    type="date"
                    className="form-control"
                    value={examDate}
                    onChange={e => setExamDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Jam Mulai</label>
                  <input
                    type="time"
                    className="form-control"
                    placeholder="--.--"
                    value={examStartTime}
                    onChange={e => setExamStartTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Jam Selesai</label>
                  <input
                    type="time"
                    className="form-control"
                    placeholder="--.--"
                    value={examEndTime}
                    onChange={e => setExamEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "24px 0" }}>
                <input
                  type="checkbox"
                  id="acak-soal-check"
                  style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                  checked={examRandom}
                  onChange={e => setExamRandom(e.target.checked)}
                />
                <label htmlFor="acak-soal-check" style={{ margin: 0, cursor: "pointer" }}>
                  <strong>Aktifkan Fitur Acak Soal:</strong> Mengacak urutan soal secara unik untuk tiap murid.
                </label>
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "24px 0" }}>
                <input
                  type="checkbox"
                  id="ujian-susulan-check"
                  style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                  checked={examIsMakeup}
                  onChange={e => setExamIsMakeup(e.target.checked)}
                />
                <label htmlFor="ujian-susulan-check" style={{ margin: 0, cursor: "pointer" }}>
                  <strong>Jadikan Ujian Susulan:</strong> Hanya murid yang dipilih yang dapat mengakses ujian ini.
                </label>
              </div>

              {examIsMakeup && (
                <div className="glass-card" style={{ marginBottom: "24px", backgroundColor: "rgba(251, 191, 36, 0.05)", border: "1px solid #f59e0b" }}>
                  <h4 style={{ color: "#f59e0b", marginBottom: "16px" }}>👥 Pilih Murid Susulan</h4>
                  {examSubject ? (() => {
                    const sub = subjects.find(s => s.id === examSubject);
                    const classUsers = users.filter(u => u.role === "murid" && u.classId === sub?.classId);
                    if (classUsers.length === 0) return <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Tidak ada murid di kelas ini.</p>;
                    
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
                        {classUsers.map(student => (
                          <label key={student.username} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", padding: "4px" }}>
                            <input
                              type="checkbox"
                              checked={examAllowedStudents.includes(student.username)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setExamAllowedStudents([...examAllowedStudents, student.username]);
                                } else {
                                  setExamAllowedStudents(examAllowedStudents.filter(id => id !== student.username));
                                }
                              }}
                            />
                            {student.nama} ({student.username})
                          </label>
                        ))}
                      </div>
                    );
                  })() : <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Pilih Mata Pelajaran terlebih dahulu untuk memunculkan daftar murid.</p>}
                </div>
              )}

              {!examIsMakeup && (
                <div className="glass-card" style={{ marginBottom: "24px", backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid #ef4444" }}>
                  <h4 style={{ color: "#ef4444", marginBottom: "16px" }}>🚫 Pengecualian Murid (Opsional)</h4>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>Pilih murid yang <strong>TIDAK DIIZINKAN</strong> mengikuti ujian reguler ini.</p>
                  {examSubject ? (() => {
                    const sub = subjects.find(s => s.id === examSubject);
                    const classUsers = users.filter(u => u.role === "murid" && u.classId === sub?.classId);
                    if (classUsers.length === 0) return <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Tidak ada murid di kelas ini.</p>;
                    
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
                        {classUsers.map(student => (
                          <label key={student.username} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", padding: "4px" }}>
                            <input
                              type="checkbox"
                              checked={examExcludedStudents.includes(student.username)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setExamExcludedStudents([...examExcludedStudents, student.username]);
                                } else {
                                  setExamExcludedStudents(examExcludedStudents.filter(id => id !== student.username));
                                }
                              }}
                            />
                            {student.nama} ({student.username})
                          </label>
                        ))}
                      </div>
                    );
                  })() : <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Pilih Mata Pelajaran terlebih dahulu untuk memunculkan daftar murid.</p>}
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "24px", marginTop: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h4>Daftar Soal Ujian</h4>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="glass-card" style={{ backgroundColor: "rgba(255,255,255,0.01)", padding: "20px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <strong style={{ color: "var(--color-primary)" }}>Nomor Soal {qIdx + 1}</strong>
                      {questions.length > 1 && (
                        <button type="button" className="btn btn-danger" style={{ padding: "4px 12px", fontSize: "12px" }} onClick={() => removeQuestionField(qIdx)}>
                          Hapus Soal
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Teks Soal / Pertanyaan</label>
                      <textarea
                        rows="2"
                        className="form-control"
                        placeholder="Tuliskan pertanyaan disini..."
                        value={q.text}
                        onChange={e => updateQuestion(qIdx, "text", e.target.value)}
                      ></textarea>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }} className="form-row">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="form-group" style={{ margin: 0 }}>
                          <label>Pilihan {String.fromCharCode(65 + optIdx)}</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder={`Ketik pilihan jawaban ${String.fromCharCode(65 + optIdx)}`}
                            value={opt}
                            onChange={e => updateOption(qIdx, optIdx, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="form-group" style={{ marginTop: "16px" }}>
                      <label>Kunci Jawaban yang Benar</label>
                      <select
                        className="form-control"
                        value={q.answer}
                        onChange={e => updateQuestion(qIdx, "answer", e.target.value)}
                      >
                        <option value={0}>Pilihan A</option>
                        <option value={1}>Pilihan B</option>
                        <option value={2}>Pilihan C</option>
                        <option value={3}>Pilihan D</option>
                      </select>
                    </div>
                  </div>
                ))}

                <button type="button" className="btn btn-secondary" onClick={addQuestionField} style={{ width: "100%", padding: "14px", marginTop: "4px", marginBottom: "16px" }}>
                  + Tambah Soal
                </button>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "14px" }}>
                Simpan dan Terbitkan Ujian
              </button>
            </form>
          </div>
        )}

        {/* Tab: Live Monitoring */}
        {activeTab === "monitoring" && (
          <div>
            {/* Section 1: Daftar Ringkasan Ujian */}
            <div className="glass-card">
              <h3 style={{ marginBottom: "16px" }}>Daftar Ringkasan Ujian</h3>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Nama Ujian</th>
                      <th>Mata Pelajaran</th>
                      <th>Kelas</th>
                      <th>Jadwal</th>
                      <th>Jumlah Soal</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                          Belum ada ujian yang dibuat.
                        </td>
                      </tr>
                    ) : (
                      exams.map(exam => {
                        const cls = classes.find(c => c.id === exam.classId);
                        const sub = subjects.find(s => s.id === exam.subjectId);

                        const nowTime = new Date().getTime();
                        let statusBadge = null;
                        if (exam.scheduledStart && nowTime < new Date(exam.scheduledStart).getTime()) {
                          statusBadge = <span className="badge badge-warning">Belum Mulai</span>;
                        } else if (exam.scheduledEnd && nowTime > new Date(exam.scheduledEnd).getTime()) {
                          statusBadge = <span className="badge badge-danger">Selesai</span>;
                        } else {
                          statusBadge = <span className="badge badge-info" style={{ animation: "pulse 1.5s infinite" }}>Berlangsung</span>;
                        }

                        const examSessionsCount = sessions.filter(s => s.examId === exam.id && !s.isFinished).length;
                        
                        let eligibleStudentsCount = 0;
                        if (exam.isMakeup) {
                          eligibleStudentsCount = users.filter(u => u.role === "murid" && exam.allowedStudents?.includes(u.username)).length;
                        } else {
                          eligibleStudentsCount = users.filter(u => u.role === "murid" && u.classId === exam.classId && !(exam.excludedStudents || []).includes(u.username)).length;
                        }

                        return (
                          <tr key={exam.id} style={{ backgroundColor: selectedMonitorExamId === exam.id ? "rgba(99, 102, 241, 0.1)" : "transparent", transition: "background-color 0.2s" }}>
                            <td style={{ fontWeight: "600" }}>
                              {exam.title}
                              {exam.isMakeup && <span className="badge badge-warning" style={{ marginLeft: "8px", fontSize: "10px", padding: "2px 6px" }}>SUSULAN</span>}
                            </td>
                            <td>{sub?.name || "—"}</td>
                            <td>{cls?.name || "—"}</td>
                            <td style={{ fontSize: "13px" }}>{formatTimeSlot(exam.scheduledStart, exam.scheduledEnd)}</td>
                            <td>{exam.questions?.length || 0} soal</td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div>{statusBadge}</div>
                                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                  Mengerjakan: <strong>{examSessionsCount}/{eligibleStudentsCount}</strong> murid
                                </div>
                              </div>
                            </td>
                            <td>
                              <button 
                                className={`btn ${selectedMonitorExamId === exam.id ? "btn-secondary" : "btn-primary"}`}
                                style={{ padding: "6px 14px", fontSize: "12px" }}
                                onClick={() => setSelectedMonitorExamId(selectedMonitorExamId === exam.id ? null : exam.id)}
                              >
                                {selectedMonitorExamId === exam.id ? "Tutup" : "Pantau"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Aktivitas Pengerjaan Ujian Real-Time (hanya muncul jika ujian dipilih) */}
            {selectedMonitorExamId ? (
              <div className="glass-card" style={{ marginTop: "24px" }}>
                <h3 style={{ marginBottom: "16px" }}>Aktivitas Pengerjaan: {exams.find(e => e.id === selectedMonitorExamId)?.title}</h3>

                {/* Exit Requests Notifications for this exam */}
                {exitRequests.filter(r => r.examId === selectedMonitorExamId).length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    {exitRequests.filter(r => r.examId === selectedMonitorExamId).map(req => (
                      <div key={req.id} style={{ backgroundColor: "rgba(251, 191, 36, 0.1)", border: "1px solid #f59e0b", borderRadius: "var(--radius-md)", padding: "14px 18px", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <div style={{ fontWeight: "700", color: "#f59e0b", fontSize: "13px", marginBottom: "4px" }}>
                            🚪 Permintaan Izin Keluar
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: "600" }}>
                            {req.nama}
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                            Alasan: <em>"{req.reason}"</em>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {new Date(req.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="btn btn-success" style={{ padding: "6px 16px", fontSize: "12px" }} onClick={() => approveExitRequest(req)}>
                            ✓ Setujui & Logout
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Also show exit requests not tied to this exam */}
                {exitRequests.filter(r => r.examId !== selectedMonitorExamId).length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    {exitRequests.filter(r => r.examId !== selectedMonitorExamId).map(req => {
                      const reqExam = exams.find(e => e.id === req.examId);
                      return (
                        <div key={req.id} style={{ backgroundColor: "rgba(251, 191, 36, 0.05)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "var(--radius-md)", padding: "12px 18px", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: "200px" }}>
                            <div style={{ fontWeight: "600", color: "#f59e0b", fontSize: "12px", marginBottom: "2px" }}>
                              🚪 Izin Keluar (Ujian Lain: {reqExam?.title || "—"})
                            </div>
                            <div style={{ fontSize: "13px" }}>
                              {req.nama} — <em style={{ color: "var(--text-secondary)" }}>"{req.reason}"</em>
                            </div>
                          </div>
                          <button className="btn btn-success" style={{ padding: "4px 12px", fontSize: "11px" }} onClick={() => approveExitRequest(req)}>
                            ✓ Setujui
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px", padding: "12px", backgroundColor: "rgba(0,0,0,0.02)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                    <input type="checkbox" checked={monFilterStatuses.mengerjakan} onChange={e => setMonFilterStatuses(prev => ({...prev, mengerjakan: e.target.checked}))} />
                    Mengerjakan
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                    <input type="checkbox" checked={monFilterStatuses.selesai} onChange={e => setMonFilterStatuses(prev => ({...prev, selesai: e.target.checked}))} />
                    Telah Selesai
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                    <input type="checkbox" checked={monFilterStatuses.belumMulai} onChange={e => setMonFilterStatuses(prev => ({...prev, belumMulai: e.target.checked}))} />
                    Belum Mulai / Sedang Login
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                    <input type="checkbox" checked={monFilterStatuses.diberhentikan} onChange={e => setMonFilterStatuses(prev => ({...prev, diberhentikan: e.target.checked}))} />
                    Diberhentikan
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                    <input type="checkbox" checked={monFilterStatuses.keluar} onChange={e => setMonFilterStatuses(prev => ({...prev, keluar: e.target.checked}))} />
                    Telah Keluar
                  </label>
                </div>

                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Murid</th>
                        <th>Waktu Mulai</th>
                        <th>Waktu Selesai</th>
                        <th>Kemajuan Jawaban</th>
                        <th>Status Ujian</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const exam = exams.find(e => e.id === selectedMonitorExamId);
                        if (!exam) return null;

                        let eligibleStudents = [];
                        if (exam.isMakeup) {
                          eligibleStudents = users.filter(u => u.role === "murid" && exam.allowedStudents?.includes(u.username));
                        } else {
                          eligibleStudents = users.filter(u => u.role === "murid" && u.classId === exam.classId && !(exam.excludedStudents || []).includes(u.username));
                        }

                        const studentsData = eligibleStudents.map(student => {
                          const session = sessions.find(s => s.examId === exam.id && s.nisn === student.username);
                          const log = loginLogs.find(l => l.username === student.username);

                          let statusStr = "";
                          let statusCategory = "";
                          if (session) {
                            if (session.isFinished) {
                              if (session.isStopped) { statusStr = "Diberhentikan"; statusCategory = "diberhentikan"; }
                              else { statusStr = "Selesai"; statusCategory = "selesai"; }
                            } else {
                              if (log?.isOnline === false) { statusStr = "Telah Keluar (Logout)"; statusCategory = "keluar"; }
                              else { statusStr = "Mengerjakan"; statusCategory = "mengerjakan"; }
                            }
                          } else {
                            if (log?.isOnline) { statusStr = "Sedang Login (Belum Mulai)"; statusCategory = "belumMulai"; }
                            else { statusStr = "Belum Login"; statusCategory = "belumMulai"; }
                          }

                          return { student, session, log, statusStr, statusCategory };
                        });

                        const filteredStudentsData = studentsData.filter(d => monFilterStatuses[d.statusCategory]);

                        if (filteredStudentsData.length === 0) {
                          return (
                            <tr>
                              <td colSpan="6" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                                Belum ada murid yang sesuai dengan filter pencarian.
                              </td>
                            </tr>
                          );
                        }

                        return filteredStudentsData.map(({ student, session, statusStr, statusCategory }) => {
                          const totalQuestions = exam.questions?.length || 0;
                          let answeredCount = 0;
                          if (session) answeredCount = Object.keys(session.answers || {}).length;

                          return (
                            <tr key={student.id}>
                              <td style={{ fontWeight: "600" }}>{student.nama} ({student.username})</td>
                              <td>{session?.startTime || "-"}</td>
                              <td>{session?.isFinished ? (session.endTime || "-") : <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>}</td>
                              <td>
                                {session ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <div style={{ flexGrow: 1, height: "6px", backgroundColor: "var(--bg-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: `${(answeredCount / totalQuestions) * 100}%`, backgroundColor: "var(--color-primary)" }}></div>
                                    </div>
                                    <span style={{ fontSize: "12px", minWidth: "35px" }}>{answeredCount}/{totalQuestions}</span>
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Belum ada jawaban</span>
                                )}
                              </td>
                              <td>
                                {statusCategory === "diberhentikan" && <span className="badge badge-danger">{statusStr}</span>}
                                {statusCategory === "selesai" && <span className="badge badge-success">{statusStr}</span>}
                                {statusCategory === "keluar" && <span className="badge badge-warning" style={{ backgroundColor: "rgba(251, 191, 36, 0.15)", color: "#f59e0b", border: "1px solid #f59e0b" }}>{statusStr}</span>}
                                {statusCategory === "mengerjakan" && <span className="badge badge-info" style={{ animation: "pulse 1.5s infinite" }}>{statusStr}</span>}
                                {statusCategory === "belumMulai" && <span className="badge badge-secondary" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>{statusStr}</span>}
                              </td>
                              <td>
                                {session && !session.isFinished && (
                                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    <button
                                      className="btn btn-danger"
                                      style={{ padding: "6px 12px", fontSize: "12px" }}
                                      onClick={() => stopStudentExam(session.id, student.nama)}
                                    >
                                      Hentikan
                                    </button>
                                    <button
                                      className="btn"
                                      style={{ padding: "6px 12px", fontSize: "12px", backgroundColor: "rgba(251, 191, 36, 0.15)", border: "1px solid #f59e0b", color: "#f59e0b", fontWeight: "600" }}
                                      onClick={() => logoutStudent(student.username, student.nama)}
                                    >
                                      Logout
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                {/* Show exit requests even when no exam is selected */}
                {exitRequests.length > 0 && (
                  <div className="glass-card" style={{ marginTop: "24px" }}>
                    <h3 style={{ marginBottom: "16px" }}>🚪 Permintaan Izin Keluar</h3>
                    {exitRequests.map(req => {
                      const exam = exams.find(e => e.id === req.examId);
                      return (
                        <div key={req.id} style={{ backgroundColor: "rgba(251, 191, 36, 0.1)", border: "1px solid #f59e0b", borderRadius: "var(--radius-md)", padding: "14px 18px", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: "200px" }}>
                            <div style={{ fontWeight: "700", color: "#f59e0b", fontSize: "13px", marginBottom: "4px" }}>
                              🚪 Permintaan Izin Keluar
                            </div>
                            <div style={{ fontSize: "14px", fontWeight: "600" }}>
                              {req.nama} <span style={{ fontWeight: "400", color: "var(--text-secondary)" }}>— {exam ? exam.title : "Ujian"}</span>
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                              Alasan: <em>"{req.reason}"</em>
                            </div>
                          </div>
                          <button className="btn btn-success" style={{ padding: "6px 16px", fontSize: "12px" }} onClick={() => approveExitRequest(req)}>
                            ✓ Setujui & Logout
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="glass-card" style={{ marginTop: "24px", textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}>📊</div>
                  <h3 style={{ color: "var(--text-secondary)" }}>Pilih ujian di atas untuk memantau aktivitas murid.</h3>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Rekap & Cetak Nilai */}
        {activeTab === "nilai" && (
          <div>
            <div className="glass-card no-print">
              <h3 style={{ marginBottom: "16px" }}>Filter & Cetak Nilai</h3>
              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 150px", gap: "16px", alignItems: "end" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Pilih Ujian</label>
                  <select
                    className="form-control"
                    value={filterExam}
                    onChange={e => setFilterExam(e.target.value)}
                  >
                    <option value="">-- Semua Ujian --</option>
                    {exams.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.title} {ex.isMakeup ? "(SUSULAN)" : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Pilih Kelas</label>
                  <select
                    className="form-control"
                    value={filterClass}
                    onChange={e => setFilterClass(e.target.value)}
                  >
                    <option value="">-- Semua Kelas --</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Pilih Mata Pelajaran</label>
                  <select
                    className="form-control"
                    value={filterSubject}
                    onChange={e => setFilterSubject(e.target.value)}
                  >
                    <option value="">-- Semua Mapel --</option>
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>

                <button className="btn btn-success" style={{ height: "46px" }} onClick={triggerPrint}>
                  Cetak Nilai
                </button>
              </div>
            </div>

            {/* Document wrapper that gets stylized beautifully on Print */}
            <div className="glass-card" style={{ padding: "32px", backgroundColor: "var(--card-bg)" }}>
              <div style={{ textAlign: "center", marginBottom: "30px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: "700" }}>LAPORAN HASIL NILAI UJIAN SISWA</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                  Sekolah Menengah Kejuruan EXAM-PRO
                </p>
                {filterClass && (
                  <p style={{ fontSize: "14px", fontWeight: "600", marginTop: "4px" }}>
                    Kelas: {classes.find(c => c.id === filterClass)?.name} 
                    {filterSubject && ` | Mata Pelajaran: ${subjects.find(s => s.id === filterSubject)?.name}`}
                    {filterExam && ` | Ujian: ${exams.find(e => e.id === filterExam)?.title}`}
                  </p>
                )}
              </div>

              <div className="table-responsive">
                <table className="custom-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>NISN</th>
                      <th>Nama Murid</th>
                      <th>Mata Pelajaran</th>
                      <th>Kelas</th>
                      <th>Benar</th>
                      <th>Salah</th>
                      <th>Waktu Selesai</th>
                      <th>Nilai Akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map(s => {
                      const student = users.find(u => u.username === s.nisn);
                      const exam = exams.find(e => e.id === s.examId);
                      const sub = subjects.find(su => su.id === exam?.subjectId);
                      const cls = classes.find(c => c.id === exam?.classId);

                      if (!student || !exam) return null;

                      // Score calculation out of 100
                      const totalQuestions = exam.questions?.length || 1;
                      const score = Math.round((s.correct / totalQuestions) * 100);

                      return (
                        <tr key={s.id}>
                          <td><code>{student.username}</code></td>
                          <td style={{ fontWeight: "600" }}>{student.nama}</td>
                          <td>{sub?.name}</td>
                          <td>{cls?.name}</td>
                          <td style={{ color: "var(--color-success)", fontWeight: "bold" }}>{s.correct}</td>
                          <td style={{ color: "var(--color-danger)", fontWeight: "bold" }}>{s.incorrect}</td>
                          <td>{s.endTime || "-"}</td>
                          <td style={{ fontWeight: "800", fontSize: "16px", color: "var(--color-primary)" }}>
                            {score}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSessions.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                          Belum ada data nilai terkumpul untuk kriteria filter ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: "40px", display: "flex", justifyContent: "flex-end" }} className="only-print">
                <div style={{ textAlign: "center", width: "200px" }}>
                  <p style={{ fontSize: "14px", marginBottom: "60px" }}>Guru Mata Pelajaran,</p>
                  <strong style={{ textDecoration: "underline" }}>{user.nama}</strong>
                  <p style={{ fontSize: "12px", color: "gray" }}>NIP. {user.username}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Read (View) Questions Modal */}
      {viewingExam && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.8)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px"
        }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: "600px", maxHeight: "80vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--card-border)", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "18px" }}>Daftar Soal: {viewingExam.title}</h3>
              <button className="btn btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setViewingExam(null)}>
                Tutup
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {viewingExam.questions.map((q, idx) => (
                <div key={idx} style={{ borderBottom: "1px solid var(--card-border)", paddingBottom: "12px" }}>
                  <p style={{ fontWeight: "600", marginBottom: "8px" }}>{idx + 1}. {q.text}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", paddingLeft: "12px" }}>
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} style={{ color: oIdx === q.answer ? "var(--color-success)" : "inherit", fontWeight: oIdx === q.answer ? "bold" : "normal" }}>
                        {String.fromCharCode(65 + oIdx)}. {opt} {oIdx === q.answer ? "✓" : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Exam Modal Overlay (CRUD - Update) */}
      {editingExam && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.8)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px"
        }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--card-border)", paddingBottom: "12px" }}>
              <h3>Edit Paket Ujian</h3>
              <button className="btn btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setEditingExam(null)}>
                Batal
              </button>
            </div>

            <form onSubmit={handleSaveEditExam}>
              <div className="form-group">
                <label>Judul Ujian</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Pilih Mata Pelajaran (Kelas Terikat)</label>
                <select
                  className="form-control"
                  value={editSubjectId}
                  onChange={e => setEditSubjectId(e.target.value)}
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects.map(sub => {
                    const cls = classes.find(c => c.id === sub.classId);
                    return (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({cls?.name || "Kelas Tidak Dikenal"})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label>Tanggal Ujian</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Jam Mulai</label>
                  <input
                    type="time"
                    className="form-control"
                    value={editStartTime}
                    onChange={e => setEditStartTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Jam Selesai</label>
                  <input
                    type="time"
                    className="form-control"
                    value={editEndTime}
                    onChange={e => setEditEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "24px 0" }}>
                <input
                  type="checkbox"
                  id="edit-acak-soal"
                  style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                  checked={editRandom}
                  onChange={e => setEditRandom(e.target.checked)}
                />
                <label htmlFor="edit-acak-soal" style={{ margin: 0, cursor: "pointer" }}>
                  <strong>Aktifkan Fitur Acak Soal</strong>
                </label>
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "24px 0" }}>
                <input
                  type="checkbox"
                  id="edit-ujian-susulan"
                  style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                  checked={editIsMakeup}
                  onChange={e => setEditIsMakeup(e.target.checked)}
                />
                <label htmlFor="edit-ujian-susulan" style={{ margin: 0, cursor: "pointer" }}>
                  <strong>Jadikan Ujian Susulan</strong>
                </label>
              </div>

              {editIsMakeup && (
                <div className="glass-card" style={{ marginBottom: "24px", backgroundColor: "rgba(251, 191, 36, 0.05)", border: "1px solid #f59e0b" }}>
                  <h4 style={{ color: "#f59e0b", marginBottom: "16px" }}>👥 Pilih Murid Susulan</h4>
                  {editSubjectId ? (() => {
                    const sub = subjects.find(s => s.id === editSubjectId);
                    const classUsers = users.filter(u => u.role === "murid" && u.classId === sub?.classId);
                    if (classUsers.length === 0) return <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Tidak ada murid di kelas ini.</p>;
                    
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
                        {classUsers.map(student => (
                          <label key={student.username} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", padding: "4px" }}>
                            <input
                              type="checkbox"
                              checked={editAllowedStudents.includes(student.username)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setEditAllowedStudents([...editAllowedStudents, student.username]);
                                } else {
                                  setEditAllowedStudents(editAllowedStudents.filter(id => id !== student.username));
                                }
                              }}
                            />
                            {student.nama} ({student.username})
                          </label>
                        ))}
                      </div>
                    );
                  })() : <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Pilih Mata Pelajaran terlebih dahulu untuk memunculkan daftar murid.</p>}
                </div>
              )}

              {!editIsMakeup && (
                <div className="glass-card" style={{ marginBottom: "24px", backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid #ef4444" }}>
                  <h4 style={{ color: "#ef4444", marginBottom: "16px" }}>🚫 Pengecualian Murid (Opsional)</h4>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>Pilih murid yang <strong>TIDAK DIIZINKAN</strong> mengikuti ujian reguler ini.</p>
                  {editSubjectId ? (() => {
                    const sub = subjects.find(s => s.id === editSubjectId);
                    const classUsers = users.filter(u => u.role === "murid" && u.classId === sub?.classId);
                    if (classUsers.length === 0) return <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Tidak ada murid di kelas ini.</p>;
                    
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
                        {classUsers.map(student => (
                          <label key={student.username} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", padding: "4px" }}>
                            <input
                              type="checkbox"
                              checked={editExcludedStudents.includes(student.username)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setEditExcludedStudents([...editExcludedStudents, student.username]);
                                } else {
                                  setEditExcludedStudents(editExcludedStudents.filter(id => id !== student.username));
                                }
                              }}
                            />
                            {student.nama} ({student.username})
                          </label>
                        ))}
                      </div>
                    );
                  })() : <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Pilih Mata Pelajaran terlebih dahulu untuk memunculkan daftar murid.</p>}
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "24px", marginTop: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h4>Daftar Soal Ujian ({editQuestions.length})</h4>
                </div>

                {editQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="glass-card" style={{ backgroundColor: "rgba(255,255,255,0.01)", padding: "20px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <strong style={{ color: "var(--color-primary)" }}>Nomor Soal {qIdx + 1}</strong>
                      {editQuestions.length > 1 && (
                        <button type="button" className="btn btn-danger" style={{ padding: "4px 12px", fontSize: "12px" }} onClick={() => removeEditQuestionField(qIdx)}>
                          Hapus Soal
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Teks Soal / Pertanyaan</label>
                      <textarea
                        rows="2"
                        className="form-control"
                        placeholder="Tuliskan pertanyaan..."
                        value={q.text}
                        onChange={e => updateEditQuestion(qIdx, "text", e.target.value)}
                      ></textarea>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }} className="form-row">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="form-group" style={{ margin: 0 }}>
                          <label>Pilihan {String.fromCharCode(65 + optIdx)}</label>
                          <input
                            type="text"
                            className="form-control"
                            value={opt}
                            onChange={e => updateEditOption(qIdx, optIdx, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="form-group" style={{ marginTop: "16px" }}>
                      <label>Kunci Jawaban yang Benar</label>
                      <select
                        className="form-control"
                        value={q.answer}
                        onChange={e => updateEditQuestion(qIdx, "answer", e.target.value)}
                      >
                        <option value={0}>Pilihan A</option>
                        <option value={1}>Pilihan B</option>
                        <option value={2}>Pilihan C</option>
                        <option value={3}>Pilihan D</option>
                      </select>
                    </div>
                  </div>
                ))}

                <button type="button" className="btn btn-secondary" onClick={addEditQuestionField} style={{ width: "100%", padding: "14px", marginTop: "4px", marginBottom: "16px" }}>
                  + Tambah Soal
                </button>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "14px", marginTop: "10px" }}>
                Simpan Perubahan Ujian
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

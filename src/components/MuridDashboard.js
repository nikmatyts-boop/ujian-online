"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/db";

export default function MuridDashboard({ user, onLogout }) {
  const [exams, setExams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeExam, setActiveExam] = useState(null); // The exam object currently taking
  const [currentSession, setCurrentSession] = useState(null); // The current active exam session

  // Active Exam State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { qId: optionIdx }
  const [flaggedQuestions, setFlaggedQuestions] = useState({}); // { qId: true/false } (Ragu-ragu)
  const [subjectsData, setSubjectsData] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [examResult, setExamResult] = useState(null); // For completion view
  const [showExitModal, setShowExitModal] = useState(false); // Modal izin keluar
  const [exitReason, setExitReason] = useState(""); // Alasan keluar

  const [shuffledQuestionOrder, setShuffledQuestionOrder] = useState([]); // List of question IDs in order
  const timerRef = useRef(null);
  const currentSessionRef = useRef(null);
  const activeExamRef = useRef(null);
  const selectedAnswersRef = useRef({});

  // Keep the ref in sync with state so the subscription callback always sees latest session
  useEffect(() => {
    currentSessionRef.current = currentSession;
    activeExamRef.current = activeExam;
    selectedAnswersRef.current = selectedAnswers;
  }, [currentSession, activeExam, selectedAnswers]);

  // Cleanup timer on unmount only
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadData(true); // autoResume = true on first mount
    };
    init();

    // Listen to real-time events (specifically teacher stopping exam or force logout)
    const unsubscribe = db.subscribe(async (msg) => {
      if (msg.type === "EXAM_STATUS_CHANGE") {
        // If teacher stopped our session
        const sess = currentSessionRef.current;
        if (msg.payload.isStopped && sess && msg.payload.sessionId === sess.id) {
          handleForceSubmit();
        }
      }
      if (msg.type === "FORCE_LOGOUT" && msg.payload.username === user.username) {
        alert("Anda telah di-logout oleh Guru. Silakan hubungi Guru pengawas jika diperlukan.");
        onLogout();
      }
    });

    return () => {
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (autoResume = false) => {
    const rawExams = await db.get("exams");
    const allExams = rawExams.map(e => ({ ...e, questions: e.questions || [] }));
    const allSessions = await db.get("sessions");
    const allSubjects = await db.get("subjects");
    setSubjectsData(allSubjects);
    
    // Murid can only see exams for their class AND if they are allowed (for make-up exams)
    const studentExams = allExams.filter(e => {
      if (e.classId !== user.classId) return false;
      if (e.isMakeup) {
        return e.allowedStudents && e.allowedStudents.includes(user.username);
      }
      return true;
    });
    setExams(studentExams);
    const mySessions = allSessions.filter(s => s.nisn === user.username);
    setSessions(mySessions);

    // Auto-resume: check if there is an unfinished session on first load
    if (autoResume && !activeExam && !examResult) {
      const unfinished = mySessions.find(s => !s.isFinished);
      if (unfinished) {
        const exam = studentExams.find(e => e.id === unfinished.examId);
        if (exam) {
          // Check if exam time hasn't ended yet
          const now = Date.now();
          const isEnded = exam.scheduledEnd ? now > new Date(exam.scheduledEnd).getTime() : false;
          if (!isEnded) {
            resumeExam(exam, unfinished);
          }
        }
      }
    }
  };

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

  // Resume an existing unfinished exam session (after refresh / forced exit)
  const resumeExam = (exam, session) => {
    setActiveExam(exam);
    setCurrentSession(session);
    setShuffledQuestionOrder(session.questionOrder || exam.questions.map(q => q.id));
    setSelectedAnswers(session.answers || {});
    setFlaggedQuestions(session.flagged || {});

    // Determine which question to show: go to the last answered question
    const order = session.questionOrder || exam.questions.map(q => q.id);
    let lastAnsweredIdx = 0;
    for (let i = order.length - 1; i >= 0; i--) {
      if (session.answers && session.answers[order[i]] !== undefined) {
        // Go to the next unanswered question, or stay on last if all answered
        lastAnsweredIdx = Math.min(i + 1, order.length - 1);
        break;
      }
    }
    setCurrentQuestionIdx(lastAnsweredIdx);

    // Calculate remaining time: how much time has elapsed since session started
    let durationSecs = exam.duration * 60;
    if (exam.scheduledEnd) {
      const now = Date.now();
      const end = new Date(exam.scheduledEnd).getTime();
      const remainingSecs = Math.floor((end - now) / 1000);
      durationSecs = Math.min(durationSecs, remainingSecs);
    }

    // Subtract elapsed time since original session start
    if (session.timeStartedSecs) {
      const elapsedSecs = Math.floor(Date.now() / 1000) - session.timeStartedSecs;
      durationSecs = durationSecs - elapsedSecs;
    }

    if (durationSecs <= 0) {
      // Time already expired while student was away — auto submit
      setCurrentSession(session);
      setActiveExam(exam);
      setTimeout(() => handleAutoSubmitSession(exam, session), 100);
      return;
    }

    setTimeLeft(Math.max(0, durationSecs));

    // Start Timer countdown
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Helper: auto-submit a specific session
  const handleAutoSubmitSession = async (exam, session) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const allSessions = await db.get("sessions");
    const currentS = allSessions.find(s => s.id === session.id);
    if (!currentS || currentS.isFinished) return;

    let correct = 0;
    let incorrect = 0;
    exam.questions.forEach(q => {
      const stuAns = currentS.answers[q.id];
      if (stuAns !== undefined && parseInt(stuAns, 10) === q.answer) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const updatedSession = {
      ...currentS,
      isFinished: true,
      correct,
      incorrect,
      endTime: new Date().toLocaleTimeString()
    };

    await db.save("sessions", updatedSession);

    setExamResult({
      correct,
      incorrect,
      total: exam.questions.length,
      isStopped: false
    });

    setActiveExam(null);
    setCurrentSession(null);
    await loadData();
    db.notify("EXAM_SUBMITTED", { nisn: user.username });
  };

  // Start Exam
  const startExam = async (exam) => {
    // Check if already finished
    const existing = sessions.find(s => s.examId === exam.id);
    if (existing && existing.isFinished) {
      alert("Anda sudah menyelesaikan ujian ini.");
      return;
    }

    // If there's an existing unfinished session, resume it instead of creating a new one
    if (existing && !existing.isFinished) {
      resumeExam(exam, existing);
      return;
    }

    // Prepare questions order (randomize if active)
    let questionOrder = exam.questions.map(q => q.id);
    if (exam.randomize) {
      // Shuffle algorithm
      questionOrder = [...questionOrder].sort(() => Math.random() - 0.5);
    }

    const newSession = {
      id: "sess-" + Date.now(),
      examId: exam.id,
      nisn: user.username,
      startTime: new Date().toLocaleTimeString(),
      answers: {},
      flagged: {},
      questionOrder,
      isFinished: false,
      isStopped: false,
      timeStartedSecs: Math.floor(Date.now() / 1000)
    };

    await db.save("sessions", newSession);

    setActiveExam(exam);
    setCurrentSession(newSession);
    setShuffledQuestionOrder(questionOrder);
    setSelectedAnswers({});
    setFlaggedQuestions({});
    setCurrentQuestionIdx(0);
    
    // Calculate remaining seconds until end of exam or max duration
    let durationSecs = exam.duration * 60;
    if (exam.scheduledEnd) {
      const now = Date.now();
      const end = new Date(exam.scheduledEnd).getTime();
      const remainingSecs = Math.floor((end - now) / 1000);
      durationSecs = Math.min(durationSecs, remainingSecs);
    }
    setTimeLeft(Math.max(0, durationSecs));

    db.notify("EXAM_STATUS_CHANGE", { sessionId: newSession.id, status: "started" });

    // Start Timer countdown
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Autosave answer to Server
  const saveAnswer = async (questionId, optionIdx, isFlagged = false) => {
    if (!currentSession) return;

    // Update session data
    const updatedAnswers = { ...selectedAnswers };
    const updatedFlagged = { ...flaggedQuestions };

    if (optionIdx !== null) {
      updatedAnswers[questionId] = optionIdx;
      setSelectedAnswers(updatedAnswers);
    }
    
    updatedFlagged[questionId] = isFlagged;
    setFlaggedQuestions(updatedFlagged);

    const updatedSession = {
      ...currentSession,
      answers: updatedAnswers,
      flagged: updatedFlagged
    };
    
    setCurrentSession(updatedSession);
    await db.save("sessions", updatedSession);
    db.notify("EXAM_STATUS_CHANGE", { sessionId: currentSession.id, answers: updatedAnswers });
  };

  // Force Submission (called when Guru triggers "Hentikan")
  const handleForceSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const currentActiveExam = activeExamRef.current;
    const currentSelectedAnswers = selectedAnswersRef.current;
    const currentSessionLatest = currentSessionRef.current;
    
    if (!currentActiveExam || !currentSessionLatest) return;

    // Calculate score
    let correct = 0;
    let incorrect = 0;
    currentActiveExam.questions.forEach(q => {
      const stuAns = currentSelectedAnswers[q.id];
      if (stuAns !== undefined && parseInt(stuAns, 10) === q.answer) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const updatedSession = {
      ...currentSessionLatest,
      isFinished: true,
      isStopped: true,
      correct,
      incorrect,
      endTime: new Date().toLocaleTimeString()
    };

    await db.save("sessions", updatedSession);
    
    // Set UI Results Screen
    setExamResult({
      correct,
      incorrect,
      total: currentActiveExam.questions.length,
      isStopped: true
    });

    setActiveExam(null);
    setCurrentSession(null);
    await loadData();
    db.notify("EXAM_SUBMITTED", { nisn: user.username });
  };

  // Submit Exam manually or on timeout
  const handleSubmitExam = () => {
    if (!window.confirm("Apakah Anda yakin ingin menyelesaikan ujian ini?")) return;
    handleAutoSubmit();
  };

  const handleAutoSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    const currentActiveExam = activeExamRef.current;
    const currentSelectedAnswers = selectedAnswersRef.current;
    const currentSessionLatest = currentSessionRef.current;
    
    if (!currentActiveExam || !currentSessionLatest) return;

    let correct = 0;
    let incorrect = 0;
    currentActiveExam.questions.forEach(q => {
      const stuAns = currentSelectedAnswers[q.id];
      if (stuAns !== undefined && parseInt(stuAns, 10) === q.answer) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const updatedSession = {
      ...currentSessionLatest,
      isFinished: true,
      correct,
      incorrect,
      endTime: new Date().toLocaleTimeString()
    };

    await db.save("sessions", updatedSession);

    setExamResult({
      correct,
      incorrect,
      total: currentActiveExam.questions.length,
      isStopped: false
    });

    setActiveExam(null);
    setCurrentSession(null);
    await loadData();
    db.notify("EXAM_SUBMITTED", { nisn: user.username });
  };

  // Handle Exit Request — Izin Keluar
  const handleExitRequest = async () => {
    if (!exitReason.trim()) return;
    
    const exitRequest = {
      id: "exit-" + Date.now(),
      sessionId: currentSession.id,
      nisn: user.username,
      nama: user.nama,
      examId: activeExam.id,
      reason: exitReason.trim(),
      timestamp: new Date().toISOString(),
      status: "pending" // pending | approved
    };

    await db.save("exitRequests", exitRequest);
    db.notify("EXIT_REQUEST", exitRequest);

    setShowExitModal(false);
    setExitReason("");
    alert("Permintaan izin keluar telah dikirim ke Guru. Silakan tunggu persetujuan.");
  };

  // Keyboard Shortcuts (Web Navigation)
  useEffect(() => {
    if (!activeExam) return;

    const handleKeyDown = (e) => {
      // Disable shortcuts when typing in inputs/textareas or when exit modal is open
      if (showExitModal || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      const key = e.key.toUpperCase();
      const currentQId = shuffledQuestionOrder[currentQuestionIdx];

      if (key === "A") saveAnswer(currentQId, 0, flaggedQuestions[currentQId] || false);
      if (key === "B") saveAnswer(currentQId, 1, flaggedQuestions[currentQId] || false);
      if (key === "C") saveAnswer(currentQId, 2, flaggedQuestions[currentQId] || false);
      if (key === "D") saveAnswer(currentQId, 3, flaggedQuestions[currentQId] || false);
      
      if (e.key === "ArrowRight") {
        if (currentQuestionIdx < shuffledQuestionOrder.length - 1) {
          setCurrentQuestionIdx(prev => prev + 1);
        }
      }
      if (e.key === "ArrowLeft") {
        if (currentQuestionIdx > 0) {
          setCurrentQuestionIdx(prev => prev - 1);
        }
      }
      if (key === "R" || e.key === " ") {
        // Toggle Ragu-ragu (Flag)
        e.preventDefault();
        const nextFlag = !flaggedQuestions[currentQId];
        saveAnswer(currentQId, selectedAnswers[currentQId] ?? null, nextFlag);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeExam, currentQuestionIdx, shuffledQuestionOrder, selectedAnswers, flaggedQuestions, showExitModal]);

  // Format Time Helper
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Active Question Data Helper
  const activeQuestionId = shuffledQuestionOrder[currentQuestionIdx];
  const activeQuestion = activeExam?.questions.find(q => q.id === activeQuestionId);

  return (
    <div className="app-container">
      {/* Sidebar for navigation */}
      {!activeExam && (
        <aside className="sidebar">
          <div className="sidebar-logo">
            EXAM<span>PRO</span>
          </div>
          <ul className="sidebar-menu">
            <li className="sidebar-item active">Ujian Tersedia</li>
          </ul>
          <div className="sidebar-footer">
            <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
              NISN: <strong>{user.username}</strong>
            </div>
            <button className="btn btn-danger" style={{ width: "100%", padding: "8px 16px" }} onClick={onLogout}>
              Logout
            </button>
          </div>
        </aside>
      )}

      {/* Main Container */}
      <main className="main-content" style={{ width: activeExam ? "100%" : "auto" }}>
        
        {/* Results Screen */}
        {examResult && (
          <div className="glass-card" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
            <h2 style={{ color: "var(--color-success)", marginBottom: "16px" }}>
              {examResult.isStopped ? "Ujian Diberhentikan!" : "Ujian Selesai!"}
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
              {examResult.isStopped 
                ? "Ujian Anda telah diberhentikan secara paksa oleh Guru. Nilai Anda yang terkumpul telah direkam."
                : "Jawaban Anda berhasil disimpan dan dianalisis."}
            </p>
            
            <div className="stats-grid" style={{ marginBottom: "24px" }}>
              <div className="stat-card">
                <span className="stat-label">Jawaban Benar</span>
                <span className="stat-val" style={{ color: "var(--color-success)" }}>{examResult.correct}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Jawaban Salah</span>
                <span className="stat-val" style={{ color: "var(--color-danger)" }}>{examResult.incorrect}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Nilai Akhir</span>
                <span className="stat-val">
                  {Math.round((examResult.correct / examResult.total) * 100)}
                </span>
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => setExamResult(null)}>
              Kembali Ke Menu Utama
            </button>
          </div>
        )}

        {/* Regular Dashboard Panel */}
        {!activeExam && !examResult && (
          <div>
            <header className="header-bar">
              <div className="page-title">
                <h1>Halo, {user.nama}</h1>
                <p>Silakan pilih ujian aktif untuk memulai pengerjaan.</p>
              </div>
              <div className="user-profile-badge">
                <span className="user-role-tag">Murid</span>
                <span>{user.nama}</span>
              </div>
            </header>

            <div className="glass-card">
              <h3 style={{ marginBottom: "16px" }}>Daftar Ujian Aktif</h3>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Judul Ujian</th>
                      <th>Mata Pelajaran</th>
                      <th>Jadwal Mulai</th>
                      <th>Durasi</th>
                      <th>Status Ujian</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map(ex => {
                      const subject = subjectsData.find(s => s.id === ex.subjectId);
                      const sess = sessions.find(s => s.examId === ex.id);
                      const nowTime = new Date().getTime();
                      
                      const isStarted = ex.scheduledStart 
                        ? nowTime >= new Date(ex.scheduledStart).getTime() 
                        : true;
                        
                      const isEnded = ex.scheduledEnd 
                        ? nowTime > new Date(ex.scheduledEnd).getTime() 
                        : false;

                      return (
                        <tr key={ex.id}>
                          <td style={{ fontWeight: "600" }}>
                            {ex.title}
                            {ex.isMakeup && (
                              <span className="badge badge-warning" style={{ marginLeft: "8px", fontSize: "10px", padding: "2px 6px", backgroundColor: "rgba(251, 191, 36, 0.15)", color: "#f59e0b", border: "1px solid #f59e0b" }}>SUSULAN</span>
                            )}
                          </td>
                          <td>{subject?.name || "Mata Pelajaran"}</td>
                          <td style={{ fontSize: "13px" }}>
                            {formatTimeSlot(ex.scheduledStart, ex.scheduledEnd)}
                          </td>
                          <td>{ex.duration} Menit</td>
                          <td>
                            {sess?.isFinished ? (
                              <span className="badge badge-success">Selesai</span>
                            ) : sess && !sess.isFinished ? (
                              <span className="badge badge-info" style={{ animation: "pulse 1.5s infinite" }}>Sedang Dikerjakan</span>
                            ) : isEnded ? (
                              <span className="badge badge-danger">Waktu Habis</span>
                            ) : !isStarted ? (
                              <span className="badge badge-danger">Belum Mulai</span>
                            ) : (
                              <span className="badge badge-warning">Tersedia</span>
                            )}
                          </td>
                          <td>
                            {sess?.isFinished ? (
                              <button className="btn btn-secondary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                                Sudah Diikuti
                              </button>
                            ) : sess && !sess.isFinished ? (
                              <button className="btn btn-warning" style={{ fontWeight: "700" }} onClick={() => startExam(ex)}>
                                Lanjutkan Ujian
                              </button>
                            ) : isEnded ? (
                              <button className="btn btn-secondary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                                Terlewat
                              </button>
                            ) : !isStarted ? (
                              <button className="btn btn-secondary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                                Belum Dibuka
                              </button>
                            ) : (
                              <button className="btn btn-primary" onClick={() => startExam(ex)}>
                                Mulai Ujian
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {exams.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          Saat ini belum ada ujian tersedia untuk kelas Anda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Exam Taking Interface */}
        {activeExam && activeQuestion && (
          <div>
            {/* Exam Top Header */}
            <div className="header-bar" style={{ borderBottom: "1px solid var(--card-border)", paddingBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{activeExam.title}</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  Mengerjakan ujian secara real-time. Jangan tutup halaman ini.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "8px 16px", borderRadius: "99px", fontWeight: "800", fontSize: "18px" }}>
                  ⏳ {formatTime(timeLeft)}
                </div>
                <button className="btn" onClick={() => setShowExitModal(true)} style={{ backgroundColor: "rgba(251, 191, 36, 0.15)", border: "1px solid #f59e0b", color: "#f59e0b", fontWeight: "600", fontSize: "13px" }}>
                  🚪 Izin Keluar
                </button>
                <button className="btn btn-success" onClick={handleSubmitExam}>
                  Selesai Ujian
                </button>
              </div>
            </div>

            {/* Modal Izin Keluar */}
            {showExitModal && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)" }}>
                <div className="glass-card" style={{ width: "90%", maxWidth: "450px", padding: "28px" }}>
                  <h3 style={{ marginBottom: "4px" }}>🚪 Izin Keluar dari Ujian</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
                    Permintaan ini akan dikirim langsung ke Guru pengawas. Tuliskan alasan Anda dengan jelas.
                  </p>
                  <div className="form-group">
                    <label>Alasan / Keterangan</label>
                    <textarea
                      rows="3"
                      className="form-control"
                      placeholder="Contoh: Izin ke toilet, sakit perut, dll."
                      value={exitReason}
                      onChange={e => setExitReason(e.target.value)}
                      autoFocus
                    ></textarea>
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleExitRequest} disabled={!exitReason.trim()}>
                      Kirim Permintaan
                    </button>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowExitModal(false); setExitReason(""); }}>
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Exam Content Split-Grid */}
            <div className="exam-layout" style={{ marginTop: "24px" }}>
              
              {/* Question Screen */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", minHeight: "350px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-primary)" }}>
                    PERTANYAAN {currentQuestionIdx + 1} DARI {shuffledQuestionOrder.length}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Kunci Pintas: Tekan A, B, C, D (Pilih) | R/Space (Ragu-ragu) | Panah Kiri/Kanan (Navigasi)
                  </span>
                </div>

                <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "24px", whiteSpace: "pre-line" }}>
                  {activeQuestion.text}
                </p>

                {/* Options List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", flexGrow: 1 }}>
                  {activeQuestion.options.map((opt, oIdx) => {
                    const isChecked = selectedAnswers[activeQuestion.id] === oIdx;
                    return (
                      <div
                        key={oIdx}
                        onClick={() => saveAnswer(activeQuestion.id, oIdx, flaggedQuestions[activeQuestion.id] || false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "16px",
                          borderRadius: "var(--radius-md)",
                          backgroundColor: isChecked ? "rgba(99, 102, 241, 0.1)" : "var(--bg-tertiary)",
                          border: `1px solid ${isChecked ? "var(--color-primary)" : "var(--card-border)"}`,
                          cursor: "pointer",
                          transition: "var(--transition)"
                        }}
                      >
                        <div
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            border: `2px solid ${isChecked ? "var(--color-primary)" : "var(--text-muted)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: "bold",
                            backgroundColor: isChecked ? "var(--color-primary)" : "transparent",
                            color: isChecked ? "white" : "var(--text-secondary)"
                          }}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: "500", color: isChecked ? "white" : "var(--text-primary)" }}>
                          {opt}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom navigation buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "32px", borderTop: "1px solid var(--card-border)", paddingTop: "20px" }}>
                  <button
                    className="btn btn-secondary"
                    disabled={currentQuestionIdx === 0}
                    onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                  >
                    Sebelumnya
                  </button>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      style={{ width: "18px", height: "18px", accentColor: "var(--color-warning)" }}
                      checked={flaggedQuestions[activeQuestion.id] || false}
                      onChange={(e) => saveAnswer(activeQuestion.id, selectedAnswers[activeQuestion.id] ?? null, e.target.checked)}
                    />
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--color-warning)" }}>Ragu-Ragu</span>
                  </label>

                  <button
                    className="btn btn-primary"
                    disabled={currentQuestionIdx === shuffledQuestionOrder.length - 1}
                    onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>

              {/* Sidebar (Cinema-seating-like Question Navigation Grid) */}
              <div className="glass-card" style={{ height: "fit-content" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Denah Soal Ujian</h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Pilih nomor soal untuk langsung menuju ke halaman soal tersebut.
                </p>

                <div className="question-grid">
                  {shuffledQuestionOrder.map((qId, idx) => {
                    const isCurrent = idx === currentQuestionIdx;
                    const isAnswered = selectedAnswers[qId] !== undefined;
                    const isFlagged = flaggedQuestions[qId];

                    let stateClass = "seat-gray";
                    if (isCurrent) {
                      stateClass = "seat-blue";
                    } else if (isFlagged) {
                      stateClass = "seat-orange";
                    } else if (isAnswered) {
                      stateClass = "seat-green";
                    }

                    return (
                      <div
                        key={idx}
                        className={`seat-number ${stateClass}`}
                        onClick={() => setCurrentQuestionIdx(idx)}
                      >
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--card-border)", paddingTop: "16px", fontSize: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "3px" }} className="seat-blue"></div>
                    <span>Soal Aktif</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "3px" }} className="seat-green"></div>
                    <span>Sudah Dijawab</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "3px" }} className="seat-orange"></div>
                    <span>Ragu-Ragu</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "3px" }} className="seat-gray"></div>
                    <span>Belum Dijawab</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

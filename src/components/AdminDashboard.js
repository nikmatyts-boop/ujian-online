"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  
  // Data States
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [exams, setExams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);

  // Forms States
  const [className, setClassName] = useState("");
  
  const [subjectName, setSubjectName] = useState("");
  const [subjectClass, setSubjectClass] = useState("");

  const [guruNip, setGuruNip] = useState("");
  const [guruNama, setGuruNama] = useState("");
  const [guruPass, setGuruPass] = useState("");
  const [guruHp, setGuruHp] = useState("");
  const [guruAlamat, setGuruAlamat] = useState("");

  const [muridNisn, setMuridNisn] = useState("");
  const [muridNama, setMuridNama] = useState("");
  const [muridPass, setMuridPass] = useState("");
  const [muridHp, setMuridHp] = useState("");
  const [muridAlamat, setMuridAlamat] = useState("");
  const [muridClass, setMuridClass] = useState("");

  const [ortuUser, setOrtuUser] = useState("");
  const [ortuPass, setOrtuPass] = useState("");
  const [ortuNisn, setOrtuNisn] = useState("");

  const [selectedExamId, setSelectedExamId] = useState(null);
  
  const [filterExamDate, setFilterExamDate] = useState("");
  const [filterExamClass, setFilterExamClass] = useState("");

  // Edit User State
  const [editingUser, setEditingUser] = useState(null); // stores user object being edited
  const [editNama, setEditNama] = useState("");
  const [editPass, setEditPass] = useState("");
  const [editHp, setEditHp] = useState("");
  const [editAlamat, setEditAlamat] = useState("");
  const [editClassId, setEditClassId] = useState("");
  const [editStudentNisn, setEditStudentNisn] = useState("");

  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    const init = async () => {
      await loadData();
    };
    init();

    // Subscribe to real-time events
    const unsubscribe = db.subscribe(async (msg) => {
      if (msg.type === "LOGIN_CHANGE" || msg.type === "EXAM_STATUS_CHANGE" || msg.type === "EXAM_SUBMITTED") {
        await loadData();
      }
    });

    // Poll every 3 seconds for live monitoring updates
    const timer = setInterval(() => {
      loadData();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const loadData = async () => {
    const [c, s, u, e, sess, l] = await Promise.all([
      db.get("classes"),
      db.get("subjects"),
      db.get("users"),
      db.get("exams"),
      db.get("sessions"),
      db.get("loginLogs")
    ]);
    setClasses(c);
    setSubjects(s);
    setUsers(u);
    setExams(e.map(ex => ({ ...ex, questions: ex.questions || [] })));
    setSessions(sess);
    setLoginLogs(l);
  };

  const showMsg = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 4000);
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!className.trim()) return;

    const newClass = {
      id: "class-" + Date.now(),
      name: className.trim()
    };

    const updated = [...classes, newClass];
    await db.save("classes", newClass);
    setClasses(updated);
    setClassName("");
    showMsg(`Kelas ${newClass.name} berhasil dibuat!`);
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!subjectName.trim() || !subjectClass) return;

    const newSub = {
      id: "sub-" + Date.now(),
      name: subjectName.trim(),
      classId: subjectClass
    };

    const updated = [...subjects, newSub];
    await db.save("subjects", newSub);
    setSubjects(updated);
    setSubjectName("");
    setSubjectClass("");
    showMsg(`Mata Pelajaran ${newSub.name} berhasil dibuat!`);
  };

  const handleAddGuru = async (e) => {
    e.preventDefault();
    if (!guruNip || !guruNama || !guruPass || !guruHp || !guruAlamat) {
      showMsg("Semua bidang data Guru harus diisi!", "danger");
      return;
    }

    if (users.some(u => u.username === guruNip)) {
      showMsg("Username/NIP sudah terdaftar!", "danger");
      return;
    }

    const newGuru = {
      id: "guru-" + Date.now(),
      username: guruNip.trim(),
      nama: guruNama.trim(),
      password: guruPass,
      hp: guruHp.trim(),
      alamat: guruAlamat.trim(),
      role: "guru"
    };

    const updated = [...users, newGuru];
    await db.save("users", newGuru);
    setUsers(updated);
    
    // Reset fields
    setGuruNip("");
    setGuruNama("");
    setGuruPass("");
    setGuruHp("");
    setGuruAlamat("");
    showMsg(`Guru ${newGuru.nama} berhasil dibuat!`);
  };

  const handleAddMurid = async (e) => {
    e.preventDefault();
    if (!muridNisn || !muridNama || !muridPass || !muridHp || !muridAlamat || !muridClass) {
      showMsg("Semua bidang data Murid harus diisi!", "danger");
      return;
    }

    if (users.some(u => u.username === muridNisn)) {
      showMsg("Username/NISN sudah terdaftar!", "danger");
      return;
    }

    const newMurid = {
      id: "murid-" + Date.now(),
      username: muridNisn.trim(),
      nama: muridNama.trim(),
      password: muridPass,
      hp: muridHp.trim(),
      alamat: muridAlamat.trim(),
      classId: muridClass,
      role: "murid"
    };

    const updated = [...users, newMurid];
    await db.save("users", newMurid);
    setUsers(updated);

    // Reset fields
    setMuridNisn("");
    setMuridNama("");
    setMuridPass("");
    setMuridHp("");
    setMuridAlamat("");
    setMuridClass("");
    showMsg(`Murid ${newMurid.nama} berhasil dibuat!`);
  };

  const handleAddOrtu = async (e) => {
    e.preventDefault();
    if (!ortuUser || !ortuPass || !ortuNisn) {
      showMsg("Semua bidang data Orang Tua harus diisi!", "danger");
      return;
    }

    if (users.some(u => u.username === ortuUser)) {
      showMsg("Username sudah terdaftar!", "danger");
      return;
    }

    const newOrtu = {
      id: "ortu-" + Date.now(),
      username: ortuUser.trim(),
      nama: `Orang Tua dari ${users.find(u => u.username === ortuNisn)?.nama || "Murid"}`,
      password: ortuPass,
      studentNisn: ortuNisn,
      role: "ortu"
    };

    const updated = [...users, newOrtu];
    await db.save("users", newOrtu);
    setUsers(updated);

    setOrtuUser("");
    setOrtuPass("");
    setOrtuNisn("");
    showMsg(`Orang Tua berhasil dibuat!`);
  };

  // Delete User Action
  const handleDeleteUser = async (id, username, nama) => {
    if (id === user.id || username === "admin") {
      showMsg("Tidak dapat menghapus akun Admin utama yang sedang login!", "danger");
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun "${nama}"?`)) {
      return;
    }

    await db.delete("users", "id", id);
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    showMsg(`Akun "${nama}" berhasil dihapus.`);
  };

  // Open Edit User Modal/Form
  const handleStartEdit = (u) => {
    setEditingUser(u);
    setEditNama(u.nama);
    setEditPass(u.password);
    setEditHp(u.hp || "");
    setEditAlamat(u.alamat || "");
    setEditClassId(u.classId || "");
    setEditStudentNisn(u.studentNisn || "");
  };

  // Save Edit User Action
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editNama.trim() || !editPass.trim()) {
      showMsg("Nama dan Password tidak boleh kosong!", "danger");
      return;
    }

    let updatedUserObj = null;

    const updated = users.map(u => {
      if (u.id === editingUser.id) {
        const updatedUser = {
          ...u,
          nama: editNama.trim(),
          password: editPass.trim(),
          hp: editHp.trim(),
          alamat: editAlamat.trim(),
        };
        if (u.role === "murid") {
          updatedUser.classId = editClassId;
        }
        if (u.role === "ortu") {
          updatedUser.studentNisn = editStudentNisn;
          // Update Orang Tua Name based on the student link
          const child = users.find(child => child.username === editStudentNisn);
          updatedUser.nama = `Orang Tua dari ${child ? child.nama : "Murid"}`;
        }
        updatedUserObj = updatedUser;
        return updatedUser;
      }
      return u;
    });

    if (updatedUserObj) {
      await db.save("users", updatedUserObj);
    }
    setUsers(updated);
    setEditingUser(null);
    showMsg(`Perubahan akun "${editNama}" berhasil disimpan!`);
  };

  // Time Formatter helper
  const formatTimeSlot = (start, end) => {
    if (!start || !end) return "-";
    const startDate = new Date(start);
    const endDate = new Date(end);
    const dateStr = startDate.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' });
    const startTimeStr = startDate.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = endDate.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} (${startTimeStr} - ${endTimeStr})`;
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          EXAM<span>PRO</span>
        </div>
        <ul className="sidebar-menu">
          <li className={`sidebar-item ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            Ringkasan
          </li>
          <li className={`sidebar-item ${activeTab === "class-mapel" ? "active" : ""}`} onClick={() => setActiveTab("class-mapel")}>
            Kelas & Mapel
          </li>
          <li className={`sidebar-item ${activeTab === "guru" ? "active" : ""}`} onClick={() => setActiveTab("guru")}>
            Guru
          </li>
          <li className={`sidebar-item ${activeTab === "murid" ? "active" : ""}`} onClick={() => setActiveTab("murid")}>
            Murid & Orang Tua
          </li>
          <li className={`sidebar-item ${activeTab === "monitoring" ? "active" : ""}`} onClick={() => setActiveTab("monitoring")}>
            Monitoring
          </li>
        </ul>
        <div className="sidebar-footer">
          <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
            Logged in as <strong>{user.nama}</strong>
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
            <h1>Admin Panel</h1>
            <p>Manajemen data sekolah, guru, murid dan mata pelajaran</p>
          </div>
          <div className="user-profile-badge">
            <span className="user-role-tag">Admin</span>
            <span>{user.nama}</span>
          </div>
        </header>

        {message.text && (
          <div
            style={{
              backgroundColor: message.type === "danger" ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
              border: `1px solid ${message.type === "danger" ? "var(--color-danger)" : "var(--color-success)"}`,
              color: message.type === "danger" ? "var(--color-danger)" : "var(--color-success)",
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

        {/* Tab CONTENT: Overview */}
        {activeTab === "overview" && (
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Guru</span>
                <span className="stat-val">{users.filter(u => u.role === "guru").length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Murid</span>
                <span className="stat-val">{users.filter(u => u.role === "murid").length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Kelas</span>
                <span className="stat-val">{classes.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Mata Pelajaran</span>
                <span className="stat-val">{subjects.length}</span>
              </div>
            </div>

            <div className="glass-card">
              <h2 style={{ marginBottom: "16px" }}>Dashboard Administrator</h2>
              <p style={{ color: "var(--text-secondary)" }}>
                Selamat datang di sistem manajemen EXAM-PRO. Di panel ini Anda dapat mengkonfigurasi kebutuhan dasar sekolah mulai dari pembuatan kelas, mata pelajaran, serta akun Guru, Murid, dan Orang Tua. Gunakan menu navigasi di sebelah kiri untuk mulai mengelola data.
              </p>
            </div>
          </div>
        )}

        {/* Tab CONTENT: Kelas & Mapel */}
        {activeTab === "class-mapel" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }} className="form-row">
            {/* Kelas section */}
            <div>
              <div className="glass-card">
                <h3 style={{ marginBottom: "16px" }}>Buat Kelas Baru</h3>
                <form onSubmit={handleAddClass}>
                  <div className="form-group">
                    <label>Nama Kelas</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: Kelas 10-A"
                      value={className}
                      onChange={e => setClassName(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                    Simpan Kelas
                  </button>
                </form>
              </div>

              <div className="glass-card">
                <h3 style={{ marginBottom: "16px" }}>Daftar Kelas ({classes.length})</h3>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ID Kelas</th>
                        <th>Nama Kelas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map(cls => (
                        <tr key={cls.id}>
                          <td><code>{cls.id}</code></td>
                          <td>{cls.name}</td>
                        </tr>
                      ))}
                      {classes.length === 0 && (
                        <tr>
                          <td colSpan="2" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                            Belum ada kelas yang terdaftar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mapel section */}
            <div>
              <div className="glass-card">
                <h3 style={{ marginBottom: "16px" }}>Buat Mata Pelajaran Baru</h3>
                <form onSubmit={handleAddSubject}>
                  <div className="form-group">
                    <label>Nama Mata Pelajaran</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: Matematika"
                      value={subjectName}
                      onChange={e => setSubjectName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Pilih Kelas</label>
                    <select
                      className="form-control"
                      value={subjectClass}
                      onChange={e => setSubjectClass(e.target.value)}
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                    Simpan Mata Pelajaran
                  </button>
                </form>
              </div>

              <div className="glass-card">
                <h3 style={{ marginBottom: "16px" }}>Daftar Mata Pelajaran ({subjects.length})</h3>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Nama Mapel</th>
                        <th>Kelas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(sub => (
                        <tr key={sub.id}>
                          <td>{sub.name}</td>
                          <td>{classes.find(c => c.id === sub.classId)?.name || "Unknown Class"}</td>
                        </tr>
                      ))}
                      {subjects.length === 0 && (
                        <tr>
                          <td colSpan="2" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                            Belum ada mata pelajaran.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab CONTENT: Guru */}
        {activeTab === "guru" && (
          <div>
            <div className="glass-card">
              <h3 style={{ marginBottom: "16px" }}>Tambah Akun Guru</h3>
              <form onSubmit={handleAddGuru}>
                <div className="form-row">
                  <div className="form-group">
                    <label>NIP (Username)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Masukkan NIP Guru"
                      value={guruNip}
                      onChange={e => setGuruNip(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nama Lengkap</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Masukkan Nama Beserta Gelar"
                      value={guruNama}
                      onChange={e => setGuruNama(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Password login Guru"
                      value={guruPass}
                      onChange={e => setGuruPass(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nomor HP</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: 0812xxxxxxxx"
                      value={guruHp}
                      onChange={e => setGuruHp(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Alamat Lengkap</label>
                  <textarea
                    rows="2"
                    className="form-control"
                    placeholder="Masukkan alamat tinggal"
                    value={guruAlamat}
                    onChange={e => setGuruAlamat(e.target.value)}
                  ></textarea>
                </div>
                <button type="submit" className="btn btn-primary">
                  Simpan Akun Guru
                </button>
              </form>
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: "16px" }}>Daftar Guru Terdaftar</h3>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>NIP</th>
                      <th>Nama Lengkap</th>
                      <th>No. HP</th>
                      <th>Alamat</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === "guru").map(g => (
                      <tr key={g.id}>
                        <td><code>{g.username}</code></td>
                        <td style={{ fontWeight: "600" }}>{g.nama}</td>
                        <td>{g.hp}</td>
                        <td>{g.alamat}</td>
                        <td>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => handleStartEdit(g)}>
                              Edit
                            </button>
                            <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => handleDeleteUser(g.id, g.username, g.nama)}>
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab CONTENT: Murid & Ortu */}
        {activeTab === "murid" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }} className="form-row">
            {/* Murid Section */}
            <div>
              <div className="glass-card">
                <h3 style={{ marginBottom: "16px" }}>Tambah Akun Murid</h3>
                <form onSubmit={handleAddMurid}>
                  <div className="form-group">
                    <label>NISN (Username)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Masukkan NISN Murid"
                      value={muridNisn}
                      onChange={e => setMuridNisn(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nama Lengkap</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nama Lengkap Murid"
                      value={muridNama}
                      onChange={e => setMuridNama(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Password"
                        value={muridPass}
                        onChange={e => setMuridPass(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Pilih Kelas</label>
                      <select
                        className="form-control"
                        value={muridClass}
                        onChange={e => setMuridClass(e.target.value)}
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Nomor HP</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nomor HP"
                      value={muridHp}
                      onChange={e => setMuridHp(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Alamat Lengkap</label>
                    <textarea
                      rows="2"
                      className="form-control"
                      placeholder="Alamat tempat tinggal"
                      value={muridAlamat}
                      onChange={e => setMuridAlamat(e.target.value)}
                    ></textarea>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                    Simpan Akun Murid
                  </button>
                </form>
              </div>

              <div className="glass-card">
                <h3 style={{ marginBottom: "16px" }}>Daftar Murid ({users.filter(u => u.role === "murid").length})</h3>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>NISN</th>
                        <th>Nama</th>
                        <th>Kelas</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.filter(u => u.role === "murid").map(m => (
                        <tr key={m.id}>
                          <td><code>{m.username}</code></td>
                          <td style={{ fontWeight: "600" }}>{m.nama}</td>
                          <td>{classes.find(c => c.id === m.classId)?.name || "-"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleStartEdit(m)}>
                                Edit
                              </button>
                              <button className="btn btn-danger" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleDeleteUser(m.id, m.username, m.nama)}>
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Orang Tua Section */}
            <div>
              <div className="glass-card">
                <h3 style={{ marginBottom: "16px" }}>Tambah Akun Orang Tua</h3>
                <form onSubmit={handleAddOrtu}>
                  <div className="form-group">
                    <label>Username Orang Tua</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: ortu_nama_anak"
                      value={ortuUser}
                      onChange={e => setOrtuUser(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Password"
                      value={ortuPass}
                      onChange={e => setOrtuPass(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Pilih Anak (Hubungkan NISN)</label>
                    <select
                      className="form-control"
                      value={ortuNisn}
                      onChange={e => setOrtuNisn(e.target.value)}
                    >
                      <option value="">-- Pilih Murid --</option>
                      {users.filter(u => u.role === "murid").map(m => (
                        <option key={m.id} value={m.username}>{m.nama} (NISN: {m.username})</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                    Simpan Akun Orang Tua
                  </button>
                </form>
              </div>

              <div className="glass-card">
                <h3 style={{ marginBottom: "16px" }}>Daftar Akun Orang Tua ({users.filter(u => u.role === "ortu").length})</h3>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Nama Anak (Murid)</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.filter(u => u.role === "ortu").map(o => (
                        <tr key={o.id}>
                          <td><code>{o.username}</code></td>
                          <td>{users.find(u => u.username === o.studentNisn)?.nama || "Unknown"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleStartEdit(o)}>
                                Edit
                              </button>
                              <button className="btn btn-danger" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleDeleteUser(o.id, o.username, o.nama)}>
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab CONTENT: Monitoring */}
        {activeTab === "monitoring" && (
          <div>
            {/* Section 1: Daftar Semua Ujian */}
            <div className="glass-card">
              <h3 style={{ marginBottom: "16px" }}>Daftar Ujian</h3>
              
              {/* Filter Section */}
              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Filter Tanggal Ujian</label>
                  <input
                    type="date"
                    className="form-control"
                    value={filterExamDate}
                    onChange={e => setFilterExamDate(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Filter Kelas</label>
                  <select
                    className="form-control"
                    value={filterExamClass}
                    onChange={e => setFilterExamClass(e.target.value)}
                  >
                    <option value="">-- Semua Kelas --</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Nama Ujian</th>
                      <th>Mata Pelajaran</th>
                      <th>Kelas</th>
                      <th>Nama Guru</th>
                      <th>Jadwal</th>
                      <th>Status Ujian</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredExams = exams.filter(e => {
                        const matchClass = filterExamClass ? e.classId === filterExamClass : true;
                        let matchDate = true;
                        if (filterExamDate && e.scheduledStart) {
                          // Extract just the YYYY-MM-DD from scheduledStart local time
                          const d = new Date(e.scheduledStart);
                          const pad = n => n.toString().padStart(2, '0');
                          const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                          matchDate = dateStr === filterExamDate;
                        }
                        return matchClass && matchDate;
                      });

                      if (filteredExams.length === 0) {
                        return (
                          <tr>
                            <td colSpan="7" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                              Belum ada ujian yang sesuai kriteria pencarian.
                            </td>
                          </tr>
                        );
                      }

                      return filteredExams.map(exam => {
                        const cls = classes.find(c => c.id === exam.classId);
                        const sub = subjects.find(s => s.id === exam.subjectId);
                        const teacher = users.find(u => u.id === exam.teacherId);
                        
                        const nowTime = new Date().getTime();
                        let statusBadge = null;
                        if (exam.scheduledStart && nowTime < new Date(exam.scheduledStart).getTime()) {
                          statusBadge = <span className="badge badge-warning">Belum Mulai</span>;
                        } else if (exam.scheduledEnd && nowTime > new Date(exam.scheduledEnd).getTime()) {
                          statusBadge = <span className="badge badge-danger">Selesai</span>;
                        } else {
                          statusBadge = <span className="badge badge-info" style={{ animation: "pulse 1.5s infinite" }}>Berlangsung</span>;
                        }

                        return (
                          <tr key={exam.id} style={{ backgroundColor: selectedExamId === exam.id ? "rgba(251, 191, 36, 0.1)" : "transparent" }}>
                            <td style={{ fontWeight: "600" }}>{exam.title} {exam.isMakeup ? <span className="badge badge-warning" style={{ fontSize: "10px", padding: "2px 4px" }}>SUSULAN</span> : ""}</td>
                            <td>{sub?.name || "—"}</td>
                            <td>{cls?.name || "—"}</td>
                            <td>{teacher?.nama || "—"}</td>
                            <td style={{ fontSize: "13px" }}>{formatTimeSlot(exam.scheduledStart, exam.scheduledEnd)}</td>
                            <td>{statusBadge}</td>
                            <td>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: "6px 12px", fontSize: "12px" }}
                                onClick={() => setSelectedExamId(exam.id)}
                              >
                                Pantau
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Aktivitas Pengerjaan Ujian Real-Time */}
            {selectedExamId ? (
              <div className="glass-card" style={{ marginTop: "24px" }}>
                <h3 style={{ marginBottom: "16px" }}>Aktivitas Pengerjaan: {exams.find(e => e.id === selectedExamId)?.title}</h3>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Murid</th>
                        <th>Kelas</th>
                        <th>Waktu Mulai</th>
                        <th>Waktu Selesai</th>
                        <th>Kemajuan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const examSessions = sessions.filter(s => s.examId === selectedExamId);
                        
                        if (examSessions.length === 0) {
                          return (
                            <tr>
                              <td colSpan="6" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                                Belum ada murid yang memulai ujian ini.
                              </td>
                            </tr>
                          );
                        }

                        return examSessions.map(s => {
                          const student = users.find(u => u.username === s.nisn);
                          const exam = exams.find(e => e.id === s.examId);
                          if (!student || !exam) return null;

                          const cls = classes.find(c => c.id === exam.classId);
                          const answeredCount = Object.keys(s.answers || {}).length;
                          const totalQuestions = exam.questions?.length || 0;

                          return (
                            <tr key={s.id}>
                              <td style={{ fontWeight: "600" }}>{student.nama} ({student.username})</td>
                              <td>{cls?.name || "—"}</td>
                              <td>{s.startTime || "-"}</td>
                              <td>{s.isFinished ? (s.endTime || "-") : <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>}</td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <div style={{ flexGrow: 1, height: "6px", backgroundColor: "var(--bg-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(answeredCount / totalQuestions) * 100}%`, backgroundColor: "var(--color-primary)" }}></div>
                                  </div>
                                  <span style={{ fontSize: "12px", minWidth: "35px" }}>{answeredCount}/{totalQuestions}</span>
                                </div>
                              </td>
                              <td>
                                {s.isFinished ? (
                                  s.isStopped ? (
                                    <span className="badge badge-danger">Diberhentikan</span>
                                  ) : (
                                    <span className="badge badge-success">Selesai</span>
                                  )
                                ) : (
                                  <span className="badge badge-info" style={{ animation: "pulse 1.5s infinite" }}>Mengerjakan</span>
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
              <div className="glass-card" style={{ marginTop: "24px", textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}>📊</div>
                <h3 style={{ color: "var(--text-secondary)" }}>Pilih ujian di atas untuk memantau aktivitas murid.</h3>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit User Modal Overlay */}
      {editingUser && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: "500px", margin: 0, backgroundColor: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3>Edit Akun ({editingUser.role.toUpperCase()})</h3>
              <button className="btn btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setEditingUser(null)}>
                Batal
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>Username / Kunci Login</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingUser.username}
                  disabled
                  style={{ opacity: 0.5, cursor: "not-allowed" }}
                />
                <small style={{ color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  Username (NIP/NISN) tidak dapat diubah demi integritas database.
                </small>
              </div>

              <div className="form-group">
                <label>Nama Lengkap</label>
                <input
                  type="text"
                  className="form-control"
                  value={editNama}
                  onChange={e => setEditNama(e.target.value)}
                  disabled={editingUser.role === "ortu"} // Parent name is auto generated from child link
                />
                {editingUser.role === "ortu" && (
                  <small style={{ color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                    Nama orang tua akan otomatis diperbarui sesuai anak yang dipilih.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Password Baru</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Ketik password baru"
                  value={editPass}
                  onChange={e => setEditPass(e.target.value)}
                />
              </div>

              {editingUser.role !== "ortu" && (
                <>
                  <div className="form-group">
                    <label>Nomor HP</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editHp}
                      onChange={e => setEditHp(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Alamat Lengkap</label>
                    <textarea
                      rows="2"
                      className="form-control"
                      value={editAlamat}
                      onChange={e => setEditAlamat(e.target.value)}
                    ></textarea>
                  </div>
                </>
              )}

              {editingUser.role === "murid" && (
                <div className="form-group">
                  <label>Pilih Kelas</label>
                  <select
                    className="form-control"
                    value={editClassId}
                    onChange={e => setEditClassId(e.target.value)}
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {editingUser.role === "ortu" && (
                <div className="form-group">
                  <label>Hubungkan Anak (NISN)</label>
                  <select
                    className="form-control"
                    value={editStudentNisn}
                    onChange={e => setEditStudentNisn(e.target.value)}
                  >
                    <option value="">-- Pilih Murid --</option>
                    {users.filter(u => u.role === "murid").map(m => (
                      <option key={m.id} value={m.username}>{m.nama} (NISN: {m.username})</option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "16px" }}>
                Simpan Perubahan
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

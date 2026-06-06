-- SCHEMA DATABASE SUPABASE / POSTGRESQL (EXAM-PRO)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table Kelas (classes)
CREATE TABLE classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table Users (admin, guru, murid, ortu)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    password TEXT NOT NULL,
    hp TEXT,
    alamat TEXT,
    role TEXT CHECK (role IN ('admin', 'guru', 'murid', 'ortu')) NOT NULL,
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    student_nisn TEXT, -- Digunakan khusus untuk role 'ortu'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table Mata Pelajaran (subjects)
CREATE TABLE subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    class_id TEXT REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Table Ujian (exams)
CREATE TABLE exams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    class_id TEXT REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
    duration INTEGER NOT NULL, -- dalam menit
    randomize BOOLEAN DEFAULT FALSE NOT NULL,
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    teacher_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    questions JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array berisi object pertanyaan dan pilihan
    is_makeup BOOLEAN DEFAULT FALSE NOT NULL,
    allowed_students TEXT[] DEFAULT '{}', -- Array NISN jika is_makeup true
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Table Sesi Ujian (exam_sessions)
CREATE TABLE exam_sessions (
    id TEXT PRIMARY KEY,
    exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
    nisn TEXT REFERENCES users(username) ON DELETE CASCADE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    answers JSONB DEFAULT '{}'::jsonb NOT NULL, -- Menyimpan jawaban murid per soal {"q-1": 0, "q-2": 2}
    flagged JSONB DEFAULT '{}'::jsonb NOT NULL, -- Menyimpan status ragu-ragu {"q-1": true}
    question_order TEXT[] NOT NULL, -- Urutan ID Soal (terutama jika diacak)
    is_finished BOOLEAN DEFAULT FALSE NOT NULL,
    is_stopped BOOLEAN DEFAULT FALSE NOT NULL,
    time_started_secs INTEGER, -- UNIX Timestamp detik saat ujian dimulai (untuk auto-resume)
    correct INTEGER DEFAULT 0,
    incorrect INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Table Log Login (login_logs)
CREATE TABLE login_logs (
    username TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    role TEXT NOT NULL,
    login_time TEXT NOT NULL,
    is_online BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Table Izin Keluar (exit_requests)
CREATE TABLE exit_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES exam_sessions(id) ON DELETE CASCADE NOT NULL,
    nisn TEXT REFERENCES users(username) ON DELETE CASCADE NOT NULL,
    nama TEXT NOT NULL,
    exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Realtime Configuration in Supabase
-- Menambahkan tabel ke daftar publikasi real-time agar bisa dipantau secara langsung oleh Guru
ALTER PUBLICATION supabase_realtime ADD TABLE login_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE exam_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE exit_requests;

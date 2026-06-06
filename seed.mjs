import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Menyiapkan data awal...");
  const adminUser = {
    id: "admin",
    username: "admin",
    nama: "Administrator",
    password: "admin",
    role: "admin"
  };

  const { error } = await supabase.from('users').upsert(adminUser);
  if (error) {
    console.error("Gagal membuat akun Admin:", error);
  } else {
    console.log("✅ Akun Admin berhasil dibuat!");
    console.log("Username: admin | Password: admin");
  }
}

seed();

import "./globals.css";
import ClientInit from "@/components/ClientInit";

export const metadata = {
  title: "EXAM-PRO | Aplikasi Ujian Sekolah Modern",
  description: "Aplikasi Ujian Sekolah ringan, clean, modern dengan fitur real-time monitoring dan acak soal.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <ClientInit />
        {children}
      </body>
    </html>
  );
}


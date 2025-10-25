// src/app/layout.js
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

// กำหนด metadata ทั้งหมดที่นี่ที่เดียว
export const metadata = {
  title: "Management",
  description: "ระบบจัดการรถในองค์กร",
  // ใช้วิธีประกาศแบบ Object จะชัดเจนกว่า
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

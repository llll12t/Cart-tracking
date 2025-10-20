// src/app/layout.js
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext"; // 1. Import เข้ามา

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Fleet Management",
  description: "ระบบจัดการรถในองค์กร",
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
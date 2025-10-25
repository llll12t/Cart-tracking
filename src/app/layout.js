// src/app/layout.js
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

// 1. แยก metadata ทั่วไปออกมา
export const metadata = {
  title: "Management",
  description: "ระบบจัดการรถในองค์กร",
};

// 2. สร้าง function generateViewport แยกออกมาโดยเฉพาะ
export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

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
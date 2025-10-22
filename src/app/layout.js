"use client";
// src/app/layout.js
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext"; // 1. Import เข้ามา
import PageTransition from '@/components/PageTransition';
import { useEffect } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Fleet Management",
  description: "ระบบจัดการรถในองค์กร",
};

export default function RootLayout({ children }) {
  useEffect(() => {
    const handler = (e) => e.preventDefault();
    window.addEventListener("gesturestart", handler);
    return () => window.removeEventListener("gesturestart", handler);
  }, []);
  return (
    <html lang="en">
      <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <PageTransition />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

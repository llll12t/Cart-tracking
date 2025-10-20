"use client";

import { useAuth } from "@/context/AuthContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { useState } from "react";

// Layout หลักสำหรับหน้าจัดการทั้งหมด
export default function AdminLayout({ children }) {
  const { loading } = useAuth(); // เราไม่ได้ใช้ userProfile ที่นี่แล้ว
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // แสดงสถานะ Loading ขณะรอตรวจสอบข้อมูลผู้ใช้
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading Admin Panel...
      </div>
    );
  }

  // ไม่มีการตรวจสอบ role แล้ว ทุกคนที่ login สามารถเห็นหน้านี้ได้
  return (
    <div className="flex">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-h-screen flex flex-col bg-gray-100">
        <div className="px-4 py-2 md:p-6 md:py-2 bg-white shadow-sm">
          <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
        </div>
        <div className="p-4 md:p-6 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
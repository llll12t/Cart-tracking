"use client";

import { useAuth } from "@/context/AuthContext";
import AdminSidebar from "@/components/admin/AdminSidebar";

// Layout หลักสำหรับหน้าจัดการทั้งหมด
export default function AdminLayout({ children }) {
  const { loading } = useAuth(); // เราไม่ได้ใช้ userProfile ที่นี่แล้ว

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
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-y-auto bg-gray-100 h-screen">
        {children}
      </main>
    </div>
  );
}
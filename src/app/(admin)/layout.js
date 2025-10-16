"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

// Component Sidebar สำหรับเมนูนำทาง
function AdminSidebar() {
  return (
    <aside className="w-64 h-screen p-4 text-white bg-gray-800 shrink-0">
      <h2 className="mb-8 text-2xl font-bold">Admin Panel</h2>
      <nav>
        <ul>
          <li className="mb-4">
            <Link
              href="/dashboard"
              className="block p-2 rounded hover:bg-gray-700"
            >
              ภาพรวม (Dashboard)
            </Link>
          </li>
          <li className="mb-4">
            <Link
              href="/approvals"
              className="block p-2 rounded hover:bg-gray-700"
            >
              จัดการคำขอ (Approvals)
            </Link>
          </li>
          <li className="mb-4">
            <Link
              href="/vehicles"
              className="block p-2 rounded hover:bg-gray-700"
            >
              จัดการรถ (Vehicles)
            </Link>
          </li>
          <li className="mb-4">
            <Link
              href="/vehicles-analysis"
              className="block p-2 rounded hover:bg-gray-700"
            >
              วิเคราะห์การใช้งานรถ
            </Link>
          </li>
          <li className="mb-4">
            <Link
              href="/users"
              className="block p-2 rounded hover:bg-gray-700"
            >
              จัดการผู้ใช้งาน (Users)
            </Link>
          </li>
        </ul>
      </nav>
      <div className="absolute bottom-4">
        <Link 
            href="/dashboard"
            className="block p-2 text-sm rounded hover:bg-gray-700"
        >
            &larr; กลับหน้าหลักพนักงาน
        </Link>
      </div>
    </aside>
  );
}

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
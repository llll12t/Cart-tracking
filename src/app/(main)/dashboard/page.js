"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{height: 'calc(100vh - 150px)'}}>
        Loading Dashboard...
      </div>
    );
  }

  // Middleware ควรจะจัดการเรื่องนี้ไปแล้ว แต่เป็นการป้องกันอีกชั้น
  if (!user) {
    router.push("/");
    return null; 
  }

  return (
      <div>
        <div className="p-8 mb-8 bg-white rounded-lg shadow">
            <h1 className="text-3xl font-bold text-gray-900">
                Welcome, {userProfile?.name || user.email}
            </h1>
            <p className="mt-2 text-gray-600">
                นี่คือหน้า Dashboard ของคุณ คุณสามารถเริ่มต้นใช้งานระบบได้จากที่นี่
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1: Create Booking */}
            <Link href="/booking" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
                <h2 className="text-xl font-bold text-blue-600">จองรถ</h2>
                <p className="mt-2 text-gray-600">สร้างคำขอเพื่อใช้งานรถยนต์ขององค์กร</p>
                
            </Link>

            {/* Card 2: My Bookings */}
            <Link href="/my-bookings" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
                <h2 className="text-xl font-bold text-green-600">การจองของฉัน</h2>
                <p className="mt-2 text-gray-600">ติดตามสถานะคำขอจองรถของคุณทั้งหมด</p>
                 
            </Link>

            {/* คุณสามารถเพิ่ม Card อื่นๆ ได้ที่นี่ */}
        </div>
      </div>
  );
}
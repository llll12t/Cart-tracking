"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Image from 'next/image';

export default function AdminSidebar() {
  const router = useRouter();
  const { user, userProfile, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
    setLoggingOut(false);
  };

  return (
    <aside className="w-64 h-screen p-4 text-white bg-gradient-to-b from-[#075b50] to-[#002629] shrink-0 flex flex-col justify-between">
      <div>
        <h2 className="mb-8 text-2xl font-bold">Admin Panel</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link
                href="/dashboard"
                className="block p-2 rounded hover:bg-white/20"
              >
                ภาพรวม (Dashboard)
              </Link>
            </li>
            <li className="mb-4">
              <Link
                href="/approvals"
                className="block p-2 rounded hover:bg-white/20"
              >
                จัดการคำขอ (Approvals)
              </Link>
            </li>
            <li className="mb-4">
              <Link
                href="/vehicles"
                className="block p-2 rounded hover:bg-white/20"
              >
                จัดการรถ (Vehicles)
              </Link>
            </li>
            <li className="mb-4">
              <Link
                href="/vehicles-analysis"
                className="block p-2 rounded hover:bg-white/20"
              >
                วิเคราะห์การใช้งานรถ
              </Link>
            </li>
            <li className="mb-4">
              <Link
                href="/users"
                className="block p-2 rounded hover:bg-white/20"
              >
                จัดการผู้ใช้งาน (Users)
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mt-6 pb-4">
        <div className="flex items-center gap-3 p-2 rounded bg-gray-900">
          { (userProfile?.imageUrl || user?.photoURL) ? (
            <Image
              src={userProfile?.imageUrl || user?.photoURL}
              alt="avatar"
              width={40}
              height={40}
              className="rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">{(userProfile?.name || user?.displayName || user?.email?.charAt(0))?.charAt(0) || 'U'}</div>
          )}
          <div className="flex-1 text-sm">
            <div className="font-medium">{userProfile?.name || user?.displayName || user?.email || 'ไม่ระบุชื่อ'}</div>
            <div className="text-xs text-gray-300">{userProfile?.role || ''}</div>
          </div>
          {/* Small logout icon button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={loggingOut ? 'กำลังออกจากระบบ...' : 'Logout'}
            aria-label="Logout"
            className="ml-2 p-2 rounded-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
          >
            {/* simple logout icon (SVG) */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

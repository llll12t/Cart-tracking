"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Image from 'next/image';
export default function AdminSidebar({ isOpen = false, onClose = () => { } }) {
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

  const pathname = usePathname();

  // If userProfile is not present yet, or role disallows admin UI, don't render sidebar
  if (!userProfile) return null;
  const role = userProfile.role;
  // Only admin and employee should see the admin sidebar
  if (role !== 'admin' && role !== 'employee') return null;

  // Desktop sidebar
  const desktop = (
  <aside className="hidden md:flex w-64 p-4 text-white bg-gradient-to-b from-[#075b50] to-[#002629] shrink-0 flex-col justify-between">
      <div>
        <h2 className="mb-8 text-2xl font-bold">Admin Panel</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link href="/dashboard" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/dashboard' ? 'bg-white/20' : ''}`} aria-current={pathname === '/dashboard' ? 'page' : undefined}>
                ภาพรวม
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/vehicles" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/vehicles' ? 'bg-white/20' : ''}`} aria-current={pathname === '/vehicles' ? 'page' : undefined}>
                จัดการรถ
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/maintenance" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/maintenance' ? 'bg-white/20' : ''}`} aria-current={pathname === '/maintenance' ? 'page' : undefined}>
                ส่งซ่อม
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/vehicles-analysis" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/vehicles-analysis' ? 'bg-white/20' : ''}`} aria-current={pathname === '/vehicles-analysis' ? 'page' : undefined}>
                วิเคราะห์การใช้งานรถ
              </Link>
            </li>
                <li className="mb-4">
              <Link href="/trip-history" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/trip-history' ? 'bg-white/20' : ''}`} aria-current={pathname === '/trip-history' ? 'page' : undefined}>
                ประวัติการ 
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/users" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/users' ? 'bg-white/20' : ''}`} aria-current={pathname === '/users' ? 'page' : undefined}>
                จัดการผู้ใช้งาน
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/settings" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/settings' ? 'bg-white/20' : ''}`} aria-current={pathname === '/settings' ? 'page' : undefined}>
                การตั้งค่า
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* ...existing code... (removed user profile and logout section) */}
    </aside>
  );

  // Mobile drawer
  const mobile = (
    <div className={`fixed inset-0 z-50 md:hidden ${isOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
      {/* backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

  <aside className={`fixed left-0 top-0 w-64 h-[100vh] p-4 bg-gradient-to-b from-[#075b50] to-[#002629] text-white transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Admin Panel</h2>
          <button onClick={onClose} aria-label="Close menu" className="p-2 rounded bg-white/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav>
          <ul>
            <li className="mb-4">
              <Link href="/dashboard" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/dashboard' ? 'bg-white/20' : ''}`} onClick={onClose}>
                ภาพรวม
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/vehicles" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/vehicles' ? 'bg-white/20' : ''}`} onClick={onClose}>
                จัดการรถ
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/maintenance" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/maintenance' ? 'bg-white/20' : ''}`} onClick={onClose}>
                ส่งซ่อม
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/vehicles-analysis" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/vehicles-analysis' ? 'bg-white/20' : ''}`} onClick={onClose}>
                วิเคราะห์การใช้งานรถ
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/trip-history" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/trip-history' ? 'bg-white/20' : ''}`} aria-current={pathname === '/vehicles-analysis' ? 'page' : undefined}>
               ประวัติ 
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/users" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/users' ? 'bg-white/20' : ''}`} onClick={onClose}>
                จัดการผู้ใช้งาน
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/settings" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/settings' ? 'bg-white/20' : ''}`} onClick={onClose}>
                การตั้งค่า
              </Link>
            </li>
          </ul>
        </nav>

      </aside>
    </div>
  );

  // Render both but desktop is hidden on md and mobile is hidden on md
  return (
    <>
      {desktop}
      {mobile}
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Image from 'next/image';
export default function AdminSidebar({ isOpen = false, onClose = () => {} }) {
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

  // Desktop sidebar
  const desktop = (
    <aside className="hidden md:flex w-64 h-screen p-4 text-white bg-gradient-to-b from-[#075b50] to-[#002629] shrink-0 flex-col justify-between">
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
              <Link href="/approvals" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/approvals' ? 'bg-white/20' : ''}`} aria-current={pathname === '/approvals' ? 'page' : undefined}>
                จัดการคำขอ
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
              <Link href="/settings" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/settings' ? 'bg-white/20' : ''}`} aria-current={pathname === '/settings' ? 'page' : undefined}>
                การตั้งค่า
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/users" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/users' ? 'bg-white/20' : ''}`} aria-current={pathname === '/users' ? 'page' : undefined}>
                จัดการผู้ใช้งาน
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

  // Mobile drawer
  const mobile = (
    <div className={`fixed inset-0 z-50 md:hidden ${isOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
      {/* backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <aside className={`fixed left-0 top-0 bottom-0 w-64 p-4 bg-gradient-to-b from-[#075b50] to-[#002629] text-white transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
              <Link href="/approvals" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/approvals' ? 'bg-white/20' : ''}`} onClick={onClose}>
                จัดการคำขอ
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
              <Link href="/settings" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/settings' ? 'bg-white/20' : ''}`} onClick={onClose}>
                การตั้งค่า
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/users" className={`block p-2 rounded hover:bg-white/20 ${pathname === '/users' ? 'bg-white/20' : ''}`} onClick={onClose}>
                จัดการผู้ใช้งาน
              </Link>
            </li>
          </ul>
        </nav>

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
            <button
              onClick={() => {
                onClose();
                handleLogout();
              }}
              disabled={loggingOut}
              title={loggingOut ? 'กำลังออกจากระบบ...' : 'Logout'}
              aria-label="Logout"
              className="ml-2 p-2 rounded-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
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

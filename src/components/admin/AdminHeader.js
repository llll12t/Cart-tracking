"use client";

import { useAuth } from "@/context/AuthContext";
export default function AdminHeader({ onMenuClick }) {
  const { userProfile, logout } = useAuth();

  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded bg-white/10 hover:bg-white/20 text-white"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <h3 className="text-lg font-semibold">แผงควบคุมผู้ดูแล</h3>
          <p className="text-sm text-gray-600">{userProfile?.name || 'ไม่ระบุชื่อ'}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {userProfile?.imageUrl ? (
          <img src={userProfile.imageUrl} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">{userProfile?.name?.charAt(0) || 'U'}</div>
        )}
        <button onClick={logout} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">Logout</button>
      </div>
    </header>
  );
}

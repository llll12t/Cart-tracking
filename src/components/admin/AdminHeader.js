"use client";

import { useAuth } from "@/context/AuthContext";

export default function AdminHeader() {
  const { userProfile, logout } = useAuth();

  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-lg font-semibold">แผงควบคุมผู้ดูแล</h3>
        <p className="text-sm text-gray-600">{userProfile?.name || 'ไม่ระบุชื่อ'}</p>
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

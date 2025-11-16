"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';

// Component UserCard (เหมือนเดิม)
function UserCard({ user, onDelete }) {
  const getRoleStyle = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-50 text-red-700';
      case 'driver':
        return 'bg-blue-50 text-blue-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
  <div className="p-4 bg-white rounded-lg shadow-sm flex items-center gap-4">
      {/* avatar */}
      <div className="flex-shrink-0">
        {user.imageUrl ? (
          <Image 
            src={user.imageUrl} 
            alt={user.name} 
            width={56} 
            height={56} 
            className="w-14 h-14 rounded-full object-cover border" 
            unoptimized 
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">{(user.name || user.email || 'U')[0]}</div>
        )}
      </div>

      {/* main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div className="truncate">
            <p className="font-semibold text-gray-900 truncate">{user.name}</p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>
          <div className="hidden md:flex md:flex-col md:items-end md:gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleStyle(user.role)}`}>{user.role}</span>
            <div className="flex gap-2">
              <Link href={`/users/${user.id}/edit`} className="p-2 rounded text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100">แก้ไข</Link>
              <button onClick={() => onDelete(user.id)} className="p-2 rounded text-xs bg-red-50 text-red-700 hover:bg-red-100">ลบ</button>
            </div>
          </div>
        </div>
        {/* mobile actions */}
        <div className="mt-3 flex items-center justify-between md:hidden">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleStyle(user.role)}`}>{user.role}</span>
          <div className="flex gap-2">
            <Link href={`/users/${user.id}/edit`} className="px-3 py-1 text-xs bg-indigo-50 text-indigo-700 rounded">แก้ไข</Link>
            <button onClick={() => onDelete(user.id)} className="px-3 py-1 text-xs bg-red-50 text-red-700 rounded">ลบ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Page Component หลัก
export default function ManageUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (userId) => {
    if (!window.confirm("คุณต้องการลบผู้ใช้นี้จริงหรือไม่?")) return;
    setDeletingId(userId);
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการลบผู้ใช้");
    }
    setDeletingId(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
            ผู้ใช้งานในระบบ ({users.length} คน)
        </h1>
        <Link 
            href="/users/add" 
            className="px-4 py-2 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          + เพิ่มผู้ใช้ใหม่
        </Link>
      </div>
      {loading && <p>กำลังโหลดข้อมูลผู้ใช้...</p>}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Admins column */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Admin</h2>
            <div className="space-y-4">
              {users.filter(u => u.role === 'admin').map(user => (
                <UserCard key={user.id} user={user} onDelete={handleDelete} />
              ))}
            </div>
          </div>

          {/* Drivers column */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Driver</h2>
            <div className="space-y-4">
              {users.filter(u => u.role === 'driver').map(user => (
                <UserCard key={user.id} user={user} onDelete={handleDelete} />
              ))}
            </div>
          </div>

          {/* Others column */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Other</h2>
            <div className="space-y-4">
              {users.filter(u => u.role !== 'admin' && u.role !== 'driver').map(user => (
                <UserCard key={user.id} user={user} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        </div>
      )}
      {deletingId && <p className="text-red-500 mt-4">กำลังลบผู้ใช้...</p>}
    </div>
  );
}
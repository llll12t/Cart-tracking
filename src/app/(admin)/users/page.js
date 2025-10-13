"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import Link from 'next/link';

// Component UserCard (เหมือนเดิม)
function UserCard({ user }) {
  const getRoleStyle = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-400';
      case 'driver':
        return 'bg-blue-100 text-blue-800 border-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-400';
    }
  };

  return (
    <div className={`p-4 bg-white rounded-lg shadow-md border-l-4 ${getRoleStyle(user.role)}`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="font-bold text-lg text-gray-900">{user.name}</p>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleStyle(user.role)}`}>
          {user.role}
        </span>
      </div>
       {/* ในอนาคต: เพิ่มปุ่ม Edit ที่นี่ โดยลิงก์ไปที่ /users/${user.id}/edit */}
    </div>
  );
}

// Page Component หลัก
export default function ManageUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}
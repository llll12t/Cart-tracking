"use client";

import { useAuth } from "@/context/AuthContext";

// Layout หลักสำหรับพนักงาน
export default function MainLayout({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // หากไม่มี user login อยู่ ให้แสดงหน้าว่างๆ (middleware จะจัดการ redirect)
  if (!user) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
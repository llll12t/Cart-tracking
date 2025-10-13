"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

// Component Navbar
function MainNavbar() {
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/"); // กลับไปหน้า Login
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-md">
      <div className="container mx-auto flex items-center justify-between p-4">
        <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
          FleetApp
        </Link>
        <nav className="flex items-center space-x-6">
          <Link href="/dashboard" className="text-gray-600 hover:text-indigo-600">
            Dashboard
          </Link>
          <Link href="/my-bookings" className="text-gray-600 hover:text-indigo-600">
            การจองของฉัน
          </Link>
          {/* ลิงก์สำหรับ Admin Panel จะแสดงเมื่อ user มี role เป็น admin */}
          {userProfile?.role === 'admin' && (
             <Link href="/vehicles" className="text-gray-600 hover:text-indigo-600 font-semibold">
                (Admin Panel)
             </Link>
          )}
        </nav>
        <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500 hidden sm:block">
                {userProfile?.name || user?.email}
            </span>
            <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
                Logout
            </button>
        </div>
      </div>
    </header>
  );
}

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
      <MainNavbar />
      <main className="container mx-auto p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}
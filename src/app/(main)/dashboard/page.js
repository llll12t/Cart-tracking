"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot } from "firebase/firestore";

export default function DashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const q = query(collection(db, "vehicles"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vehiclesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vehiclesData);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null; 
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-600 to-teal-700">
      {/* Header with User Profile */}
      <div className="bg-teal-600 px-6 pt-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-teal-800 rounded-full flex items-center justify-center text-white font-semibold text-xl">
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
            <div className="text-white">
              <p className="font-semibold text-lg">{userProfile?.name || 'นายทดสอบการ'}</p>
              <p className="text-sm text-teal-100">พนักงาน ขับ</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/booking')}
            className="px-6 py-2 bg-white text-teal-700 rounded-full font-semibold text-sm hover:bg-teal-50 transition-all"
          >
            จองรถ
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-3">
          <button 
            onClick={() => router.push('/my-trips')}
            className="flex-1 py-3 rounded-full font-semibold bg-teal-500/50 text-teal-100 hover:bg-teal-500/70 transition-all"
          >
            เดินทาง
          </button>
          <button 
            onClick={() => router.push('/my-bookings')}
            className="flex-1 py-3 rounded-full font-semibold bg-teal-500/50 text-teal-100 hover:bg-teal-500/70 transition-all"
          >
            ประวัติการขับ
          </button>
        </div>
      </div>

      {/* Content Area - Vehicle List */}
      <div className="px-4 -mt-16 pb-8 space-y-4">
        {vehicles.map(vehicle => (
          <div key={vehicle.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex p-4 gap-4">
              {/* Vehicle Image Placeholder */}
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0"></div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600">ยี่ห้อ</p>
                    <p className="font-semibold">{vehicle.brand || '-'}</p>
                    <p className="text-sm text-gray-600 mt-1">รุ่น</p>
                    <p className="font-semibold">{vehicle.model || '-'}</p>
                  </div>
                  <button 
                    onClick={() => vehicle.status === 'available' && router.push('/booking')}
                    className={`px-4 py-1 text-xs font-semibold rounded-full ${
                      vehicle.status === 'available' 
                        ? 'bg-teal-600 text-white hover:bg-teal-700' 
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    }`}
                    disabled={vehicle.status !== 'available'}
                  >
                    {vehicle.status === 'available' ? 'เลือกสิ่น' : 'ไม่พร้อมใช้'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  ทะเบียน <span className="font-semibold">{vehicle.licensePlate || '-'}</span>
                </p>
              </div>
            </div>
          </div>
        ))}

        {vehicles.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-gray-500">ไม่มีรถในระบบ</p>
          </div>
        )}
      </div>
    </div>
  );
}
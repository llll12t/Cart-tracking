"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import Link from "next/link";

// Component สำหรับแสดงข้อมูลการจอง 1 รายการ
function BookingCard({ booking }) {
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp.seconds * 1000).toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'approved':
                return { badge: 'bg-green-100 text-green-800', border: 'border-green-500' };
            case 'pending':
                return { badge: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-500' };
            case 'rejected':
                return { badge: 'bg-red-100 text-red-800', border: 'border-red-500' };
            case 'completed':
                return { badge: 'bg-blue-100 text-blue-800', border: 'border-blue-500' };
            default:
                return { badge: 'bg-gray-100 text-gray-800', border: 'border-gray-300' };
        }
    };
    
    const style = getStatusStyle(booking.status);

    return (
        <div className={`bg-white rounded-lg shadow-md border-l-4 ${style.border} p-6`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{booking.destination}</h3>
                    <p className="text-sm text-gray-600 mt-1">วัตถุประสงค์: {booking.purpose}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${style.badge}`}>
                    {booking.status}
                </span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500 grid grid-cols-2 gap-4">
                <p><strong>เริ่ม:</strong> {formatDate(booking.startDateTime)}</p>
                <p><strong>สิ้นสุด:</strong> {formatDate(booking.endDateTime)}</p>
                 {booking.vehicleId && <p><strong>ทะเบียนรถ:</strong> {booking.vehicleLicensePlate || 'N/A'}</p>}
                 {booking.driverId && <p><strong>คนขับ:</strong> {booking.driverName || 'N/A'}</p>}
            </div>
        </div>
    );
}


export default function MyBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // สร้าง query เพื่อดึงข้อมูลเฉพาะของ user ที่ login อยู่
    const q = query(
        collection(db, "bookings"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc") // เรียงตามวันที่สร้างล่าสุด
    );

    // ใช้ onSnapshot เพื่อให้ข้อมูลอัพเดท real-time
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userBookings = [];
      querySnapshot.forEach((doc) => {
        userBookings.push({ id: doc.id, ...doc.data() });
      });
      setBookings(userBookings);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user]);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">การจองของฉัน</h1>
        <Link href="/booking" className="px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          + สร้างคำขอใหม่
        </Link>
      </div>

      {loading && <p>กำลังโหลดข้อมูล...</p>}

      {!loading && bookings.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">คุณยังไม่มีรายการจอง</p>
        </div>
      )}
      
      {!loading && bookings.length > 0 && (
          <div className="space-y-6">
              {bookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
              ))}
          </div>
      )}
    </div>
  );
}
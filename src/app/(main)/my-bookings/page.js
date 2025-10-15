"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc } from "firebase/firestore";

// Component สำหรับแสดงข้อมูลการจอง 1 รายการ
function BookingCard({ booking }) {
    const [vehicle, setVehicle] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (booking.vehicleId) {
            const vehicleRef = doc(db, "vehicles", booking.vehicleId);
            const unsubscribe = onSnapshot(vehicleRef, (doc) => {
                if (doc.exists()) {
                    setVehicle(doc.data());
                }
            });
            return unsubscribe;
        }
    }, [booking.vehicleId]);

    const formatDate = (timestamp) => {
        if (!timestamp?.seconds) return '-';
        return new Date(timestamp.seconds * 1000).toLocaleString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'approved': return 'อนุมัติแล้ว';
            case 'pending': return 'รอดำเนินการ';
            case 'rejected': return 'ปฏิเสธ';
            case 'completed': return 'เสร็จสิ้น';
            case 'on_trip': return 'กำลังเดินทาง';
            default: return status || '-';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-300 text-gray-800';
            case 'pending': return 'bg-yellow-300 text-gray-800';
            case 'rejected': return 'bg-red-300 text-white';
            case 'completed': return 'bg-blue-300 text-gray-800';
            case 'on_trip': return 'bg-orange-300 text-gray-800';
            default: return 'bg-gray-300 text-gray-800';
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="flex p-4 gap-4">
                {/* Vehicle Image Placeholder */}
                <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0"></div>
                
                <div className="flex-1">
                    <div className="flex flex-row justify-between items-start">
                        <div className="flex flex-col items-start">
                            <div className="flex flex-row gap-2 items-center">
                                <span className="text-sm text-gray-600">ยี่ห้อ</span>
                                <span className="font-semibold">{vehicle?.brand || '-'}</span>
                            </div>
                            <div className="flex flex-row gap-2 items-center mt-1">
                                <span className="text-sm text-gray-600">รุ่น</span>
                                <span className="font-semibold">{vehicle?.model || '-'}</span>
                            </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                            {getStatusText(booking.status)}
                        </span>
                    </div>
                    <div className="flex flex-row gap-2 items-center mt-2">
                        <span className="text-sm text-gray-600">ทะเบียน</span>
                        <span className="font-semibold">{booking.vehicleLicensePlate || vehicle?.licensePlate || '-'}</span>
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <>
                    {/* Trip Details */}
                    <div className="px-4 pb-4 space-y-2 text-sm border-t border-gray-100 pt-4">
                        <div className="flex justify-between">
                            <span className="font-semibold">จุดเริ่ม</span>
                            <span className="text-gray-600">{booking.origin || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">จุดหมาย</span>
                            <span className="text-gray-600">{booking.destination || '-'}</span>
                        </div>
                        {booking.startMileage && (
                            <div className="flex justify-between">
                                <span className="font-semibold">เลขไมล์เริ่มต้น</span>
                                <span className="text-gray-600">{booking.startMileage}</span>
                            </div>
                        )}
                        {booking.endMileage && (
                            <div className="flex justify-between">
                                <span className="font-semibold">เลขไมล์สิ้นสุด</span>
                                <span className="text-gray-600">{booking.endMileage}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="font-semibold">วันเริ่มต้น</span>
                            <span className="text-gray-600">{formatDate(booking.startDateTime)}</span>
                        </div>
                        {booking.endDateTime && (
                            <div className="flex justify-between">
                                <span className="font-semibold">วันสิ้นสุด</span>
                                <span className="text-gray-600">{formatDate(booking.endDateTime)}</span>
                            </div>
                        )}
                    </div>

                    {/* Purpose Section */}
                    {booking.purpose && (
                        <div className="px-4 pb-4">
                            <p className="font-semibold text-sm mb-2">วัตถุประสงค์</p>
                            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                                {booking.purpose}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full py-3 text-center text-teal-700 text-sm font-semibold hover:bg-gray-50 transition-all border-t border-gray-100"
            >
                {isExpanded ? '▲ ซ่อนรายละเอียด' : '▼ ดูรายละเอียด'}
            </button>
        </div>
    );
}

export default function MyBookingsPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
        collection(db, "bookings"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userBookings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(userBookings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Header with User Profile */}
      <div className="bg-gradient-to-b from-[#075b50] to-[#002629] px-6 pt-8 pb-24">
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
            className="flex-1 py-3 rounded-full font-semibold bg-teal-800 text-white transition-all"
          >
            ประวัติการขับ
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-gray-100 p-4 -mt-16 pb-8">
        {bookings.length > 0 ? (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-gray-500">ไม่มีประวัติการจอง</p>
          </div>
        )}
      </div>
    </div>
  );
}
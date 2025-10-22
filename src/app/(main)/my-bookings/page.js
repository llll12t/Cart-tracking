"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import MainHeader from '@/components/main/MainHeader';

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

    const formatDate = (d) => {
        if (!d) return '-';
        if (d.seconds && typeof d.seconds === 'number') {
            return new Date(d.seconds * 1000).toLocaleString('th-TH', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
        }
        if (d instanceof Date) return d.toLocaleString('th-TH', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
        try {
            if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
                const parts = d.split('-');
                const localDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0);
                return localDate.toLocaleString('th-TH', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                });
            }
            const parsed = new Date(d);
            if (!isNaN(parsed)) return parsed.toLocaleString('th-TH', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
        } catch (e) {}
        return '-';
    };

    const getBookingDate = (bk, type) => {
        const candidates = {
            start: [bk.startDateTime, bk.startCalendarDate || bk.startDate, bk.start],
            end: [bk.endDateTime, bk.endCalendarDate || bk.endDate, bk.end]
        }[type] || [];
        for (const c of candidates) if (c) return c;
        return null;
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
        <div className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden border border-gray-100">
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                                {getStatusText(booking.status)}
                            </span>
                        </div>
                        <h3 className="font-semibold text-gray-800 text-lg">
                            {vehicle?.licensePlate || booking.vehicleLicensePlate || 'ไม่ระบุทะเบียน'}
                        </h3>
                        <p className="text-sm text-gray-600">{vehicle?.brand} {vehicle?.model}</p>
                    </div>
                    {vehicle?.imageUrl && (
                        <img 
                            src={vehicle.imageUrl} 
                            alt="vehicle" 
                            className="w-20 h-20 object-cover rounded-lg"
                        />
                    )}
                </div>

                <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span><strong>เริ่ม:</strong> {formatDate(getBookingDate(booking, 'start'))}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span><strong>สิ้นสุด:</strong> {formatDate(getBookingDate(booking, 'end'))}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span><strong>จุดหมาย:</strong> {booking.destination || '-'}</span>
                    </div>
                </div>

                {booking.purpose && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="mt-3 text-sm text-teal-600 font-medium flex items-center gap-1"
                    >
                        {isExpanded ? 'ซ่อนรายละเอียด' : 'แสดงรายละเอียด'}
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}

                {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                            <strong>วัตถุประสงค์:</strong> {booking.purpose}
                        </p>
                        {booking.passengers && (
                            <p className="text-sm text-gray-600 mt-2">
                                <strong>จำนวนผู้โดยสาร:</strong> {booking.passengers} คน
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MyBookingsPage() {
    const { userProfile } = useAuth();
    const { bookings, loading, stats, lastFetch } = useData();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('bookings');

    // กรอง bookings ตามสถานะ
    const pendingBookings = bookings.filter(b => b.status === 'pending' || !b.status);
    const approvedBookings = bookings.filter(b => b.status === 'approved');
    const otherBookings = bookings.filter(b => 
        b.status !== 'pending' && 
        b.status !== 'approved' && 
        b.status
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="px-4 py-6 -mt-16">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-bold text-yellow-600">{stats.pendingBookings}</div>
                        <div className="text-xs text-gray-600 mt-1">รอดำเนินการ</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.approvedBookings}</div>
                        <div className="text-xs text-gray-600 mt-1">อนุมัติแล้ว</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-bold text-gray-600">{stats.totalBookings}</div>
                        <div className="text-xs text-gray-600 mt-1">ทั้งหมด</div>
                    </div>
                </div>

                {/* Real-time indicator */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">การจองของฉัน</h2>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>อัปเดตอัตโนมัติ</span>
                    </div>
                </div>

                {/* Loading State */}
                {loading && bookings.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                ) : (
                    <>
                        {/* รอดำเนินการ */}
                        {pendingBookings.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                    รอดำเนินการ ({pendingBookings.length})
                                </h3>
                                {pendingBookings.map(booking => (
                                    <BookingCard key={booking.id} booking={booking} />
                                ))}
                            </div>
                        )}

                        {/* อนุมัติแล้ว */}
                        {approvedBookings.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    อนุมัติแล้ว ({approvedBookings.length})
                                </h3>
                                {approvedBookings.map(booking => (
                                    <BookingCard key={booking.id} booking={booking} />
                                ))}
                            </div>
                        )}

                        {/* อื่น ๆ */}
                        {otherBookings.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">อื่น ๆ ({otherBookings.length})</h3>
                                {otherBookings.map(booking => (
                                    <BookingCard key={booking.id} booking={booking} />
                                ))}
                            </div>
                        )}

                        {/* Empty State */}
                        {bookings.length === 0 && (
                            <div className="text-center py-12">
                                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p className="text-gray-600 mb-4">ยังไม่มีการจอง</p>
                                <button
                                    onClick={() => router.push('/booking')}
                                    className="px-6 py-3 bg-teal-600 text-white rounded-full font-semibold hover:bg-teal-700 transition-all"
                                >
                                    จองรถเลย
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

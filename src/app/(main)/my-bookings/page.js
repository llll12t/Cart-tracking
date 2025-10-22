"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, doc, getDocs, limit, startAfter, onSnapshot } from "firebase/firestore";
import { getImageUrl } from '@/lib/imageHelpers';
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
        // Firestore Timestamp
        if (d.seconds && typeof d.seconds === 'number') {
            return new Date(d.seconds * 1000).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        // JS Date
        if (d instanceof Date) return d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        // ISO string
        try {
            // If value is a calendar-only string like 'YYYY-MM-DD', construct local midnight
            if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
                const parts = d.split('-');
                const localDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0);
                return localDate.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
            const parsed = new Date(d);
            if (!isNaN(parsed)) return parsed.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {}
        return '-';
    };

    const getBookingDate = (bk, type) => {
        // type: 'start' | 'end'
        // Prefer the explicit timestamp fields (startDateTime/endDateTime) which represent the intended local moment.
        // Prefer precise timestamp fields first, then calendar-only strings, then legacy date fields
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
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="flex p-4 gap-4">
                                {/* Vehicle Image Placeholder */}
                                <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                                    {getImageUrl(vehicle) ? (
                                        <img src={getImageUrl(vehicle)} alt={`${vehicle?.brand || ''} ${vehicle?.model || ''}`} className="w-full h-full object-cover" />
                                    ) : null}
                                </div>
                
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
                            <span className="text-gray-600">{formatDate(getBookingDate(booking,'start') || booking.createdAt)}</span>
                        </div>
                        {getBookingDate(booking,'end') && (
                            <div className="flex justify-between">
                                <span className="font-semibold">วันสิ้นสุด</span>
                                <span className="text-gray-600">{formatDate(getBookingDate(booking,'end'))}</span>
                            </div>
                        )}
                        {/* createdAt / userEmail intentionally hidden per request */}
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
    const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('history');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const lastDocRef = useRef(null);
    const sentinelRef = useRef(null);
    const PAGE_SIZE = 5;

    useEffect(() => {
        // wait for auth to resolve first
        if (authLoading) return;

        if (!user) {
            // not signed in -> no bookings to load
            setBookings([]);
            setLoading(false);
            return;
        }

            let mounted = true;

            async function loadPage(startAfterDoc = null) {
                try {
                    const base = collection(db, 'bookings');
                    let q;
                    if (startAfterDoc) {
                        q = query(base, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), startAfter(startAfterDoc), limit(PAGE_SIZE));
                    } else {
                        q = query(base, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
                    }
                    const snap = await getDocs(q);
                    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Update last visible
                    const lastVisible = snap.docs[snap.docs.length - 1] || null;
                    if (mounted) {
                        if (!startAfterDoc) {
                            setBookings(docs);
                        } else {
                            setBookings(prev => [...prev, ...docs]);
                        }
                        lastDocRef.current = lastVisible;
                        // If fewer than page size returned, no more pages
                        setHasMore(snap.docs.length === PAGE_SIZE);
                        setLoading(false);
                    }
                } catch (e) {
                    console.error('Failed to load bookings page', e);
                    if (mounted) setLoading(false);
                }
            }

            // initial load
            loadPage();

            // IntersectionObserver to lazy load more when sentinel is visible
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !loadingMore && hasMore) {
                        // load next page
                        (async () => {
                            setLoadingMore(true);
                            try {
                                await loadPage(lastDocRef.current);
                            } finally {
                                setLoadingMore(false);
                            }
                        })();
                    }
                });
            }, { root: null, rootMargin: '200px', threshold: 0.1 });

            if (sentinelRef.current) observer.observe(sentinelRef.current);

            return () => {
                mounted = false;
                if (sentinelRef.current) observer.unobserve(sentinelRef.current);
            };
    }, [user, authLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />
      {/* Content Area */}
      <div className="bg-gray-100 p-4 -mt-16 pb-8">
                {bookings.length > 0 ? (
                    <div className="space-y-4">
                        {bookings.map((booking) => (
                            <BookingCard key={booking.id} booking={booking} />
                        ))}
                        {/* Sentinel element observed by IntersectionObserver to lazy-load more */}
                        <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                            {loadingMore ? (
                                <p className="text-sm text-gray-500">กำลังโหลดเพิ่มเติม...</p>
                            ) : (!hasMore ? (
                                <p className="text-sm text-gray-400">ไม่มีข้อมูลเพิ่มเติม</p>
                            ) : (
                                <p className="text-sm text-gray-400">เลื่อนลงเพื่อโหลดเพิ่มเติม</p>
                            ))}
                        </div>
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
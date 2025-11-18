"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import { getImageUrl } from '@/lib/imageHelpers';
import { useRouter } from 'next/navigation';
import MainHeader from '@/components/main/MainHeader';

// Component สำหรับแสดงประวัติการใช้งานรถ 1 รายการ
function UsageHistoryCard({ usage }) {
    const [vehicle, setVehicle] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        let ignore = false;
        async function fetchVehicle() {
            if (usage.vehicleId) {
                const vehicleRef = doc(db, "vehicles", usage.vehicleId);
                const vehicleSnap = await getDoc(vehicleRef);
                if (!ignore && vehicleSnap.exists()) {
                    setVehicle(vehicleSnap.data());
                }
            }
        }
        fetchVehicle();
        return () => { ignore = true; };
    }, [usage.vehicleId]);

    useEffect(() => {
        let ignore = false;
        async function fetchExpenses() {
            if (usage.id) {
                const q = query(collection(db, "expenses"), where("usageId", "==", usage.id));
                const snapshot = await getDocs(q);
                if (!ignore) {
                    const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setExpenses(expensesData);
                }
            }
        }
        fetchExpenses();
        return () => { ignore = true; };
    }, [usage.id]);

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('th-TH', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (e) {
            return '-';
        }
    };

    const getExpenseTypeText = (type) => {
        switch (type) {
            case 'fuel': return '⛽ เติมน้ำมัน';
            case 'other': return '💰 ค่าใช้จ่ายอื่นๆ';
            default: return type;
        }
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalDistance = usage.totalDistance || (usage.endMileage && usage.startMileage ? usage.endMileage - usage.startMileage : 0);

    return (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-2">
            <div className="p-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${usage.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                        {usage.status === 'active' ? ' กำลังใช้งาน' : ' เสร็จสิ้น'}
                    </span>
                    <span className="font-semibold text-gray-800 text-sm">
                        {usage.vehicleLicensePlate || vehicle?.licensePlate || 'ไม่ระบุทะเบียน'}
                    </span>
                    <span className="text-xs text-gray-500">{vehicle?.brand} {vehicle?.model}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-1">
                    <span>เริ่ม: <span className="font-medium">{formatDateTime(usage.startTime)}</span></span>
                    {usage.endTime && <span>คืน: <span className="font-medium">{formatDateTime(usage.endTime)}</span></span>}
                    {totalDistance > 0 && <span>ระยะทาง: <span className="font-medium text-teal-600">{totalDistance.toLocaleString()} กม.</span></span>}
                    {usage.destination && <span>จุดหมาย: <span className="font-medium">{usage.destination}</span></span>}
                </div>
                {(usage.purpose || expenses.length > 0) && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs text-teal-600 font-medium flex items-center gap-1"
                    >
                        {isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                        <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}
                {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                        {usage.purpose && (
                            <div>
                                <span className="text-xs font-medium text-gray-700">วัตถุประสงค์:</span>
                                <span className="text-xs text-gray-600 ml-1">{usage.purpose}</span>
                            </div>
                        )}
                        {expenses.length > 0 && (
                            <div>
                                <span className="text-xs font-medium text-gray-700">ค่าใช้จ่าย ({expenses.length}):</span>
                                <div className="space-y-1 mt-1">
                                    {expenses.map(expense => (
                                        <div key={expense.id} className="flex justify-between items-center py-1 border-b border-gray-50">
                                            <span className="text-xs font-medium">{getExpenseTypeText(expense.type)}</span>
                                            <span className="text-xs text-teal-600 font-medium">{expense.amount.toLocaleString()} ฿</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                                        <span className="font-semibold text-gray-800 text-xs">รวม:</span>
                                        <span className="font-bold text-teal-600 text-xs">{totalExpenses.toLocaleString()} ฿</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Page Component - แสดงประวัติการใช้งานรถ
export default function MyTripsPage() {
    const { user, userProfile } = useAuth();
    const [usageHistory, setUsageHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('trips');
    const [displayCount, setDisplayCount] = useState(5);
    const router = useRouter();

    useEffect(() => {
        let ignore = false;
        async function fetchUsageHistory() {
            if (!user) {
                setLoading(false);
                return;
            }
            const q = query(
                collection(db, "vehicle-usage"),
                where("userId", "==", userProfile?.lineId || user.uid),
                orderBy("startTime", "desc")
            );
            const snapshot = await getDocs(q);
            if (!ignore) {
                const historyData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    // Convert Firestore timestamps to ISO strings for rendering
                    if (data.startTime?.toDate) {
                        data.startTime = data.startTime.toDate().toISOString();
                    }
                    if (data.endTime?.toDate) {
                        data.endTime = data.endTime.toDate().toISOString();
                    }
                    if (data.createdAt?.toDate) {
                        data.createdAt = data.createdAt.toDate().toISOString();
                    }
                    return { id: doc.id, ...data };
                });
                setUsageHistory(historyData);
                setLoading(false);
            }
        }
        fetchUsageHistory();
        return () => { ignore = true; };
    }, [user]);

    const loadMore = () => {
        setDisplayCount(prev => prev + 10);
    };

    const displayedHistory = usageHistory.slice(0, displayCount);
    const hasMore = displayCount < usageHistory.length;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="bg-white px-4 py-2 -mt-16">
                    <div className="text-center py-12">
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="bg-white px-6 py-2 -mt-16">

                {usageHistory.length > 0 ? (
                    <div className="pb-8">
                        <div className="space-y-4 mb-4">
                            {displayedHistory.map(usage => (
                                <UsageHistoryCard key={usage.id} usage={usage} />
                            ))}
                        </div>
                        
                        {hasMore && (
                            <div className="text-center">
                                <button
                                    onClick={loadMore}
                                    className="px-6 py-3  text-teal-600 rounded-full text-sm font-semibold hover:bg-teal-700 transition-all"
                                >
                                    โหลดเพิ่ม ({usageHistory.length - displayCount} รายการ)
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">ยังไม่มีประวัติการใช้งาน</h3>
                        <p className="text-gray-600 mb-6">เริ่มใช้งานรถเพื่อดูประวัติการเดินทาง</p>
                    </div>
                )}
            </div>
        </div>
    );
}
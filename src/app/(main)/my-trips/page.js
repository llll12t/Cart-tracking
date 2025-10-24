"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
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
        if (usage.vehicleId) {
            const vehicleRef = doc(db, "vehicles", usage.vehicleId);
            const unsubscribe = onSnapshot(vehicleRef, (doc) => {
                if (doc.exists()) {
                    setVehicle(doc.data());
                }
            });
            return unsubscribe;
        }
    }, [usage.vehicleId]);

    useEffect(() => {
        if (usage.id) {
            const q = query(collection(db, "expenses"), where("usageId", "==", usage.id));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setExpenses(expensesData);
            });
            return unsubscribe;
        }
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
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                usage.status === 'active' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-gray-100 text-gray-700'
                            }`}>
                                {usage.status === 'active' ? '🚗 กำลังใช้งาน' : '✅ เสร็จสิ้น'}
                            </span>
                        </div>
                        <h3 className="font-semibold text-gray-800 text-lg">
                            {usage.vehicleLicensePlate || vehicle?.licensePlate || 'ไม่ระบุทะเบียน'}
                        </h3>
                        <p className="text-sm text-gray-600">{vehicle?.brand} {vehicle?.model}</p>
                    </div>
                    {getImageUrl(vehicle) && (
                        <Image 
                            src={getImageUrl(vehicle)} 
                            alt="vehicle" 
                            width={80}
                            height={80}
                            className="w-20 h-20 object-cover rounded-lg"
                            unoptimized
                        />
                    )}
                </div>

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-gray-600">เริ่มใช้งาน:</span>
                        <span className="font-medium">{formatDateTime(usage.startTime)}</span>
                    </div>
                    {usage.endTime && (
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-gray-600">ส่งคืนรถ:</span>
                            <span className="font-medium">{formatDateTime(usage.endTime)}</span>
                        </div>
                    )}
                        {/* เลขไมล์เริ่ม-สิ้นสุด ไม่ต้องแสดง */}
                    {totalDistance > 0 && (
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-gray-600">ระยะทางรวม:</span>
                            <span className="font-medium text-teal-600">{totalDistance.toLocaleString()} กม.</span>
                        </div>
                    )}
                    {usage.destination && (
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-gray-600">จุดหมาย:</span>
                            <span className="font-medium">{usage.destination}</span>
                        </div>
                    )}
                </div>

                {(usage.purpose || expenses.length > 0) && (
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
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                        {usage.purpose && (
                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">วัตถุประสงค์:</p>
                                <p className="text-sm text-gray-600">{usage.purpose}</p>
                            </div>
                        )}
                        
                        {expenses.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">ค่าใช้จ่าย ({expenses.length} รายการ):</p>
                                <div className="space-y-2">
                                    {expenses.map(expense => (
                                        <div key={expense.id} className="flex justify-between items-start py-2 border-b border-gray-50">
                                            <div>
                                                <div className="text-sm font-medium">{getExpenseTypeText(expense.type)}</div>
                                                {expense.note && <div className="text-xs text-gray-500 mt-0.5">{expense.note}</div>}
                                                {/* ไม่ต้องแสดงไมล์เริ่มต้นหรือสิ้นสุดในรายละเอียดค่าใช้จ่าย */}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-medium text-teal-600">{expense.amount.toLocaleString()} ฿</div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-200">
                                        <span className="font-semibold text-gray-800">รวมทั้งหมด:</span>
                                        <span className="font-bold text-teal-600">{totalExpenses.toLocaleString()} ฿</span>
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
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        // Query vehicle-usage collection for this user's history
            const q = query(
                collection(db, "vehicle-usage"),
                where("userId", "==", userProfile?.lineId || user.uid),
            orderBy("startTime", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
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
        });

        return () => unsubscribe();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="px-4 py-6 -mt-16">
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="px-4 py-2 -mt-16">
                <h2 className="bg-white rounded-xl shadow-sm p-8 mb-2 text-center">ประวัติการใช้งานรถ</h2>

                {usageHistory.length > 0 ? (
                    <div className="space-y-4 pb-8">
                        {usageHistory.map(usage => (
                            <UsageHistoryCard key={usage.id} usage={usage} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">ยังไม่มีประวัติการใช้งาน</h3>
                        <p className="text-gray-600 mb-6">เริ่มใช้งานรถเพื่อดูประวัติการเดินทาง</p>
                        <button
                            onClick={() => router.push('/vehicle-selection')}
                            className="px-6 py-3 bg-teal-600 text-white rounded-full font-semibold hover:bg-teal-700 transition-all"
                        >
                            เลือกรถเลย
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
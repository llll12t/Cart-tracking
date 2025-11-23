"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, query, collection, where, limit } from "firebase/firestore";
import MainHeader from '@/components/main/MainHeader';
import Image from 'next/image';
import { getImageUrl } from '@/lib/imageHelpers';
import SkeletonLoader from "@/components/main/SkeletonLoader"; // Import Skeleton

export default function MyVehiclePage() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('vehicle');
    const [activeUsage, setActiveUsage] = useState(null);
    const [vehicle, setVehicle] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isReturning, setIsReturning] = useState(false);
    const [endMileage, setEndMileage] = useState("");
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnMessage, setReturnMessage] = useState("");

    useEffect(() => {
        // รอ Auth โหลดเสร็จก่อน
        if (!user && !userProfile) {
            // ถ้า Auth ยังไม่มา ให้ loading ค้างไว้ก่อน หรือถ้าแน่ใจว่าไม่มี user แล้วค่อยปิด
            return;
        }

        let unsubUsage = null;
        let unsubVehicle = null;
        let unsubExpenses = null;

        const userId = userProfile?.lineId || user?.uid;

        // 1. Realtime Listener สำหรับหา Active Usage
        const usageQuery = query(
            collection(db, 'vehicle-usage'),
            where('userId', '==', userId),
            where('status', '==', 'active'),
            limit(1)
        );

        unsubUsage = onSnapshot(usageQuery, (snapshot) => {
            if (!snapshot.empty) {
                const usageDoc = snapshot.docs[0];
                const usageData = { id: usageDoc.id, ...usageDoc.data() };
                
                if (usageData.startTime?.toDate) {
                    usageData.startTime = usageData.startTime.toDate().toISOString();
                }

                setActiveUsage(usageData);
                setEndMileage(usageData.startMileage?.toString() || "");

                // [OPTIMIZATION] เจอ Active Usage แล้ว ปิด Loading ทันทีเพื่อให้ UI แสดงผลก่อน
                // ข้อมูล Vehicle และ Expenses จะตามมาทีหลัง (Pop-in)
                setLoading(false);

                if (usageData.vehicleId) {
                    // 2. Realtime Listener สำหรับ Vehicle
                    const vehicleRef = doc(db, "vehicles", usageData.vehicleId);
                    unsubVehicle = onSnapshot(vehicleRef, (docSnap) => {
                        if (docSnap.exists()) {
                            setVehicle({ id: docSnap.id, ...docSnap.data() });
                        } else {
                            setVehicle({
                                id: usageData.vehicleId,
                                licensePlate: usageData.vehicleLicensePlate,
                                brand: '',
                                model: ''
                            });
                        }
                    });

                    // 3. Realtime Listener สำหรับ Expenses
                    const expensesQuery = query(
                        collection(db, 'expenses'),
                        where('usageId', '==', usageData.id)
                    );
                    
                    unsubExpenses = onSnapshot(expensesQuery, (expSnapshot) => {
                        const expensesData = expSnapshot.docs.map(doc => {
                            const data = doc.data();
                            if (data.timestamp?.toDate) {
                                data.timestamp = data.timestamp.toDate().toISOString();
                            }
                            return { id: doc.id, ...data };
                        });
                        setExpenses(expensesData);
                    }, (error) => {
                        console.error("Error fetching expenses:", error);
                    });

                }
            } else {
                // กรณีไม่พบ Active Usage
                setActiveUsage(null);
                setVehicle(null);
                setExpenses([]);
                setLoading(false);
            }
        }, (error) => {
            console.error("Error fetching active usage:", error);
            setLoading(false);
        });

        return () => {
            if (unsubUsage) unsubUsage();
            if (unsubVehicle) unsubVehicle();
            if (unsubExpenses) unsubExpenses();
        };
    }, [user, userProfile]);

    const handleReturnVehicle = async () => {
        if (!activeUsage) {
            setReturnMessage("ไม่พบข้อมูลการใช้งานรถ");
            return;
        }

        setIsReturning(true);
        setReturnMessage("");

        try {
            const response = await fetch('/api/vehicle-usage/return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usageId: activeUsage.id,
                    ...(endMileage ? { endMileage: Number(endMileage) } : {}),
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setReturnMessage(result.error || 'เกิดข้อผิดพลาดในการส่งคืนรถ');
                setIsReturning(false);
                return;
            }

            setReturnMessage("ส่งคืนรถสำเร็จ!");
            setTimeout(() => {
                if (typeof window !== 'undefined' && window.liff && typeof window.liff.close === 'function') {
                    window.liff.close();
                } else {
                    setShowReturnModal(false);
                    setActiveUsage(null);
                    setVehicle(null);
                    setExpenses([]);
                    router.push('/vehicle-selection');
                }
            }, 1500);

        } catch (error) {
            console.error("Error returning vehicle:", error);
            setReturnMessage("เกิดข้อผิดพลาดในการส่งคืนรถ");
            setIsReturning(false);
        }
    };

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
            case 'fluid': return '🛢️ เปลี่ยนของเหลว';
            case 'other': return '💰 ค่าใช้จ่ายอื่นๆ';
            default: return type;
        }
    };

    const getTotalExpenses = () => {
        return expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    };

    const handleDeleteExpense = async (expenseId) => {
        if (!expenseId) return;
        if (!window.confirm('ยืนยันการลบรายการนี้?')) return;
        try {
            const res = await fetch(`/api/expenses?id=${expenseId}`, { method: 'DELETE' });
            const result = await res.json();
            if (!result.success) {
                alert(result.error || 'เกิดข้อผิดพลาดในการลบ');
            }
        } catch (err) {
            console.error('ลบค่าใช้จ่าย error', err);
            alert('เกิดข้อผิดพลาดในการลบ');
        }
    };

    // [UX IMPROVEMENT] ใช้ SkeletonLoader แทนข้อความธรรมดา
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="-mt-16 px-4">
                   {/* แสดง Skeleton จาก component ที่มีอยู่ */}
                   <SkeletonLoader />
                </div>
            </div>
        );
    }

    if (!activeUsage) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="px-6 py-2 -mt-16">
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                        <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">ยังไม่มีรถที่กำลังใช้งาน</h2>
                        <p className="text-gray-600 mb-6">เลือกรถที่ต้องการใช้งานเพื่อเริ่มเดินทาง</p>
                        <button
                            onClick={() => router.push('/vehicle-selection')}
                            className="px-6 py-3 bg-teal-600 text-white rounded-full font-semibold hover:bg-teal-700 transition-all"
                        >
                            เลือกรถเลย
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="px-6 py-2 -mt-16">
                {/* Vehicle Card */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
                    <div className="flex items-center p-4 gap-4">
                        {getImageUrl(vehicle) && (
                            <Image
                                src={getImageUrl(vehicle)}
                                alt={vehicle.licensePlate}
                                width={80}
                                height={40}
                                className="w-20 h-10 object-cover rounded"
                                unoptimized
                            />
                        )}
                        <div className="flex-1">
                            <div className="flex items-center gap-1 mb-1">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-teal-700 text-xs font-medium">กำลังใช้งาน</span>
                            </div>
                            <h2 className="text-base font-bold text-gray-800">{vehicle ? vehicle.licensePlate : activeUsage.vehicleLicensePlate}</h2>
                            <p className="text-xs text-gray-500 mb-1">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'กำลังโหลดข้อมูลรถ...'}</p>
                            <div className="flex flex-col gap-1">
                                <div className="flex gap-2 text-xs">
                                    <span className="text-gray-600">เริ่มใช้งาน:</span>
                                    <span className="font-medium">{formatDateTime(activeUsage.startTime)}</span>
                                </div>
                                {activeUsage.destination && (
                                    <div className="flex gap-2 text-xs">
                                        <span className="text-gray-600">จุดหมาย:</span>
                                        <span className="font-medium">{activeUsage.destination}</span>
                                    </div>
                                )}
                                {activeUsage.purpose && (
                                    <div className="flex gap-2 text-xs">
                                        <span className="text-gray-600">วัตถุประสงค์:</span>
                                        <span className="font-medium">{activeUsage.purpose}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expenses Summary */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="text-sm font-semibold text-gray-800">ค่าใช้จ่ายระหว่างการใช้งาน</div>
                        <button
                            onClick={() => router.push('/expense-log')}
                            className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-all"
                        >
                            + บันทึกค่าใช้จ่าย
                        </button>
                    </div>

                    {expenses.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">ยังไม่มีรายการค่าใช้จ่าย</p>
                    ) : (
                        <>
                            <div className="space-y-2 mb-3">
                                {expenses.map(expense => (
                                    <div key={expense.id} className="flex justify-between items-center py-2 border-b border-gray-100 group">
                                        <div>
                                            <div className="text-sm font-medium">{getExpenseTypeText(expense.type)}</div>
                                            {expense.note && <div className="text-xs text-gray-500">{expense.note}</div>}
                                            {expense.mileage && (
                                                <div className="text-xs text-gray-500">ไมล์: {expense.mileage.toLocaleString()} กม.</div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="font-medium text-teal-600">{expense.amount.toLocaleString()} ฿</div>
                                            <div className="text-xs text-gray-500">
                                                {formatDateTime(expense.timestamp).split(' ')[1]}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteExpense(expense.id)}
                                                className="text-xs text-red-600 font-semibold border border-red-200 rounded px-2 py-1 mt-1 hover:bg-red-50 hover:border-red-400 transition"
                                                title="ลบรายการนี้"
                                            >
                                                ลบ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                                <span className="font-semibold text-gray-800">รวมทั้งหมด:</span>
                                <span className="font-bold text-lg text-teal-600">{getTotalExpenses().toLocaleString()} ฿</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Return Vehicle Button */}
                <button onClick={() => setShowReturnModal(true)}
                    className="w-full py-4 bg-red-700 text-white rounded-lg font-semibold hover:bg-red-700 transition-all text-sm"
                >
                    ส่งคืนรถ
                </button>
            </div>

            {/* Return Modal */}
            {showReturnModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2">
                    <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-8">
                        <h3 className="text-base font-bold text-gray-800 mb-2 text-center">ส่งคืนรถ</h3>
                        <div className="space-y-2">
                            <div>
                                <h4 className="text-sm font-semibold mb-1">สรุปค่าใช้จ่าย</h4>
                                {expenses.length === 0 ? (
                                    <p className="text-gray-500 text-xs text-center py-1">ไม่มีรายการ</p>
                                ) : (
                                    <ul className="divide-y divide-gray-100 text-sm">
                                        {expenses.map(expense => (
                                            <li key={expense.id} className="flex justify-between items-center py-1">
                                                <span>{getExpenseTypeText(expense.type)}{expense.note ? ` (${expense.note})` : ''}</span>
                                                <span className="font-medium text-teal-600">{expense.amount.toLocaleString()} ฿</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="flex justify-between items-center pt-1 border-t border-gray-200 mt-2">
                                    <span className="font-semibold text-gray-800">รวม:</span>
                                    <span className="font-bold text-base text-teal-600">{getTotalExpenses().toLocaleString()} ฿</span>
                                </div>
                            </div>

                            {returnMessage && (
                                <div className={`p-2 rounded text-xs text-center ${returnMessage.includes('สำเร็จ') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {returnMessage}
                                </div>
                            )}

                            <div className="flex gap-4 mt-4">
                                <button
                                    onClick={() => {
                                        setShowReturnModal(false);
                                        setReturnMessage("");
                                    }}
                                    disabled={isReturning}
                                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-300 transition-all disabled:opacity-50 text-sm"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleReturnVehicle}
                                    disabled={isReturning}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 transition-all disabled:bg-gray-400 text-sm"
                                >
                                    {isReturning ? 'กำลังส่งคืน...' : 'ยืนยันส่งคืน'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import MainHeader from '@/components/main/MainHeader';
import Image from 'next/image';
import { getImageUrl } from '@/lib/imageHelpers';

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

    // Fetch active vehicle usage
    useEffect(() => {
        if (!user && !userProfile) {
            return;
        }

        const fetchActiveUsage = async () => {
            try {
                const userId = userProfile?.lineId || user?.uid;
                const response = await fetch(`/api/vehicle-usage/active?userId=${userId}`);
                const result = await response.json();

                if (result.success && result.usage) {
                    setActiveUsage(result.usage);
                    setEndMileage(result.usage.startMileage?.toString() || "");
                    // Fetch vehicle details
                    if (result.usage.vehicleId) {
                        const vehicleRef = doc(db, "vehicles", result.usage.vehicleId);
                        const unsubVehicle = onSnapshot(vehicleRef, (doc) => {
                            if (doc.exists()) {
                                setVehicle({ id: doc.id, ...doc.data() });
                                setLoading(false); // Set loading false after vehicle data loaded
                            } else {
                                // ถ้าไม่มี vehicle document ให้ใช้ข้อมูลจาก usage แทน
                                setVehicle({
                                    id: result.usage.vehicleId,
                                    licensePlate: result.usage.vehicleLicensePlate,
                                    brand: '',
                                    model: ''
                                });
                                setLoading(false); // Set loading false even if vehicle not found
                            }
                        });
                        // Cleanup
                        return () => unsubVehicle();
                    } else {
                        setLoading(false);
                    }
                } else {
                    setActiveUsage(null);
                    setVehicle(null);
                    setLoading(false);
                }
            } catch (error) {
                setLoading(false);
            }
        };

        fetchActiveUsage();
    }, [user, userProfile]);

    // Fetch expenses for current usage
    useEffect(() => {
        if (!activeUsage) return;

        const fetchExpenses = async () => {
            try {
                const response = await fetch(`/api/expenses?usageId=${activeUsage.id}`);
                const result = await response.json();

                if (result.success) {
                    setExpenses(result.expenses || []);
                }
            } catch (error) {
                console.error("Error fetching expenses:", error);
            }
        };

        fetchExpenses();

        // Refresh expenses every 10 seconds
        const interval = setInterval(fetchExpenses, 10000);
        return () => clearInterval(interval);
    }, [activeUsage]);

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
                    // ไม่ส่ง endMileage ถ้าไม่ได้กรอก
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
                setShowReturnModal(false);
                setActiveUsage(null);
                setVehicle(null);
                setExpenses([]);
                router.push('/vehicle-selection');
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

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="px-4 py-6 -mt-16">
                    <div className="text-center py-12">
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!activeUsage || !vehicle) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="px-4 py-2 -mt-16">
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

            <div className="px-4 py-2 -mt-16">
                {/* Vehicle Card */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
                    <div className="flex items-center p-2 gap-4">
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
                            <h2 className="text-base font-bold text-gray-800">{vehicle.licensePlate}</h2>
                            <p className="text-xs text-gray-500 mb-1">{vehicle.brand} {vehicle.model}</p>
                            <div className="flex flex-col gap-1">
                                <div className="flex gap-2 text-xs">
                                    <span className="text-gray-600">เริ่มใช้งาน:</span>
                                    <span className="font-medium">{formatDateTime(activeUsage.startTime)}</span>
                                </div>
                                {/* ไม่ต้องแสดงไมล์เริ่มต้น */}
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
                                    <div key={expense.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <div>
                                            <div className="text-sm font-medium">{getExpenseTypeText(expense.type)}</div>
                                            {expense.note && <div className="text-xs text-gray-500">{expense.note}</div>}
                                            {expense.mileage && (
                                                <div className="text-xs text-gray-500">ไมล์: {expense.mileage.toLocaleString()} กม.</div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-teal-600">{expense.amount.toLocaleString()} ฿</div>
                                            <div className="text-xs text-gray-500">
                                                {formatDateTime(expense.timestamp).split(' ')[1]}
                                            </div>
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
                    className="w-full py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all shadow-lg"
                >
                      ส่งคืนรถ
                </button>
            </div>

            {/* Return Modal */}
            {showReturnModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2">
                    <div className="bg-white rounded-xl shadow-lg max-w-xs w-full p-3">
                        <h3 className="text-base font-bold text-gray-800 mb-2 text-center">ส่งคืนรถ</h3>
                        <div className="space-y-2">
                            <div>
                                <h4 className="text-sm font-semibold mb-1">สรุปค่าใช้จ่าย</h4>
                                {expenses.length === 0 ? (
                                    <p className="text-gray-500 text-xs text-center py-1">ไม่มีรายการ</p>
                                ) : (
                                    <ul className="divide-y divide-gray-100 text-xs">
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

                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => {
                                        setShowReturnModal(false);
                                        setReturnMessage("");
                                    }}
                                    disabled={isReturning}
                                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300 transition-all disabled:opacity-50 text-xs"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleReturnVehicle}
                                    disabled={isReturning}
                                    className="flex-1 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition-all disabled:bg-gray-400 text-xs"
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

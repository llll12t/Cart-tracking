"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import Link from 'next/link';

// Component สำหรับแสดง Card สรุปข้อมูล
function StatCard({ title, value, icon, link }) {
    return (
        <Link href={link || '#'} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                </div>
                <div className="text-4xl text-indigo-500">{icon}</div>
            </div>
        </Link>
    );
}


// Utility functions (top-level)
const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('th-TH');
    } catch (e) {
        return 'N/A';
    }
};

const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (e) {
        return 'N/A';
    }
};

const getExpenseType = (type) => {
    switch (type) {
        case 'fuel': return '⛽ น้ำมัน';
        case 'fluid': return '🛢️ เปลี่ยนของเหลว';
        case 'other': return '💰 อื่นๆ';
        default: return type;
    }
};

// Component สำหรับแสดงรายการแจ้งเตือน
function AlertList({ title, items, type }) {
    const textColor = type === 'tax' ? 'text-red-600' : type === 'insurance' ? 'text-orange-600' : 'text-blue-600';

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="font-bold text-lg mb-4">{title}</h3>
            <ul className="space-y-3">
                {items.length > 0 ? items.map(item => (
                    <li key={item.id} className="flex justify-between items-center text-sm">
                        <span>
                          {item.brand} {item.model} ({item.licensePlate})
                          <span className="ml-2 text-xs text-gray-500">เลขไมล์ล่าสุด: {item.currentMileage?.toLocaleString?.() ?? '-'}</span>
                        </span>
                        <span className={`font-semibold ${textColor}`}>
                            {type === 'fluidChange' 
                                ? item.lastFluidMileage === undefined || item.lastFluidMileage === null
                                    ? 'ยังไม่ระบุ'
                                    : `เหลืออีก ${(10000 - item.mileageSinceLastChange).toLocaleString()} กม.`
                                : `หมดอายุ: ${formatDate(type === 'tax' ? item.taxDueDate : item.insuranceExpireDate)}`
                            }
                        </span>
                    </li>
                )) : <p className="text-sm text-gray-500">ไม่มีรายการแจ้งเตือน</p>}
            </ul>
        </div>
    );
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({ available: 0, inUse: 0, maintenance: 0, totalUsage: 0 });
    const [alerts, setAlerts] = useState({ tax: [], insurance: [], fluidChange: [] });
    const [activeUsages, setActiveUsages] = useState([]);
    const [recentExpenses, setRecentExpenses] = useState([]);
    const [expenseVehicles, setExpenseVehicles] = useState({});
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        // ดึงข้อมูลสรุปสถานะรถ
        const vehiclesQuery = query(collection(db, "vehicles"));
        const activeUsageQuery = query(collection(db, "vehicle-usage"), where("status", "==", "active"));
        const expensesQuery = query(collection(db, "expenses"));
        
        const unsubVehicles = onSnapshot(vehiclesQuery, async (snapshot) => {
            let available = 0, inUse = 0, maintenance = 0;
            let taxAlerts = [], insuranceAlerts = [], fluidChangeAlerts = [];
            const thirtyDaysFromNow = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

            // ดึงข้อมูล expenses ทั้งหมด (fuel, fluid, other) เพื่อหาเลขไมล์ล่าสุดของแต่ละคัน
            const { getDocs } = await import('firebase/firestore');
            const allExpensesSnapshot = await getDocs(collection(db, 'expenses'));
            const fluidExpensesByVehicle = {};
            const latestMileageByVehicle = {};
            
            allExpensesSnapshot.docs.forEach(doc => {
                const exp = doc.data();
                if (exp.vehicleId && exp.mileage) {
                    // หา expense ที่เป็น fluid ล่าสุด
                    if (exp.type === 'fluid') {
                        if (!fluidExpensesByVehicle[exp.vehicleId] || exp.mileage > fluidExpensesByVehicle[exp.vehicleId].mileage) {
                            fluidExpensesByVehicle[exp.vehicleId] = exp;
                        }
                    }
                    // หาเลขไมล์ล่าสุดจาก expenses ทั้งหมด
                    if (!latestMileageByVehicle[exp.vehicleId] || exp.mileage > latestMileageByVehicle[exp.vehicleId]) {
                        latestMileageByVehicle[exp.vehicleId] = exp.mileage;
                    }
                }
            });

            snapshot.docs.forEach(doc => {
                const vehicle = { id: doc.id, ...doc.data() };
                if (vehicle.status === 'available') available++;
                else if (vehicle.status === 'in-use' || vehicle.status === 'in_use') inUse++;
                else if (vehicle.status === 'maintenance') maintenance++;

                // เช็ควันหมดอายุ
                if (vehicle.taxDueDate && vehicle.taxDueDate <= thirtyDaysFromNow) taxAlerts.push({ ...vehicle, currentMileage: latestMileageByVehicle[vehicle.id] || 0 });
                if (vehicle.insuranceExpireDate && vehicle.insuranceExpireDate <= thirtyDaysFromNow) insuranceAlerts.push({ ...vehicle, currentMileage: latestMileageByVehicle[vehicle.id] || 0 });

                // เช็คการเปลี่ยนของเหลว - เตือนเมื่อวิ่งครบ 10,000 กม. นับจากการเปลี่ยนครั้งล่าสุด
                const lastFluidChange = fluidExpensesByVehicle[vehicle.id];
                const currentMileage = latestMileageByVehicle[vehicle.id] || 0;
                if (lastFluidChange) {
                    const mileageSinceLastChange = currentMileage - lastFluidChange.mileage;
                    // แจ้งเตือนเมื่อเหลือไม่ถึง 1,000 กม. ก่อนครบ 10,000 กม. (9,000-9,999)
                    if (mileageSinceLastChange >= 9000) {
                        fluidChangeAlerts.push({
                            ...vehicle,
                            lastFluidMileage: lastFluidChange.mileage,
                            currentMileage,
                            mileageSinceLastChange
                        });
                    }
                } else if (currentMileage >= 9000) {
                    // ถ้าไม่เคยเปลี่ยนเลย และไมล์ปัจจุบันครบ 9,000 ขึ้นไป
                    fluidChangeAlerts.push({
                        ...vehicle,
                        lastFluidMileage: 0,
                        currentMileage,
                        mileageSinceLastChange: currentMileage
                    });
                }
            });
            
            setStats(prev => ({ ...prev, available, inUse, maintenance }));
            setAlerts({ tax: taxAlerts, insurance: insuranceAlerts, fluidChange: fluidChangeAlerts });
        });

        const unsubUsages = onSnapshot(activeUsageQuery, (snapshot) => {
            const usages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActiveUsages(usages);
        });

        const unsubExpenses = onSnapshot(expensesQuery, async (snapshot) => {
            const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by timestamp
            expenses.sort((a, b) => {
                const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
                const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
                return bTime - aTime;
            });
            setRecentExpenses(expenses);
            // Fetch vehicle info for all expenses
            const vehicleIds = Array.from(new Set(expenses.map(e => e.vehicleId).filter(Boolean)));
            if (vehicleIds.length > 0) {
                const { getDoc, doc } = await import('firebase/firestore');
                const vehicleMap = {};
                await Promise.all(vehicleIds.map(async (vid) => {
                    try {
                        const vSnap = await getDoc(doc(db, 'vehicles', vid));
                        if (vSnap.exists()) vehicleMap[vid] = vSnap.data();
                    } catch {}
                }));
                setExpenseVehicles(vehicleMap);
            } else {
                setExpenseVehicles({});
            }
        });

        // Get total usage count
        const usageQuery = query(collection(db, "vehicle-usage"));
        const unsubTotalUsage = onSnapshot(usageQuery, (snapshot) => {
            setStats(prev => ({ ...prev, totalUsage: snapshot.size }));
        });

        setLoading(false);
        
        return () => {
            unsubVehicles();
            unsubUsages();
            unsubExpenses();
            unsubTotalUsage();
        };
    }, []);

    if (loading) return <p>Loading Dashboard...</p>;

    // Pagination logic
    const totalPages = Math.ceil(recentExpenses.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentExpenses = recentExpenses.slice(startIndex, endIndex);

    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => setCurrentPage(totalPages);
    const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
    const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard ภาพรวม</h1>
            {/* ส่วนแสดงข้อมูลสรุป */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="รถว่าง" value={stats.available} icon="✅" link="/vehicles" />
                <StatCard title="กำลังใช้งาน" value={stats.inUse} icon="🚗" link="/vehicles/in-use" />
                <StatCard title="ซ่อมบำรุง" value={stats.maintenance} icon="🔧" link="/maintenance" />
                <StatCard title="ประวัติทั้งหมด" value={stats.totalUsage} icon="📊" link="/trip-history" />
            </div>

            {/* ส่วนแจ้งเตือน */}
            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <AlertList title="ภาษีรถยนต์จะหมดอายุใน 30 วัน" items={alerts.tax} type="tax" />
                <AlertList title="ประกันรถยนต์จะหมดอายุใน 30 วัน" items={alerts.insurance} type="insurance" />
                <AlertList title="ใกล้ครบกำหนดเปลี่ยนของเหลว (10,000 กม.)" items={alerts.fluidChange} type="fluidChange" />
            </div>

            {/* ค่าใช้จ่ายล่าสุด */}
            {recentExpenses.length > 0 && (
                <div className="mt-10">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">ค่าใช้จ่ายล่าสุด</h2>
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ทะเบียน</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เลขไมล์</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวนเงิน</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเหตุ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {currentExpenses.map(expense => {
                                        const vehicle = expenseVehicles[expense.vehicleId];
                                        return (
                                            <tr key={expense.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatDateTime(expense.timestamp)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {vehicle?.licensePlate || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {getExpenseType(expense.type)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {expense.mileage ? `${expense.mileage.toLocaleString()} กม.` : '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-teal-600">
                                                    {expense.amount?.toLocaleString()} ฿
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {expense.note || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination controls */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    แสดง {startIndex + 1}-{Math.min(endIndex, recentExpenses.length)} จาก {recentExpenses.length} รายการ
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={goToFirstPage}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 bg-white border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                    >
                                        หน้าแรก
                                    </button>
                                    <button
                                        onClick={goToPrevPage}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 bg-white border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                    >
                                        ก่อนหน้า
                                    </button>
                                    <span className="px-3 py-1 text-sm">
                                        หน้า {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={goToNextPage}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 bg-white border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                    >
                                        ถัดไป
                                    </button>
                                    <button
                                        onClick={goToLastPage}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 bg-white border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                    >
                                        หน้าสุดท้าย
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
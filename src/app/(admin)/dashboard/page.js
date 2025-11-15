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
                        <span>{item.brand} {item.model} ({item.licensePlate})</span>
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ดึงข้อมูลสรุปสถานะรถ
        const vehiclesQuery = query(collection(db, "vehicles"));
        const activeUsageQuery = query(collection(db, "vehicle-usage"), where("status", "==", "active"));
        const expensesQuery = query(collection(db, "expenses"));
        
        const unsubVehicles = onSnapshot(vehiclesQuery, async (snapshot) => {
            let available = 0, inUse = 0, maintenance = 0;
            let taxAlerts = [], insuranceAlerts = [], fluidChangeAlerts = [];
            const thirtyDaysFromNow = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

            // ดึงข้อมูล fluid expenses สำหรับตรวจสอบการเปลี่ยนของเหลว
            const { getDocs } = await import('firebase/firestore');
            const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('type', '==', 'fluid')));
            const fluidExpensesByVehicle = {};
            
            expensesSnapshot.docs.forEach(doc => {
                const exp = doc.data();
                if (exp.vehicleId && exp.mileage) {
                    if (!fluidExpensesByVehicle[exp.vehicleId] || exp.mileage > fluidExpensesByVehicle[exp.vehicleId].mileage) {
                        fluidExpensesByVehicle[exp.vehicleId] = exp;
                    }
                }
            });

            snapshot.docs.forEach(doc => {
                const vehicle = { id: doc.id, ...doc.data() };
                if (vehicle.status === 'available') available++;
                else if (vehicle.status === 'in-use' || vehicle.status === 'in_use') inUse++;
                else if (vehicle.status === 'maintenance') maintenance++;

                // เช็ควันหมดอายุ
                if (vehicle.taxDueDate && vehicle.taxDueDate <= thirtyDaysFromNow) taxAlerts.push(vehicle);
                if (vehicle.insuranceExpireDate && vehicle.insuranceExpireDate <= thirtyDaysFromNow) insuranceAlerts.push(vehicle);

                // เช็คการเปลี่ยนของเหลว - เตือนเมื่อวิ่งเกือบ 10,000 กม. นับจากการเปลี่ยนครั้งล่าสุด
                const lastFluidChange = fluidExpensesByVehicle[vehicle.id];
                const currentMileage = vehicle.currentMileage || 0;
                
                if (lastFluidChange) {
                    const mileageSinceLastChange = currentMileage - lastFluidChange.mileage;
                    // แจ้งเตือนเมื่อวิ่งครบ 9,000 กม. (เหลืออีก 1,000 กม. ก่อนครบ 10,000)
                    if (mileageSinceLastChange >= 9000 && mileageSinceLastChange < 10000) {
                        fluidChangeAlerts.push({
                            ...vehicle,
                            lastFluidMileage: lastFluidChange.mileage,
                            currentMileage,
                            mileageSinceLastChange
                        });
                    }
                } else if (currentMileage >= 9000) {
                    // ถ้าไม่เคยเปลี่ยนเลย และไมล์ปัจจุบันเกือบ 10,000
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

        const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
            const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by timestamp and get recent 5
            expenses.sort((a, b) => {
                const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
                const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
                return bTime - aTime;
            });
            setRecentExpenses(expenses.slice(0, 5));
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
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวนเงิน</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเหตุ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {recentExpenses.map(expense => (
                                        <tr key={expense.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDateTime(expense.timestamp)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {getExpenseType(expense.type)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-teal-600">
                                                {expense.amount?.toLocaleString()} ฿
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {expense.note || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
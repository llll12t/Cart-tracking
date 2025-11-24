"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import Link from 'next/link';

// --- Icons ---
const Icons = {
    Car: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
    ),
    SteeringWheel: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
    ),
    Wrench: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
    ),
    Clipboard: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
    ),
    DocumentText: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
    ),
    ShieldCheck: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
    ),
    Beaker: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
    ),
    ChevronRight: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
    ),
    ChevronLeft: ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
    )
};

// Component สำหรับแสดง Card สรุปข้อมูล
function StatCard({ title, value, icon: Icon, link, bgClass, textClass }) {
    return (
        <Link href={link || '#'} className="block p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 group">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`p-3 rounded-lg ${bgClass}`}>
                    <Icon className={`w-8 h-8 ${textClass}`} />
                </div>
            </div>
        </Link>
    );
}

// Utility functions
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
        case 'fuel': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">⛽ น้ำมัน</span>;
        case 'fluid': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">🛢️ ของเหลว</span>;
        case 'other': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">💰 อื่นๆ</span>;
        default: return type;
    }
};

// Component สำหรับแสดงรายการแจ้งเตือน
function AlertList({ title, items, type, icon: Icon }) {
    const colorClass = type === 'tax' ? 'text-red-600 bg-red-50' : type === 'insurance' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50';
    const iconColor = type === 'tax' ? 'text-red-500' : type === 'insurance' ? 'text-orange-500' : 'text-blue-500';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
                <Icon className={`w-5 h-5 ${iconColor}`} />
                <h3 className="font-semibold text-gray-800">{title}</h3>
                <span className="ml-auto text-xs font-medium px-2 py-1 bg-white rounded-full border border-gray-200 text-gray-500">
                    {items.length}
                </span>
            </div>
            <div className="p-4 overflow-y-auto max-h-[300px] flex-1">
                <ul className="space-y-3">
                    {items.length > 0 ? items.map(item => (
                        <li key={item.id} className="text-sm p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">
                                        {item.brand} {item.model}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        {item.licensePlate} • {item.currentMileage?.toLocaleString?.() ?? '-'} กม.
                                    </div>
                                </div>
                                <span className={`text-xs font-medium whitespace-nowrap px-2 py-1 rounded ${type === 'fluidChange' && item.mileageSinceLastChange >= 10000
                                    ? 'bg-red-100 text-red-700'
                                    : colorClass
                                    }`}>
                                    {type === 'fluidChange'
                                        ? item.lastFluidMileage === undefined || item.lastFluidMileage === null
                                            ? 'ยังไม่ระบุ'
                                            : item.mileageSinceLastChange >= 10000
                                                ? `เกิน ${(item.mileageSinceLastChange - 10000).toLocaleString()} กม.`
                                                : `เหลือ ${(10000 - item.mileageSinceLastChange).toLocaleString()} กม.`
                                        : `${formatDate(type === 'tax' ? item.taxDueDate : item.insuranceExpireDate)}`
                                    }
                                </span>
                            </div>
                        </li>
                    )) : <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                        <Icon className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">ไม่มีรายการแจ้งเตือน</p>
                    </div>}
                </ul>
            </div>
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
        const vehiclesQuery = query(collection(db, "vehicles"));
        const activeUsageQuery = query(collection(db, "vehicle-usage"), where("status", "==", "active"));
        const expensesQuery = query(collection(db, "expenses"));

        const unsubVehicles = onSnapshot(vehiclesQuery, async (snapshot) => {
            let available = 0, inUse = 0, maintenance = 0;
            let taxAlerts = [], insuranceAlerts = [], fluidChangeAlerts = [];
            const thirtyDaysFromNow = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

            const { getDocs } = await import('firebase/firestore');
            const allExpensesSnapshot = await getDocs(collection(db, 'expenses'));
            const fluidExpensesByVehicle = {};
            const latestMileageByVehicle = {};

            allExpensesSnapshot.docs.forEach(doc => {
                const exp = doc.data();
                if (exp.vehicleId && exp.mileage) {
                    if (exp.type === 'fluid') {
                        if (!fluidExpensesByVehicle[exp.vehicleId] || exp.mileage > fluidExpensesByVehicle[exp.vehicleId].mileage) {
                            fluidExpensesByVehicle[exp.vehicleId] = exp;
                        }
                    }
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

                if (vehicle.taxDueDate && vehicle.taxDueDate <= thirtyDaysFromNow) taxAlerts.push({ ...vehicle, currentMileage: latestMileageByVehicle[vehicle.id] || 0 });
                if (vehicle.insuranceExpireDate && vehicle.insuranceExpireDate <= thirtyDaysFromNow) insuranceAlerts.push({ ...vehicle, currentMileage: latestMileageByVehicle[vehicle.id] || 0 });

                const lastFluidChange = fluidExpensesByVehicle[vehicle.id];
                const currentMileage = latestMileageByVehicle[vehicle.id] || 0;
                if (lastFluidChange) {
                    const mileageSinceLastChange = currentMileage - lastFluidChange.mileage;
                    if (mileageSinceLastChange >= 9000) {
                        fluidChangeAlerts.push({
                            ...vehicle,
                            lastFluidMileage: lastFluidChange.mileage,
                            currentMileage,
                            mileageSinceLastChange
                        });
                    }
                } else if (currentMileage >= 9000) {
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
            expenses.sort((a, b) => {
                const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
                const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
                return bTime - aTime;
            });
            setRecentExpenses(expenses);
            const vehicleIds = Array.from(new Set(expenses.map(e => e.vehicleId).filter(Boolean)));
            if (vehicleIds.length > 0) {
                const { getDoc, doc } = await import('firebase/firestore');
                const vehicleMap = {};
                await Promise.all(vehicleIds.map(async (vid) => {
                    try {
                        const vSnap = await getDoc(doc(db, 'vehicles', vid));
                        if (vSnap.exists()) vehicleMap[vid] = vSnap.data();
                    } catch { }
                }));
                setExpenseVehicles(vehicleMap);
            } else {
                setExpenseVehicles({});
            }
        });

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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const totalPages = Math.ceil(recentExpenses.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentExpenses = recentExpenses.slice(startIndex, endIndex);

    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => setCurrentPage(totalPages);
    const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
    const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm mt-1">ภาพรวมสถานะยานพาหนะและการใช้งาน</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard title="รถว่างพร้อมใช้" value={stats.available} icon={Icons.Car} link="/vehicles" bgClass="bg-green-50" textClass="text-green-600" />
                <StatCard title="กำลังใช้งาน" value={stats.inUse} icon={Icons.SteeringWheel} link="/vehicles/in-use" bgClass="bg-blue-50" textClass="text-blue-600" />
                <StatCard title="ซ่อมบำรุง" value={stats.maintenance} icon={Icons.Wrench} link="/maintenance" bgClass="bg-orange-50" textClass="text-orange-600" />
                <StatCard title="ประวัติการใช้" value={stats.totalUsage} icon={Icons.Clipboard} link="/trip-history" bgClass="bg-purple-50" textClass="text-purple-600" />
            </div>

            {/* Alerts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                <AlertList title="ภาษีใกล้หมดอายุ (30 วัน)" items={alerts.tax} type="tax" icon={Icons.DocumentText} />
                <AlertList title="ประกันใกล้หมดอายุ (30 วัน)" items={alerts.insurance} type="insurance" icon={Icons.ShieldCheck} />
                <AlertList title="ครบกำหนดเปลี่ยนของเหลว" items={alerts.fluidChange} type="fluidChange" icon={Icons.Beaker} />
            </div>

            {/* Recent Expenses */}
            {recentExpenses.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">ค่าใช้จ่ายล่าสุด</h2>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50/50">
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
                                        <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDateTime(expense.timestamp)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {vehicle?.licensePlate || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {getExpenseType(expense.type)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {expense.mileage ? `${expense.mileage.toLocaleString()} กม.` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {expense.amount?.toLocaleString()} ฿
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                                {expense.note || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {currentExpenses.map(expense => {
                            const vehicle = expenseVehicles[expense.vehicleId];
                            return (
                                <div key={expense.id} className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-gray-900">{vehicle?.licensePlate || 'ไม่ระบุทะเบียน'}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{formatDateTime(expense.timestamp)}</div>
                                        </div>
                                        <div className="font-bold text-gray-900">{expense.amount?.toLocaleString()} ฿</div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        {getExpenseType(expense.type)}
                                        <span className="text-gray-400">•</span>
                                        <span className="text-gray-600">{expense.mileage ? `${expense.mileage.toLocaleString()} กม.` : '-'}</span>
                                    </div>
                                    {expense.note && (
                                        <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                                            {expense.note}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                            <div className="hidden sm:block text-sm text-gray-700">
                                แสดง {startIndex + 1}-{Math.min(endIndex, recentExpenses.length)} จาก {recentExpenses.length}
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto justify-center">
                                <button onClick={goToFirstPage} disabled={currentPage === 1} className="p-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span className="sr-only">First</span>
                                    <span className="text-xs">«</span>
                                </button>
                                <button onClick={goToPrevPage} disabled={currentPage === 1} className="p-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Icons.ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-4 py-2 text-sm font-medium bg-white border rounded-lg">
                                    {currentPage} / {totalPages}
                                </span>
                                <button onClick={goToNextPage} disabled={currentPage === totalPages} className="p-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Icons.ChevronRight className="w-4 h-4" />
                                </button>
                                <button onClick={goToLastPage} disabled={currentPage === totalPages} className="p-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span className="sr-only">Last</span>
                                    <span className="text-xs">»</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
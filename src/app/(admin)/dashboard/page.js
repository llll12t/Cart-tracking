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

// Component สำหรับแสดงรายการแจ้งเตือน
function AlertList({ title, items, type }) {
    const formatDate = (timestamp) => timestamp ? new Date(timestamp.seconds * 1000).toLocaleDateString('th-TH') : 'N/A';
    const textColor = type === 'tax' ? 'text-red-600' : 'text-orange-600';

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="font-bold text-lg mb-4">{title}</h3>
            <ul className="space-y-3">
                {items.length > 0 ? items.map(item => (
                    <li key={item.id} className="flex justify-between items-center text-sm">
                        <span>{item.brand} {item.model} ({item.licensePlate})</span>
                        <span className={`font-semibold ${textColor}`}>
                            หมดอายุ: {formatDate(type === 'tax' ? item.taxDueDate : item.insuranceExpireDate)}
                        </span>
                    </li>
                )) : <p className="text-sm text-gray-500">ไม่มีรายการแจ้งเตือน</p>}
            </ul>
        </div>
    );
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({ available: 0, inUse: 0, maintenance: 0, pending: 0 });
    const [alerts, setAlerts] = useState({ tax: [], insurance: [] });
    const [loading, setLoading] = useState(true);
    // maintenanceVehicles list removed per request

    useEffect(() => {
        // ดึงข้อมูลสรุปสถานะรถ
        const vehiclesQuery = query(collection(db, "vehicles"));
        const unsubVehicles = onSnapshot(vehiclesQuery, (snapshot) => {
            let available = 0, inUse = 0, maintenance = 0;
            let taxAlerts = [], insuranceAlerts = [];
            const thirtyDaysFromNow = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

            snapshot.docs.forEach(doc => {
                const vehicle = { id: doc.id, ...doc.data() };
                if (vehicle.status === 'available') available++;
                else if (vehicle.status === 'in_use' || vehicle.status === 'on_trip') inUse++;
                else if (vehicle.status === 'maintenance') maintenance++;

                // เช็ควันหมดอายุ
                if (vehicle.taxDueDate && vehicle.taxDueDate <= thirtyDaysFromNow) taxAlerts.push(vehicle);
                if (vehicle.insuranceExpireDate && vehicle.insuranceExpireDate <= thirtyDaysFromNow) insuranceAlerts.push(vehicle);
            });
            setStats(prev => ({ ...prev, available, inUse, maintenance }));
            setAlerts({ tax: taxAlerts, insurance: insuranceAlerts });
        });

        // ดึงจำนวนคำขอที่รอดำเนินการ
        const bookingsQuery = query(collection(db, "bookings"), where("status", "==", "pending"));
        const unsubBookings = onSnapshot(bookingsQuery, (snapshot) => {
            setStats(prev => ({ ...prev, pending: snapshot.size }));
        });
        setLoading(false);

        return () => {
            unsubVehicles();
            unsubBookings();
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
                <StatCard title="คำขอรออนุมัติ" value={stats.pending} icon="🔔" link="/approvals" />
            </div>

            {/* ส่วนแจ้งเตือน */}
            <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AlertList title="ภาษีรถยนต์จะหมดอายุใน 30 วัน" items={alerts.tax} type="tax" />
                <AlertList title="ประกันรถยนต์จะหมดอายุใน 30 วัน" items={alerts.insurance} type="insurance" />
            </div>

            {/* vehicles-under-maintenance list removed per request */}
        </div>
    );
}
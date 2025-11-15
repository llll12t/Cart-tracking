"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import AddFluidLogForm from '@/components/admin/AddFluidLogForm';

export default function FluidHistoryPage() {
    const { vehicleId } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [fluidLogs, setFluidLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isReloading, setIsReloading] = useState(false);

    useEffect(() => {
        if (!vehicleId) return;
        const vehicleRef = doc(db, "vehicles", vehicleId);
        getDoc(vehicleRef).then(docSnap => {
            if (docSnap.exists()) setVehicle({ id: docSnap.id, ...docSnap.data() });
        });

        // ดึง expenses ที่ type='fluid' และ vehicleId ตรง
        const fetchFluidExpenses = async () => {
            try {
                const expensesSnap = await (await import('firebase/firestore')).getDocs(
                    query(collection(db, 'expenses'), where('vehicleId', '==', vehicleId), where('type', '==', 'fluid'))
                );
                const fluidExps = expensesSnap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    source: 'expenses'
                }));
                // Sort by timestamp
                const sorted = fluidExps.sort((a, b) => {
                    const at = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
                    const bt = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
                    return bt - at;
                });
                setFluidLogs(sorted);
            } catch (e) {
                setFluidLogs([]);
            }
            setLoading(false);
        };
        fetchFluidExpenses();
    }, [vehicleId]);

    // แสดงชื่อผู้บันทึก
    function FluidRecord({ record }) {
        const formatDateTime = (timestamp) => {
            if (!timestamp) return '-';
            let dateObj;
            if (timestamp.seconds) {
                dateObj = new Date(timestamp.seconds * 1000);
            } else {
                dateObj = new Date(timestamp);
            }
            return dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) +
                ' ' + dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        };
        const formatCurrency = (number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(number);
        
        // แสดง badge แหล่งที่มา
        const sourceBadge = record.source === 'admin' ? (
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">บันทึกจากพนักงาน</span>
        ) : record.usageId ? (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">จากทริป</span>
        ) : null;

        // ดึงชื่อผู้บันทึก
        const [userName, setUserName] = useState(record.userName || '-');
        useEffect(() => {
            async function fetchUser() {
                const uid = (record.userId || '').toString().trim();
                if (uid) {
                    try {
                        const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
                        const userRef = doc(db, 'users', uid);
                        const snap = await getDoc(userRef);
                        if (snap.exists()) {
                            const data = snap.data();
                            setUserName(data.displayName || data.name || data.fullName || '-');
                            return;
                        }
                        const q = query(collection(db, 'users'), where('lineId', '==', uid));
                        const qSnap = await getDocs(q);
                        if (!qSnap.empty) {
                            const data = qSnap.docs[0].data();
                            setUserName(data.displayName || data.name || data.fullName || '-');
                            return;
                        }
                        setUserName('-');
                    } catch (err) {
                        setUserName('-');
                    }
                } else {
                    setUserName('-');
                }
            }
            fetchUser();
        }, [record.userId]);

        return (
            <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDateTime(record.timestamp)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{userName}</td>
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.mileage ? record.mileage.toLocaleString() + ' กม.' : '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{record.amount ? formatCurrency(record.amount) : '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{sourceBadge}</td>
            </tr>
        );
    }

    // คำนวณราคารวมทั้งหมด
    const totalCost = fluidLogs.reduce((sum, rec) => sum + (rec.amount || 0), 0);

    // หาเลขไมล์ล่าสุดที่เปลี่ยนของเหลว
    const lastMileage = fluidLogs.length > 0 && fluidLogs.some(r => r.mileage) 
        ? Math.max(...fluidLogs.filter(r => r.mileage).map(r => r.mileage)) 
        : null;

    if (loading) return <p>Loading fluid logs...</p>;

    return (
        <div>
            {vehicle && (
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center space-x-4">
                        {vehicle.imageUrl && (
                            <Image src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} width={96} height={64} className="object-cover rounded-md shadow" unoptimized />
                        )}
                        <div>
                            <h1 className="text-3xl font-bold">ประวัติการเปลี่ยนของเหลว</h1>
                            <p className="text-xl text-gray-600">{vehicle.brand} {vehicle.model} ({vehicle.licensePlate})</p>
                            {lastMileage && (
                                <p className="text-md text-blue-700 font-semibold mt-2">เลขไมล์ล่าสุดที่เปลี่ยนของเหลว: {lastMileage.toLocaleString()} กม.</p>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setShowForm(true)} className="px-4 py-2 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700">
                        + เพิ่มรายการเปลี่ยนของเหลว
                    </button>
                </div>
            )}
            <div className="space-y-4">
                {fluidLogs.length > 0 && (
                    <div className="bg-gray-100 p-4 rounded-lg grid grid-cols-2 gap-4 font-bold text-gray-800">
                        <p>ราคารวมทั้งหมด</p>
                        <p className="text-right">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(totalCost)}</p>
                    </div>
                )}
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่/เวลา</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้บันทึก</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขไมล์</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ราคา</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">แหล่งที่มา</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {fluidLogs.length > 0 ? (
                                fluidLogs.map(log => <FluidRecord key={log.id} record={log} />)
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">ยังไม่มีประวัติการเปลี่ยนของเหลว</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {showForm && <AddFluidLogForm vehicleId={vehicleId} onClose={(success) => {
                setShowForm(false);
                if (success) {
                    setIsReloading(true);
                    setTimeout(() => {
                        window.location.reload();
                    }, 300);
                }
            }} />}
            {isReloading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
                        <p className="mt-4 text-white text-lg font-semibold">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            )}
        </div>
    );
}

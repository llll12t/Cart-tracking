"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import AddFuelLogForm from '@/components/admin/AddFuelLogForm';
import Image from 'next/image';

function FuelRecord({ record }) {
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
    const efficiency = record.previousMileage && record.liters ? ((record.mileage - record.previousMileage) / record.liters).toFixed(2) : 'N/A';
    const pricePerLiter = record.liters > 0 ? (record.cost / record.liters) : 0;

    // แสดง badge แหล่งที่มา
    const sourceBadge = record.source === 'expenses' ? (
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">จากทริป</span>
    ) : null;

    // ดึงชื่อผู้เติมน้ำมัน (เฉพาะกรณี expenses)
    const [userName, setUserName] = useState('-');
    useEffect(() => {
        async function fetchUser() {
            const uid = (record.userId || '').toString().trim();
            if (uid) {
                try {
                    const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
                    // ลองค้นด้วย doc id ก่อน
                    const userRef = doc(db, 'users', uid);
                    const snap = await getDoc(userRef);
                    if (snap.exists()) {
                        const data = snap.data();
                        setUserName(data.displayName || data.name || data.fullName || '-');
                        return;
                    }
                    // ถ้าไม่เจอ ให้ค้น users ที่ lineId ตรงกับ userId
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
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDateTime(record.date)}</td>
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{userName}</td>
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.mileage ? record.mileage.toLocaleString() + ' กม.' : '-'}</td>
            <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{formatCurrency(record.cost)}</td>
            <td className="px-4 py-3 text-sm text-gray-900">{sourceBadge}</td>
        </tr>
    );
}

export default function FuelPage() {
    const { vehicleId } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [fuelLogs, setFuelLogs] = useState([]);
    const [fuelExpenses, setFuelExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [lastMileage, setLastMileage] = useState(null);

    useEffect(() => {
        if (!vehicleId) return;
        const vehicleRef = doc(db, "vehicles", vehicleId);
        getDoc(vehicleRef).then(docSnap => {
            if (docSnap.exists()) setVehicle({ id: docSnap.id, ...docSnap.data() });
        });

        // ดึง fuel_logs
        const q = query(
            collection(db, "fuel_logs"),
            where("vehicleId", "==", vehicleId),
            orderBy("date", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'fuel_logs' }));
            setFuelLogs(logsData);
        });

        // ดึง expenses ที่ type='fuel' และ vehicleId ตรง
        const fetchFuelExpenses = async () => {
            try {
                const expensesSnap = await (await import('firebase/firestore')).getDocs(
                    query(collection(db, 'expenses'), where('vehicleId', '==', vehicleId), where('type', '==', 'fuel'))
                );
                const fuelExps = expensesSnap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    source: 'expenses'
                }));
                setFuelExpenses(fuelExps);
            } catch (e) {
                console.error('Error fetching fuel expenses:', e);
            }
            setLoading(false);
        };

        fetchFuelExpenses();

        return () => unsubscribe();
    }, [vehicleId]);

    // รวมข้อมูลจาก fuel_logs และ expenses
    const allFuelRecords = [
        ...fuelLogs,
        ...fuelExpenses.map(exp => {
            let date = exp.bookingData?.startDateTime;
            if (!date) date = exp.createdAt || exp.date;
            if (date && typeof date === 'string') date = new Date(date);
            return {
                id: exp.id,
                date,
                cost: exp.amount || 0,
                source: 'expenses',
                note: exp.note || '',
                mileage: exp.mileage || null
            };
        })
    ].sort((a, b) => {
        const at = a.date?.seconds ? a.date.seconds * 1000 : (a.date ? new Date(a.date).getTime() : 0);
        const bt = b.date?.seconds ? b.date.seconds * 1000 : (b.date ? new Date(b.date).getTime() : 0);
        return bt - at;
    });

    // หาเลขไมล์ล่าสุดที่เติมน้ำมัน
    useEffect(() => {
        if (allFuelRecords.length > 0) {
            // หา record ที่มี mileage มากที่สุด
            const withMileage = allFuelRecords.filter(r => r.mileage);
            if (withMileage.length > 0) {
                const maxMileage = Math.max(...withMileage.map(r => r.mileage));
                setLastMileage(maxMileage);
            } else {
                setLastMileage(null);
            }
        } else {
            setLastMileage(null);
        }
    }, [allFuelRecords]);

    // คำนวณราคารวมทั้งหมด
    const totalCost = allFuelRecords.reduce((sum, rec) => sum + (rec.cost || 0), 0);

    if (loading) return <p>Loading fuel logs...</p>;

    return (
        <div>
            {vehicle && (
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center space-x-4">
                        {vehicle.imageUrl && (
                            <Image src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} width={96} height={64} className="object-cover rounded-md shadow" unoptimized />
                        )}
                        <div>
                            <h1 className="text-3xl font-bold">ประวัติการเติมน้ำมัน</h1>
                            <p className="text-xl text-gray-600">{vehicle.brand} {vehicle.model} ({vehicle.licensePlate})</p>
                            {lastMileage && (
                                <p className="text-md text-blue-700 font-semibold mt-2">เลขไมล์ล่าสุดที่เติมน้ำมัน: {lastMileage.toLocaleString()} กม.</p>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setShowForm(true)} className="px-4 py-2 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700">
                        + เพิ่มรายการ
                    </button>
                </div>
            )}
            <div className="space-y-4">
                {allFuelRecords.length > 0 && (
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
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้เติม</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขไมล์ที่เติม</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ราคา</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">แหล่งที่มา</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {allFuelRecords.length > 0 ? (
                                allFuelRecords.map(log => <FuelRecord key={log.id} record={log} />)
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">ยังไม่มีประวัติการเติมน้ำมัน</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {showForm && <AddFuelLogForm vehicleId={vehicleId} onClose={() => {
                setShowForm(false);
                // reload fuel logs & expenses after add
                setLoading(true);
                // refetch fuel logs and expenses
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            }} />}
        </div>
    );
}
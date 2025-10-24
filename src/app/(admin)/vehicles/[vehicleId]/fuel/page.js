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

    return (
        <div className="bg-white p-4 rounded-lg shadow grid grid-cols-2 gap-4 items-center">
            <div>
                <p className="text-gray-700">{formatDateTime(record.date)}</p>
                {sourceBadge}
            </div>
            <p className="font-semibold text-right">{formatCurrency(record.cost)}</p>
        </div>
    );
}

export default function FuelPage() {
    const { vehicleId } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [fuelLogs, setFuelLogs] = useState([]);
    const [fuelExpenses, setFuelExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

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

        // ดึง expenses ที่ type='fuel' ผ่าน bookings
        const fetchFuelExpenses = async () => {
            try {
                // ดึง bookings ของรถคันนี้
                const bookingsSnap = await (await import('firebase/firestore')).getDocs(
                    query(collection(db, 'bookings'), where('vehicleId', '==', vehicleId))
                );
                const bookingsMap = {};
                bookingsSnap.docs.forEach(d => {
                    bookingsMap[d.id] = d.data();
                });
                const bookingIds = Object.keys(bookingsMap);

                if (bookingIds.length === 0) {
                    setFuelExpenses([]);
                    setLoading(false);
                    return;
                }

                // ดึง expenses ที่เป็น type='fuel' และ bookingId อยู่ใน bookingIds
                const expensesSnap = await (await import('firebase/firestore')).getDocs(
                    collection(db, 'expenses')
                );
                const fuelExps = expensesSnap.docs
                    .map(d => ({ 
                        id: d.id, 
                        ...d.data(), 
                        source: 'expenses',
                        bookingData: bookingsMap[d.data().bookingId] // เก็บข้อมูล booking ไว้ด้วย
                    }))
                    .filter(exp => exp.type === 'fuel' && bookingIds.includes(exp.bookingId));

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
            // ใช้ startDateTime จาก booking เป็นวันที่บันทึก
            let date = exp.bookingData?.startDateTime;
            // ถ้าไม่มี startDateTime ให้ใช้ createdAt หรือ date
            if (!date) date = exp.createdAt || exp.date;
            // ถ้า date เป็น string ให้แปลงเป็น Date object
            if (date && typeof date === 'string') date = new Date(date);
            return {
                id: exp.id,
                date,
                cost: exp.amount || 0,
                source: 'expenses',
                note: exp.note || ''
            };
        })
    ].sort((a, b) => {
        const at = a.date?.seconds ? a.date.seconds * 1000 : (a.date ? new Date(a.date).getTime() : 0);
        const bt = b.date?.seconds ? b.date.seconds * 1000 : (b.date ? new Date(b.date).getTime() : 0);
        return bt - at;
    });

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
                <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 gap-4 font-semibold text-gray-600">
                    <p>วันที่/เวลา</p>
                    <p className="text-right">ราคา</p>
                </div>
                {allFuelRecords.length > 0 ? (
                    <>
                        {allFuelRecords.map(log => <FuelRecord key={log.id} record={log} />)}
                    </>
                ) : (
                    <p className="text-center py-8 text-gray-500">ยังไม่มีประวัติการเติมน้ำมัน</p>
                )}
            </div>
            {showForm && <AddFuelLogForm vehicleId={vehicleId} onClose={() => setShowForm(false)} />}
        </div>
    );
}
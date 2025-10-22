"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import AddFuelLogForm from '@/components/admin/AddFuelLogForm';
import Image from 'next/image';

function FuelRecord({ record }) {
    const formatDate = (timestamp) => new Date(timestamp.seconds * 1000).toLocaleDateString('th-TH');
    const formatCurrency = (number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(number);
    const efficiency = record.previousMileage ? ((record.mileage - record.previousMileage) / record.liters).toFixed(2) : 'N/A';

    return (
        <div className="bg-white p-4 rounded-lg shadow grid grid-cols-6 gap-4 items-center">
            <p className="text-gray-700">{formatDate(record.date)}</p>
            <p className="text-gray-700">{record.mileage.toLocaleString('th-TH')} กม.</p>
            <p className="text-gray-700">{record.liters} ลิตร</p>
            <p className="font-semibold text-right">{formatCurrency(record.cost)}</p>
            <p className="text-gray-700 text-right">{formatCurrency(record.cost / record.liters)}</p>
            <p className="text-blue-600 font-bold text-right">{efficiency} กม./ลิตร</p>
        </div>
    );
}

export default function FuelPage() {
    const { vehicleId } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [fuelLogs, setFuelLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        if (!vehicleId) return;
        const vehicleRef = doc(db, "vehicles", vehicleId);
        getDoc(vehicleRef).then(docSnap => {
            if (docSnap.exists()) setVehicle({ id: docSnap.id, ...docSnap.data() });
        });

        const q = query(
            collection(db, "fuel_logs"),
            where("vehicleId", "==", vehicleId),
            orderBy("date", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFuelLogs(logsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [vehicleId]);

    if (loading) return <p>Loading fuel logs...</p>;

    return (
        <div>
            <Link href="/vehicles" className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block">
                &larr; กลับไปหน้ารายการรถทั้งหมด
            </Link>
            
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
                <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-6 gap-4 font-semibold text-gray-600">
                    <p>วันที่</p>
                    <p>เลขไมล์</p>
                    <p>จำนวน (ลิตร)</p>
                    <p className="text-right">ราคารวม</p>
                    <p className="text-right">ราคา/ลิตร</p>
                    <p className="text-right">อัตราสิ้นเปลือง</p>
                </div>
                {fuelLogs.length > 0 ? (
                    fuelLogs.map(log => <FuelRecord key={log.id} record={log} />)
                ) : (
                    <p className="text-center py-8 text-gray-500">ยังไม่มีประวัติการเติมน้ำมัน</p>
                )}
            </div>

            {showForm && <AddFuelLogForm vehicleId={vehicleId} currentMileage={vehicle?.currentMileage} onClose={() => setShowForm(false)} />}
        </div>
    );
}
"use client";

import { useState, useEffect } from 'react';
// 1. Import useParams from next/navigation
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import AddMaintenanceForm from '@/components/admin/AddMaintenanceForm';

// Component for a single maintenance record
function MaintenanceRecord({ record }) {
    const formatDate = (timestamp) => new Date(timestamp.seconds * 1000).toLocaleDateString('th-TH');
    const formatCurrency = (number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(number);

    return (
        <div className="bg-white p-4 rounded-lg shadow grid grid-cols-5 gap-4 items-center">
            <p className="text-gray-700">{formatDate(record.date)}</p>
            <p className="text-gray-700">{record.mileage.toLocaleString('th-TH')} กม.</p>
            <p className="text-gray-700 col-span-2">{record.details}</p>
            <p className="font-semibold text-right">{formatCurrency(record.cost)}</p>
        </div>
    );
}

// 2. Remove the { params } prop from the function signature
export default function MaintenancePage() {
    // 3. Get vehicleId using the useParams hook
    const { vehicleId } = useParams(); 
    
    const [vehicle, setVehicle] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Fetch this vehicle's data
    useEffect(() => {
        if (!vehicleId) return;
        const docRef = doc(db, "vehicles", vehicleId);
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                setVehicle({ id: docSnap.id, ...docSnap.data() });
            }
        });
    }, [vehicleId]);

    // Fetch the maintenance history for this vehicle
    useEffect(() => {
        if (!vehicleId) return;
        const q = query(
            collection(db, "maintenances"),
            where("vehicleId", "==", vehicleId),
            orderBy("date", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRecords(recordsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [vehicleId]);

    if (loading) {
        return <p>Loading maintenance history...</p>;
    }

    return (
        <div>
            <Link href="/vehicles" className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block">
                &larr; กลับไปหน้ารายการรถทั้งหมด
            </Link>
            
            {vehicle && (
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">ประวัติการซ่อมบำรุง</h1>
                        <p className="text-xl text-gray-600">{vehicle.brand} {vehicle.model} ({vehicle.licensePlate})</p>
                    </div>
                    <button onClick={() => setShowForm(true)} className="px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        + เพิ่มรายการซ่อม
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {/* Header */}
                <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-5 gap-4 font-semibold text-gray-600">
                    <p>วันที่</p>
                    <p>เลขไมล์</p>
                    <p className="col-span-2">รายละเอียดการซ่อม</p>
                    <p className="text-right">ค่าใช้จ่าย</p>
                </div>
                {records.length > 0 ? (
                    records.map(record => <MaintenanceRecord key={record.id} record={record} />)
                ) : (
                    <p className="text-center py-8 text-gray-500">ยังไม่มีประวัติการซ่อมบำรุง</p>
                )}
            </div>

            {showForm && <AddMaintenanceForm vehicleId={vehicleId} onClose={() => setShowForm(false)} />}
        </div>
    );
}
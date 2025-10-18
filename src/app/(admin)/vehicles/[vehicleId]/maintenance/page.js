"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import AddMaintenanceForm from '@/components/admin/AddMaintenanceForm';
import { useCallback } from 'react';

function MaintenanceRecord({ record }) {
    const formatDate = (value) => {
        if (!value) return '-';
        if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString('th-TH');
        if (value.toDate) return value.toDate().toLocaleDateString('th-TH');
        return new Date(value).toLocaleDateString('th-TH');
    };
    const formatCurrency = (number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(number ?? 0);

    // compute display fields with fallbacks
    const displayDate = record.date ? formatDate(record.date) : (record.createdAt ? formatDate(record.createdAt) : '-');
    const displayMileage = record.finalMileage ?? record.odometerAtDropOff ?? record.mileage ?? null;
    const displayCost = record.finalCost ?? record.cost ?? 0;
    const typeLabel = record.type === 'garage' ? 'ซ่อมอู่' : 'แจ้งค่าซ่อม';
    const status = record.maintenanceStatus || (record.type === 'cost-only' ? 'recorded' : '-');

    const statusBadge = (st) => {
        const map = {
            pending: 'bg-yellow-100 text-yellow-800',
            in_progress: 'bg-yellow-600 text-white',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
            recorded: 'bg-gray-100 text-gray-800',
        };
        return map[st] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow grid grid-cols-8 gap-4 items-center">
            <p className="text-gray-700">{displayDate}</p>
            <p className="text-gray-700">{displayMileage !== null ? displayMileage.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' กม.' : '-'}</p>
            <p className="text-gray-700">{typeLabel}</p>
            <p className="text-gray-700">{record.vendor ?? '-'}</p>
            <p className="text-gray-700 col-span-2">{record.details}</p>
            <p className="font-semibold text-right">{formatCurrency(displayCost)}</p>
            <div className="flex justify-end">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(status)}`}>{status}</span>
            </div>
        </div>
    );
}

export default function MaintenancePage() {
    const { vehicleId } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [receiveData, setReceiveData] = useState({ finalCost: '', finalMileage: '', notes: '' });

    useEffect(() => {
        if (!vehicleId) return;
        const docRef = doc(db, "vehicles", vehicleId);
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                setVehicle({ id: docSnap.id, ...docSnap.data() });
            }
        });
    }, [vehicleId]);

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

    // No receive modal on vehicle page — this page only records cost-only maintenance entries.
    const openReceiveModal = (rec) => {
        // intentionally left blank
    };

    const handleReceiveSubmit = useCallback(async () => {
        if (!currentRecord) return;
        try {
            // update maintenance with final details
            await updateDoc(doc(db, 'maintenances', currentRecord.id), {
                maintenanceStatus: 'completed',
                finalCost: Number(receiveData.finalCost),
                finalMileage: Number(receiveData.finalMileage),
                completionNotes: receiveData.notes || '',
                receivedAt: serverTimestamp(),
            });

            // update vehicle
            const vehicleRef = doc(db, 'vehicles', vehicleId);
            const updateData = { status: 'available' };
            if (receiveData.finalMileage) updateData.currentMileage = Number(receiveData.finalMileage);
            await updateDoc(vehicleRef, updateData);

            setShowReceiveModal(false);
            setCurrentRecord(null);
        } catch (err) {
            console.error('Error completing receive flow:', err);
        }
    }, [currentRecord, receiveData, vehicleId]);

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
                    <div className="flex items-center space-x-4">
                        {vehicle.imageUrl && (
                            <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} className="w-24 h-16 object-cover rounded-md shadow" />
                        )}
                        <div>
                            <h1 className="text-3xl font-bold">ประวัติการซ่อมบำรุง</h1>
                                        <p className="text-xl text-gray-600">{vehicle.brand} {vehicle.model} ({vehicle.licensePlate})</p>
                                        <div className="mt-2 text-sm text-gray-500 flex gap-4">
                                            <div>วันที่ปัจจุบัน: <span className="font-medium">{new Date().toLocaleDateString('th-TH')}</span></div>
                                            <div>ไมล์ล่าสุด: <span className="font-medium">{(vehicle.currentMileage ?? (records && records[0]?.mileage) ?? '-').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} กม.</span></div>
                                        </div>
                        </div>
                    </div>
                    <button onClick={() => setShowForm(true)} className="px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        + เพิ่มรายการซ่อม
                    </button>
                </div>
            )}

            <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-8 gap-4 font-semibold text-gray-600">
                    <p>วันที่</p>
                    <p>เลขไมล์</p>
                    <p>ประเภท</p>
                    <p>อู่</p>
                    <p className="col-span-2">รายละเอียดการซ่อม</p>
                    <p className="text-right">ค่าใช้จ่าย</p>
                    <p className="text-right">สถานะ</p>
                </div>
                {records.length > 0 ? (
                    records.map(record => <MaintenanceRecord key={record.id} record={record} vehicleId={vehicleId} openReceiveModal={openReceiveModal} />)
                ) : (
                    <p className="text-center py-8 text-gray-500">ยังไม่มีประวัติการซ่อมบำรุง</p>
                )}
            </div>

            {showForm && <AddMaintenanceForm vehicleId={vehicleId} onClose={() => setShowForm(false)} onlyCost={true} />}
        </div>
    );
}
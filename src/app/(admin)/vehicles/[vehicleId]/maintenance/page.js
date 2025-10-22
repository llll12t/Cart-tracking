"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import AddMaintenanceForm from '@/components/admin/AddMaintenanceForm';
import { useCallback } from 'react';
import Image from 'next/image';

function MaintenanceRecord({ record }) {
    const formatDateTime = (value) => {
        if (!value) return '-';
        let dateObj;
        if (value.seconds) {
            dateObj = new Date(value.seconds * 1000);
        } else if (value.toDate) {
            dateObj = value.toDate();
        } else {
            dateObj = new Date(value);
        }
        return dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) +
            ' ' + dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };
    const formatCurrency = (number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(number ?? 0);

    // compute display fields with fallbacks
    const displayDate = record.date ? formatDateTime(record.date) : (record.createdAt ? formatDateTime(record.createdAt) : '-');
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

    // สถานะภาษาไทย
    const statusLabel = (st) => {
        switch (st) {
            case 'pending': return 'รอดำเนินการ';
            case 'in_progress': return 'กำลังซ่อม';
            case 'completed': return 'เสร็จสิ้น';
            case 'cancelled': return 'ยกเลิก';
            case 'recorded': return 'บันทึกแล้ว';
            default: return '-';
        }
    };

    // แสดง badge แหล่งที่มา
    const sourceBadge = record.source === 'expenses' ? (
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded ml-2">จากทริป</span>
    ) : null;

    return (
        <div className="bg-white p-4 rounded-lg shadow grid grid-cols-7 gap-4 items-center">
            <div>
                <p className="text-gray-700">{displayDate}</p>
                {sourceBadge}
            </div>
            <p className="text-gray-700">{typeLabel}</p>
            <p className="text-gray-700">{record.vendor ?? '-'}</p>
            <p className="text-gray-700 col-span-2">{record.details}</p>
            <p className="font-semibold text-right">{formatCurrency(displayCost)}</p>
            <div className="flex justify-end">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(status)}`}>{statusLabel(status)}</span>
            </div>
        </div>
    );
}

export default function MaintenancePage() {
    const { vehicleId } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [records, setRecords] = useState([]);
    const [maintenanceExpenses, setMaintenanceExpenses] = useState([]);
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
        
        // ดึง maintenances
        const q = query(
            collection(db, "maintenances"),
            where("vehicleId", "==", vehicleId),
            orderBy("date", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'maintenances' }));
            setRecords(recordsData);
        });

        // ดึง expenses ที่เป็นค่าซ่อมบำรุง (maintenance, toll, parking, other) ผ่าน bookings
        const fetchMaintenanceExpenses = async () => {
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
                    setMaintenanceExpenses([]);
                    setLoading(false);
                    return;
                }

                // ดึง expenses ที่ไม่ใช่ fuel
                const expensesSnap = await (await import('firebase/firestore')).getDocs(
                    collection(db, 'expenses')
                );
                const maintExps = expensesSnap.docs
                    .map(d => ({ 
                        id: d.id, 
                        ...d.data(), 
                        source: 'expenses',
                        bookingData: bookingsMap[d.data().bookingId] // เก็บข้อมูล booking ไว้ด้วย
                    }))
                    .filter(exp => ['maintenance', 'toll', 'parking', 'other'].includes(exp.type) && bookingIds.includes(exp.bookingId));

                setMaintenanceExpenses(maintExps);
            } catch (e) {
                console.error('Error fetching maintenance expenses:', e);
            }
            setLoading(false);
        };

        fetchMaintenanceExpenses();

        return () => unsubscribe();
    }, [vehicleId]);

    // รวมข้อมูลจาก maintenances และ expenses
    const allRecords = [
        ...records,
        ...maintenanceExpenses.map(exp => {
            const typeMap = {
                'maintenance': 'ค่าซ่อมบำรุง',
                'toll': 'ค่าทางด่วน',
                'parking': 'ค่าจอดรถ',
                'other': 'อื่นๆ'
            };
            // ใช้ startDateTime จาก booking เป็นวันที่บันทึก
            let date = exp.bookingData?.startDateTime;
            // ถ้าไม่มี startDateTime ให้ใช้ createdAt หรือ date
            if (!date) date = exp.createdAt || exp.date;
            // ถ้า date เป็น string ให้แปลงเป็น Date object
            if (date && typeof date === 'string') date = new Date(date);
            return {
                id: exp.id,
                date,
                finalMileage: exp.mileage || null,
                type: 'cost-only',
                vendor: typeMap[exp.type] || exp.type,
                details: exp.note || '-',
                finalCost: exp.amount || 0,
                maintenanceStatus: 'recorded',
                source: 'expenses'
            };
        })
    ].sort((a, b) => {
        const at = a.date?.seconds ? a.date.seconds * 1000 : (a.date ? new Date(a.date).getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0));
        const bt = b.date?.seconds ? b.date.seconds * 1000 : (b.date ? new Date(b.date).getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0));
        return bt - at;
    });

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
            {vehicle && (
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center space-x-4">
                        {vehicle.imageUrl && (
                            <Image src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} width={96} height={64} className="object-cover rounded-md shadow" unoptimized />
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
                <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-7 gap-4 font-semibold text-gray-600">
                    <p>วันที่/เวลา</p>
                    <p>หมวดค่าใช้จ่าย</p>
                    <p>ชื่ออู่/ผู้ให้บริการ</p>
                    <p className="col-span-2">รายละเอียด</p>
                    <p className="text-right">จำนวนเงิน (บาท)</p>
                    <p className="text-right">สถานะรายการ</p>
                </div>
                {allRecords.length > 0 ? (
                    allRecords.map(record => <MaintenanceRecord key={record.id} record={record} vehicleId={vehicleId} openReceiveModal={openReceiveModal} />)
                ) : (
                    <p className="text-center py-8 text-gray-500">ยังไม่มีประวัติการซ่อมบำรุง</p>
                )}
            </div>

            {showForm && <AddMaintenanceForm vehicleId={vehicleId} onClose={() => setShowForm(false)} onlyCost={true} />}
        </div>
    );
}
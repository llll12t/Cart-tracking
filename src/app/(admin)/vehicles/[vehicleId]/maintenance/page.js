"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import AddMaintenanceForm from '@/components/admin/AddMaintenanceForm';
import { useCallback } from 'react';
import Image from 'next/image';

function MaintenanceRecord({ record, onSelect, isSelected }) {
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
    let sourceBadge = null;
    if (record.source === 'admin' || record.source === 'maintenances') {
        sourceBadge = <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">บันทึกจากพนักงาน</span>;
    } else if (record.source === 'expenses') {
        sourceBadge = <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">จากทริป</span>;
    }

    return (
        <tr className="hover:bg-gray-50">
            <td className="px-4 py-3 text-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(record.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
            </td>
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{displayDate}</td>
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{typeLabel}</td>
            <td className="px-4 py-3 text-sm text-gray-900">{record.vendor ?? '-'}</td>
            <td className="px-4 py-3 text-sm text-gray-900">{record.details}</td>
            <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{formatCurrency(displayCost)}</td>
            <td className="px-4 py-3 text-sm text-gray-900">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(status)}`}>{statusLabel(status)}</span>
                    {sourceBadge}
                </div>
            </td>
        </tr>
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [itemToDelete, setItemToDelete] = useState(null);

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
        // subscribe maintenances
        const q = query(
            collection(db, "maintenances"),
            where("vehicleId", "==", vehicleId),
            orderBy("date", "desc")
        );
        const unsubscribeMaint = onSnapshot(q, (snapshot) => {
            const recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'maintenances' }));
            setRecords(recordsData);
        });

        // subscribe expenses (type=other)
        const expQ = query(
            collection(db, 'expenses'),
            where('vehicleId', '==', vehicleId),
            where('type', '==', 'other')
        );
        const unsubscribeExp = onSnapshot(expQ, (snapshot) => {
            const maintExps = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                source: 'expenses'
            }));
            setMaintenanceExpenses(maintExps);
            setLoading(false);
        });

        return () => {
            unsubscribeMaint();
            unsubscribeExp();
        };
    }, [vehicleId]);

    // รวมข้อมูลจาก maintenances และ expenses
    const allRecords = [
        ...records,
        ...maintenanceExpenses.map(exp => {
            // ใช้ timestamp หรือ createdAt เป็นวันที่บันทึก
            let date = exp.timestamp || exp.createdAt;
            if (date && typeof date === 'string') date = new Date(date);
            // กำหนด source ให้ถูกต้อง
            let source = exp.source;
            if (exp.source === 'admin' || exp.userId) {
                source = 'admin';
            } else if (!exp.source) {
                source = 'expenses';
            }
            return {
                id: exp.id,
                date,
                finalMileage: exp.mileage || null,
                type: 'cost-only',
                vendor: 'ค่าใช้จ่ายอื่นๆ',
                details: exp.note || '-',
                finalCost: exp.amount || 0,
                maintenanceStatus: 'recorded',
                source
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

    // คำนวณราคารวมทั้งหมด
    const totalCost = allRecords.reduce((sum, rec) => sum + (rec.finalCost ?? rec.cost ?? 0), 0);

    if (loading) {
        return <p>Loading maintenance history...</p>;
    }

    // ลบรายการที่เลือก
    const handleDeleteSelected = async () => {
        setIsClearing(true);
        setShowDeleteConfirm(false);
        try {
            const { deleteDoc, doc: docRef } = await import('firebase/firestore');
            const idsToDelete = itemToDelete ? [itemToDelete] : selectedItems;
            const deletePromises = idsToDelete.map(id => {
                const found = allRecords.find(r => r.id === id);
                if (found && found.source === 'expenses') {
                    return deleteDoc(docRef(db, 'expenses', id));
                } else if (found && found.source === 'maintenances') {
                    return deleteDoc(docRef(db, 'maintenances', id));
                }
                return Promise.resolve();
            });
            await Promise.all(deletePromises);
            // Remove deleted records from state immediately for real-time feedback
            setRecords(prev => prev.filter(r => !idsToDelete.includes(r.id)));
            setMaintenanceExpenses(prev => prev.filter(r => !idsToDelete.includes(r.id)));
            setSelectedItems([]);
            setItemToDelete(null);
        } catch (e) {
            alert('เกิดข้อผิดพลาดในการลบประวัติ');
        }
        setIsClearing(false);
    };

    const handleSelectAll = () => {
        const ids = allRecords.map(r => r.id);
        if (selectedItems.length === ids.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(ids);
        }
    };

    const handleSelectItem = (id) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

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
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {selectedItems.length > 0 && (
                            <button 
                                onClick={() => { setItemToDelete(null); setShowDeleteConfirm(true); }} 
                                className="px-6 py-3 font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-md transition-all hover:shadow-lg"
                            >
                                🗑️ ลบที่เลือก ({selectedItems.length})
                            </button>
                        )}
                        <button onClick={() => setShowForm(true)} className="px-6 py-3 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-md transition-all hover:shadow-lg">
                            + บันทึกค่าใช้จ่าย
                        </button>
                    </div>
                </div>
            )}
            {/* Modal ยืนยันการลบ */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4 text-red-700">ยืนยันการลบ</h2>
                        <p className="mb-6">
                            {itemToDelete 
                                ? 'คุณแน่ใจหรือไม่ที่จะลบรายการนี้?' 
                                : `คุณแน่ใจหรือไม่ที่จะลบ ${selectedItems.length} รายการที่เลือก?`}
                            <br />
                            <span className="text-red-500 font-semibold">การลบนี้ไม่สามารถย้อนกลับได้</span>
                        </p>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => { setShowDeleteConfirm(false); setItemToDelete(null); }} disabled={isClearing} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
                            <button onClick={handleDeleteSelected} disabled={isClearing} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">{isClearing ? 'กำลังลบ...' : 'ยืนยันลบ'}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {allRecords.length > 0 && (
                    <div className="bg-gray-100 p-4 rounded-lg grid grid-cols-2 gap-4 font-bold text-gray-800">
                        <p>ราคารวมทั้งหมด</p>
                        <p className="text-right">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(totalCost)}</p>
                    </div>
                )}
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.length === allRecords.length && allRecords.length > 0}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่/เวลา</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">หมวดค่าใช้จ่าย</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่ออู่/ผู้ให้บริการ</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">จำนวนเงิน</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {allRecords.length > 0 ? (
                                allRecords.map(record => <MaintenanceRecord key={record.id} record={record} onSelect={handleSelectItem} isSelected={selectedItems.includes(record.id)} />)
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">ยังไม่มีประวัติการซ่อมบำรุง</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showForm && <AddMaintenanceForm vehicleId={vehicleId} onClose={() => setShowForm(false)} onlyCost={true} />}
        </div>
    );
}
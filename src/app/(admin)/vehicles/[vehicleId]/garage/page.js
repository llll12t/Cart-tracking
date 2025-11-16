"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import Image from 'next/image';

function GarageRecord({ record, selected, onSelect, onDelete }) {
  const formatDateTime = (value) => {
    if (!value) return '-';
    let dateObj;
    if (value.seconds) {
      dateObj = new Date(value.seconds * 1000);
    } else {
      dateObj = new Date(value);
    }
    return dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' ' + dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatCurrency = (number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(number || 0);
  
  const translateStatus = (s) => {
    if (!s) return '-';
    switch (s) {
      case 'pending': return 'รอดำเนินการ';
      case 'in_progress': return 'กำลังซ่อม';
      case 'completed': return 'เสร็จสิ้น';
      case 'cancelled': return 'ยกเลิก';
      case 'recorded': return 'บันทึกแล้ว';
      default: return s;
    }
  };

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

  // แสดง badge แหล่งที่มา
  const sourceBadge = record.source === 'expenses' ? (
    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">จากทริป</span>
  ) : null;

  const displayCost = record.finalCost ?? record.cost ?? 0;
  const displayMileage = record.odometerAtDropOff ?? record.mileage ?? null;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-2 py-3 text-center">
        {record.source === 'maintenances' && (
          <input type="checkbox" checked={!!selected} onChange={e => onSelect(record.id, e.target.checked)} />
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDateTime(record.createdAt)}</td>
      <td className="px-4 py-3 text-sm text-gray-900">{record.vendor ?? '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-900">{record.details ?? '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{displayMileage ? displayMileage.toLocaleString() + ' กม.' : '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{formatCurrency(displayCost)}</td>
      <td className="px-4 py-3 text-sm text-gray-900">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(record.maintenanceStatus)}`}>
            {translateStatus(record.maintenanceStatus)}
          </span>
          {sourceBadge}
          {record.source === 'maintenances' && (
            <button onClick={() => onDelete(record.id)} className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">ลบ</button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function VehicleGaragePage() {
    const [selectedIds, setSelectedIds] = useState([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetIds, setDeleteTargetIds] = useState([]);
    const [deleting, setDeleting] = useState(false);
    // เลือก/ยกเลิกเลือกแต่ละรายการ
    const handleSelect = (id, checked) => {
      setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
    };

    // ลบทีละรายการ (ปุ่มลบในแถว)
    const handleDeleteSingle = (id) => {
      setDeleteTargetIds([id]);
      setShowDeleteModal(true);
    };

    // ลบหลายรายการ (ปุ่มลบที่หัวตาราง)
    const handleDeleteMultiple = () => {
      if (selectedIds.length === 0) return;
      setDeleteTargetIds(selectedIds);
      setShowDeleteModal(true);
    };

    // ดำเนินการลบจริง
    const confirmDelete = async () => {
      setDeleting(true);
      try {
        for (const id of deleteTargetIds) {
          await deleteDoc(doc(db, 'maintenances', id));
        }
        setSelectedIds([]);
        setDeleteTargetIds([]);
        setShowDeleteModal(false);
      } catch (e) {
        alert('เกิดข้อผิดพลาดในการลบ');
      }
      setDeleting(false);
    };
  const params = useParams();
  const vehicleId = params?.vehicleId;
  const [vehicle, setVehicle] = useState(null);
  const [items, setItems] = useState([]);
  const [garageExpenses, setGarageExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) return;
    const vRef = doc(db, 'vehicles', vehicleId);
    getDoc(vRef).then(snap => { if (snap.exists()) setVehicle({ id: snap.id, ...snap.data() }); });

    const q = query(collection(db, 'maintenances'), where('type', '==', 'garage'), where('vehicleId', '==', vehicleId));
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data(), source: 'maintenances' }));
      arr.sort((a,b)=>{
        const at = a.createdAt?.seconds ? a.createdAt.seconds*1000 : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt?.seconds ? b.createdAt.seconds*1000 : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });
      setItems(arr);
    });

    // ดึง expenses ที่อาจเป็นค่าซ่อมอู่ (ถ้ามีการบันทึกในทริป)
    const fetchGarageExpenses = async () => {
      try {
        const bookingsSnap = await (await import('firebase/firestore')).getDocs(
          query(collection(db, 'bookings'), where('vehicleId', '==', vehicleId))
        );
        const bookingsMap = {};
        bookingsSnap.docs.forEach(d => {
          bookingsMap[d.id] = d.data();
        });
        const bookingIds = Object.keys(bookingsMap);

        if (bookingIds.length === 0) {
          setGarageExpenses([]);
          setLoading(false);
          return;
        }

        // ถ้ามี expenses ที่ note หรือ vendor ระบุว่าเป็นค่าซ่อมอู่
        const expensesSnap = await (await import('firebase/firestore')).getDocs(
          collection(db, 'expenses')
        );
        const garageExps = expensesSnap.docs
          .map(d => ({ 
            id: d.id, 
            ...d.data(), 
            source: 'expenses',
            bookingData: bookingsMap[d.data().bookingId] // เก็บข้อมูล booking ไว้ด้วย
          }))
          .filter(exp => {
            if (!bookingIds.includes(exp.bookingId)) return false;
            const note = (exp.note || '').toLowerCase();
            const vendor = (exp.vendor || '').toLowerCase();
            // ตรวจสอบว่ามีคำว่า "อู่" หรือ "ซ่อม" หรือ "garage" หรือ "repair"
            return note.includes('อู่') || note.includes('ซ่อม') || note.includes('garage') || note.includes('repair') ||
                   vendor.includes('อู่') || vendor.includes('garage');
          });

        setGarageExpenses(garageExps);
      } catch (e) {
        console.error('Error fetching garage expenses:', e);
      }
      setLoading(false);
    };

    fetchGarageExpenses();

    return () => unsub();
  }, [vehicleId]);

  // รวมข้อมูลจาก maintenances และ expenses
  const allItems = [
    ...items,
    ...garageExpenses.map(exp => {
      // ใช้ startDateTime จาก booking เป็นวันที่บันทึก
      let createdAt = exp.bookingData?.startDateTime;
      // ถ้าไม่มี startDateTime ให้ใช้ createdAt หรือ date
      if (!createdAt) createdAt = exp.createdAt || exp.date;
      // ถ้า createdAt เป็น string ให้แปลงเป็น Date object
      if (createdAt && typeof createdAt === 'string') createdAt = new Date(createdAt);
      return {
        id: exp.id,
        vendor: exp.vendor || 'ไม่ระบุ',
        details: exp.note || '-',
        odometerAtDropOff: exp.mileage || null,
        finalMileage: null,
        maintenanceStatus: 'recorded',
        createdAt,
        cost: exp.amount || 0,
        finalCost: exp.amount || 0,
        source: 'expenses'
      };
    })
  ].sort((a, b) => {
    const at = a.createdAt?.seconds ? a.createdAt.seconds*1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const bt = b.createdAt?.seconds ? b.createdAt.seconds*1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return bt - at;
  });

  if (!vehicleId) return <p className="p-6">ไม่พบรหัสรถ</p>;
  if (loading) return <p>Loading garage logs...</p>;
  
  // compute total maintenance cost for this vehicle (use finalCost when present, fallback to cost)
  const totalCost = allItems.reduce((sum, it) => {
    const c = Number(it.finalCost ?? it.cost ?? 0) || 0;
    return sum + c;
  }, 0);

  return (
    <div>
      {vehicle && (
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            {vehicle.imageUrl && (
              <Image src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} width={96} height={64} className="object-cover rounded-md shadow" unoptimized />
            )}
            <div>
              <h1 className="text-3xl font-bold">บันทึกส่งซ่อมของรถ</h1>
              <p className="text-xl text-gray-600">{vehicle.brand} {vehicle.model} ({vehicle.licensePlate})</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {allItems.length > 0 && (
          <div className="bg-gray-100 p-4 rounded-lg grid grid-cols-2 gap-4 font-bold text-gray-800">
            <p>ราคารวมทั้งหมด</p>
            <p className="text-right">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(totalCost)}</p>
          </div>
        )}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="flex items-center justify-between px-4 pt-4">
            <div />
            <button
              className="px-3 py-1 bg-red-600 text-white rounded text-sm disabled:opacity-50"
              disabled={selectedIds.length === 0}
              onClick={handleDeleteMultiple}
            >
              ลบที่เลือก ({selectedIds.length})
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-200 mt-2">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่/เวลา</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">อู่/ผู้ให้บริการ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขไมล์</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ค่าใช้จ่าย</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allItems.length > 0 ? (
                allItems.map(rec => (
                  <GarageRecord
                    key={rec.id}
                    record={rec}
                    selected={selectedIds.includes(rec.id)}
                    onSelect={handleSelect}
                    onDelete={handleDeleteSingle}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">ยังไม่มีบันทึกการส่งซ่อมสำหรับคันนี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ยืนยันการลบ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded shadow">
            <h3 className="text-lg font-semibold mb-3">ยืนยันการลบ</h3>
            <p className="mb-4">คุณต้องการลบ {deleteTargetIds.length} รายการหรือไม่?</p>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-200 rounded">ยกเลิก</button>
              <button onClick={confirmDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded">{deleting ? 'กำลังลบ...' : 'ลบ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

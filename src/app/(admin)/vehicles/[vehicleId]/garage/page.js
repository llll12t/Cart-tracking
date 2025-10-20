"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function VehicleGaragePage() {
  const params = useParams();
  const vehicleId = params?.vehicleId;
  const [vehicle, setVehicle] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) return;
    const vRef = doc(db, 'vehicles', vehicleId);
    getDoc(vRef).then(snap => { if (snap.exists()) setVehicle({ id: snap.id, ...snap.data() }); });

    const q = query(collection(db, 'maintenances'), where('type', '==', 'garage'), where('vehicleId', '==', vehicleId));
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a,b)=>{
        const at = a.createdAt?.seconds ? a.createdAt.seconds*1000 : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt?.seconds ? b.createdAt.seconds*1000 : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });
      setItems(arr);
      setLoading(false);
    });

    return () => unsub();
  }, [vehicleId]);

  if (!vehicleId) return <p className="p-6">ไม่พบรหัสรถ</p>;
  if (loading) return <p className="p-6">กำลังโหลดบันทึกส่งซ่อม...</p>;
  // compute total maintenance cost for this vehicle (use finalCost when present, fallback to cost)
  const totalCost = items.reduce((sum, it) => {
    const c = Number(it.finalCost ?? it.cost ?? 0) || 0;
    return sum + c;
  }, 0);

  const translateStatus = (s) => {
    if (!s) return '-';
    switch (s) {
      case 'pending': return 'รอดำเนินการ';
      case 'in_progress': return 'กำลังซ่อม';
      case 'completed': return 'เสร็จสิ้น';
      case 'cancelled': return 'ยกเลิก';
      default: return s;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">บันทึกส่งซ่อมของรถ</h1>
        {vehicle && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
              {(vehicle.imageUrl || vehicle.photoURL || vehicle.image) ? (
                <img
                  src={vehicle.imageUrl || vehicle.photoURL || vehicle.image}
                  alt={`${vehicle.brand || ''} ${vehicle.model || ''}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🚗</div>
              )}
            </div>
            <div className="leading-tight">
              <div className="font-semibold">{vehicle.brand} {vehicle.model}</div>
              <div className="text-xs">{vehicle.licensePlate}</div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Link href={`/maintenance`} className="text-sm text-indigo-600 underline">กลับไปที่บันทึกค่าใช้จ่าย</Link>
        <div className="text-sm">รวมค่าใช้จ่ายทั้งหมด: <span className="font-semibold">{totalCost.toLocaleString('th-TH')} บาท</span></div>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500">ยังไม่มีบันทึกการส่งซ่อมสำหรับคันนี้</p>
      ) : (
        <div className="space-y-4">
          {items.map(rec => (
            <div key={rec.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">อู่: {rec.vendor ?? '-'}</div>
                  <div className="text-sm text-gray-600">รายละเอียด: {rec.details ?? '-'}</div>
                  <div className="mt-2 text-sm">ไมล์เมื่อส่ง: {rec.odometerAtDropOff ?? rec.mileage ?? '-'}</div>
                  <div className="mt-2 text-sm">ไมล์ตอนรับ (ถ้ามี): {rec.finalMileage ?? '-'}</div>
                </div>
                <div className="text-right text-sm text-gray-600">
                  <div className="mb-2">สถานะ: {translateStatus(rec.maintenanceStatus)}</div>
                  <div className="mb-2">บันทึกเมื่อ: {rec.createdAt ? (rec.createdAt.seconds ? new Date(rec.createdAt.seconds*1000).toLocaleString('th-TH') : new Date(rec.createdAt).toLocaleString('th-TH')) : '-'}</div>
                  <div className="mb-1">ค่าใช้จ่าย (ประเมิน/จริง): {rec.cost ? `${Number(rec.cost).toLocaleString('th-TH')} บาท` : '-'} / {rec.finalCost ? `${Number(rec.finalCost).toLocaleString('th-TH')} บาท` : '-'}</div>
                  <div className="mb-1">รายการอะไหล่: {rec.partsUsed ?? '-'}</div>
                  {rec.invoiceNumber && (
                    <div className="mb-1">เลขที่ใบแจ้งหนี้: {rec.invoiceNumber}</div>
                  )}
                  <div className="mb-1">มีประกัน: {rec.warranty ? 'ใช่' : 'ไม่'}</div>
                  {rec.warranty && rec.warrantyDate && (
                    <div className="mb-1">วันที่รับประกัน: {rec.warrantyDate.seconds ? new Date(rec.warrantyDate.seconds*1000).toLocaleDateString('th-TH') : new Date(rec.warrantyDate).toLocaleDateString('th-TH')}</div>
                  )}
                  {rec.receivedAt && <div className="text-xs text-gray-500">รับคืน: {rec.receivedAt.seconds ? new Date(rec.receivedAt.seconds*1000).toLocaleString('th-TH') : new Date(rec.receivedAt).toLocaleString('th-TH')}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, collectionGroup } from 'firebase/firestore';
import Image from 'next/image';
import { getImageUrl } from '@/lib/imageHelpers';

function formatDateTime(ts) {
  if (!ts) return '-';
  try {
    let d;
    // Firestore timestamp
    if (ts.seconds && typeof ts.seconds === 'number') d = new Date(ts.seconds * 1000);
    // calendar-only string YYYY-MM-DD -> local midnight
    else if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ts)) {
      const parts = ts.split('-');
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0);
    } else d = new Date(ts);
    return d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
}

export default function TripHistoryPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    // load completed bookings ordered by endDateTime (prefer timestamp) desc, fallback to endDate
    // Firestore doesn't allow conditional orderBy, so order by endDateTime if present; projects without endDateTime will be last
    const q = query(collection(db, 'bookings'), where('status', '==', 'completed'), orderBy('endDateTime', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const list = [];
      for (const docSnap of snap.docs) {
        const data = { id: docSnap.id, ...docSnap.data() };
            // attach vehicle info
        try {
          if (data.vehicleId) {
            const vRef = doc(db, 'vehicles', data.vehicleId);
            const vSnap = await getDoc(vRef);
            if (vSnap.exists()) data.vehicle = { id: vSnap.id, ...vSnap.data() };
          }
        } catch (e) {
          console.warn('vehicle fetch failed', e);
        }

        // fetch expenses related to this booking
        try {
          // expenses are in collection 'expenses' with bookingId field
          const expQ = query(collection(db, 'expenses'), where('bookingId', '==', data.id));
          // We can't await onSnapshot here easily in a loop; instead leave expenses empty and rely on client-side fetch below if needed
          data.expenses = [];
        } catch (e) {
          data.expenses = [];
        }

        // normalize start/end display values for UI
        data._startDisplay = data.startDateTime || (data.startDate ? { seconds: Math.floor(new Date(data.startDate).getTime() / 1000) } : null);
        data._endDisplay = data.endDateTime || (data.endDate ? { seconds: Math.floor(new Date(data.endDate).getTime() / 1000) } : null);

        list.push(data);
      }
      setTrips(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const loadExpensesFor = async (booking) => {
    try {
      const expQ = query(collection(db, 'expenses'), where('bookingId', '==', booking.id));
      const snapshot = await (await import('firebase/firestore')).getDocs(expQ);
      const exps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTrips(prev => prev.map(t => t.id === booking.id ? { ...t, expenses: exps } : t));
    } catch (e) {
      console.warn('loadExpensesFor failed', e);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">กำลังโหลดประวัติการเดินทาง...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ประวัติการเดินทาง</h1>

      {trips.length === 0 && <div className="bg-white rounded p-6 shadow">ไม่พบประวัติการเดินทาง</div>}

      <div className="space-y-4">
        {trips.map(t => (
          <div key={t.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex gap-4 items-start">
              <div className="w-20 h-20 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                {getImageUrl(t.vehicle) ? (
                  <Image src={getImageUrl(t.vehicle)} alt={`${t.vehicle.brand} ${t.vehicle.model}`} width={80} height={80} className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">ไม่มีรูป</div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{t.vehicle?.brand} {t.vehicle?.model} ({t.vehicleLicensePlate || t.vehicle?.licensePlate || '-'})</div>
                    <div className="text-sm text-gray-600">ผู้ขอ: {t.requesterName || t.userEmail || t.userId || '-'}</div>
                  </div>
                  <div className="text-sm text-right text-gray-600">
                    <div>เริ่ม: {formatDateTime(t._startDisplay)}</div>
                    <div>สิ้นสุด: {formatDateTime(t._endDisplay)}</div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-700">
                  <div>จุดเริ่ม: {t.origin || '-'}</div>
                  <div>จุดหมาย: {t.destination || '-'}</div>
                  <div>รายละเอียด: {t.purpose || '-'}</div>
                  <div>ระยะทางเริ่มต้น: {t.startMileage ?? '-'} กม.</div>
                  <div>ระยะทางสิ้นสุด: {t.endMileage ?? '-' } กม.</div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-gray-600">ค่าใช้จ่าย: { (t.expenses && t.expenses.length) ? `${t.expenses.reduce((s, e) => s + (e.amount||0), 0)} บาท (${t.expenses.length} รายการ)` : 'ยังไม่โหลด' }</div>
                  <div className="flex gap-2">
                    <button onClick={async () => { setExpandedId(expandedId === t.id ? null : t.id); if (!t.expenses || t.expenses.length === 0) await loadExpensesFor(t); }} className="px-3 py-1 text-sm bg-indigo-50 text-indigo-700 rounded">{expandedId === t.id ? 'ย่อ' : 'ดูรายละเอียด'}</button>
                  </div>
                </div>

                {expandedId === t.id && (
                  <div className="mt-4 bg-gray-50 border border-gray-100 rounded p-3">
                    <h4 className="font-semibold mb-2">รายละเอียดค่าใช้จ่าย</h4>
                    {t.expenses && t.expenses.length > 0 ? (
                      <div className="space-y-2 text-sm">
                        {t.expenses.map(exp => (
                          <div key={exp.id} className="flex justify-between">
                            <div>{exp.type || 'อื่นๆ'} - {exp.note || '-'}</div>
                            <div className="font-medium">{exp.amount || 0} ฿</div>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-gray-200 flex justify-between font-semibold">
                          <div>รวม</div>
                          <div>{t.expenses.reduce((s, e) => s + (e.amount || 0), 0)} ฿</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">ไม่มีค่าใช้จ่ายที่บันทึก</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

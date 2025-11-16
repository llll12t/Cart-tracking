"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
// AddMaintenanceForm removed from this page (create flow handled elsewhere)

export default function AdminMaintenanceQueue() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  // create form removed from this page
  const [editRecord, setEditRecord] = useState(null);
  const [receiveRecord, setReceiveRecord] = useState(null);
  const [receiveData, setReceiveData] = useState({ finalCost: '', finalMileage: '', notes: '', partsUsed: '', invoiceNumber: '', warranty: false, warrantyDate: '' });
  const [showSendModal, setShowSendModal] = useState(false);
  const [vehiclesList, setVehiclesList] = useState([]);
  const [sendVehicleId, setSendVehicleId] = useState('');
  const [sendVendor, setSendVendor] = useState('');
  const [sendExpectedReturnDate, setSendExpectedReturnDate] = useState('');
  const [sendMileage, setSendMileage] = useState('');
  const [inProgressItems, setInProgressItems] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'maintenances'),
      where('type', '==', 'garage'),
      where('maintenanceStatus', '==', 'pending')
    );
    const unsub = onSnapshot(q, async (snap) => {
      const data = await Promise.all(snap.docs.map(async d => {
        const rec = { id: d.id, ...d.data() };
        // try to fetch vehicle basic info
        try {
          if (rec.vehicleId) {
            const vRef = doc(db, 'vehicles', rec.vehicleId);
            const vSnap = await getDoc(vRef);
            if (vSnap.exists()) rec.vehicle = { id: vSnap.id, ...vSnap.data() };
          }
        } catch (e) {
          // ignore
        }
        return rec;
      }));
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // subscribe to maintenances that are already sent to garages (in_progress)
  useEffect(() => {
    const q = query(
      collection(db, 'maintenances'),
      where('type', '==', 'garage'),
      where('maintenanceStatus', '==', 'in_progress')
    );
    const unsub = onSnapshot(q, async (snap) => {
      const data = await Promise.all(snap.docs.map(async d => {
        const rec = { id: d.id, ...d.data() };
        try {
          if (rec.vehicleId) {
            const vRef = doc(db, 'vehicles', rec.vehicleId);
            const vSnap = await getDoc(vRef);
            if (vSnap.exists()) rec.vehicle = { id: vSnap.id, ...vSnap.data() };
          }
        } catch (e) {
          // ignore
        }
        return rec;
      }));
      setInProgressItems(data);
    });
    return () => unsub();
  }, []);

  const markAsSent = async (rec) => {
    if (!rec || processing[rec.id]) return;
    setProcessing(p => ({ ...p, [rec.id]: true }));
    try {
      // update maintenance status
      await updateDoc(doc(db, 'maintenances', rec.id), { maintenanceStatus: 'in_progress' });
      // ensure vehicle is marked maintenance and lastMaintenanceId set
      if (rec.vehicleId) {
        await updateDoc(doc(db, 'vehicles', rec.vehicleId), { status: 'maintenance', lastMaintenanceId: rec.id });
      }
    } catch (err) {
      console.error('markAsSent error', err);
    } finally {
      setProcessing(p => ({ ...p, [rec.id]: false }));
    }
  };

  const openSendModal = async () => {
    setShowSendModal(true);
    try {
      const snaps = await getDocs(collection(db, 'vehicles'));
      // Debug: log all vehicles and their status
      const allVehicles = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('All vehicles:', allVehicles.map(v => ({ id: v.id, status: v.status })));
      const notAllowedStatuses = [
        'maintenance',
        'in_use',
        'using',
        'on_trip',
        'busy',
        'reserved',
        'pending_approval',
        'unavailable',
      ];
      const list = allVehicles.filter(v => !notAllowedStatuses.includes((v.status || '').toLowerCase()));
      setVehiclesList(list);
      if (list.length) {
        setSendVehicleId(list[0].id);
        setSendMileage(list[0].currentMileage ?? '');
      }
    } catch (e) {
      console.error('load vehicles for send modal', e);
    }
  };

  const closeSendModal = () => {
    setShowSendModal(false);
    setSendVendor('');
    setSendExpectedReturnDate('');
    setSendMileage('');
    setVehiclesList([]);
    setSendVehicleId('');
  };

  const handleSendSubmit = async () => {
    if (!sendVehicleId || processing['send']) return;
    setProcessing(p => ({ ...p, send: true }));
    try {
      const vehicleRef = doc(db, 'vehicles', sendVehicleId);
      const maintRef = doc(collection(db, 'maintenances'));

      await runTransaction(db, async (tx) => {
        const vSnap = await tx.get(vehicleRef);
        if (!vSnap.exists()) throw new Error('vehicle-not-found');
        const odometer = Number(sendMileage) || vSnap.data()?.currentMileage || null;
        tx.set(maintRef, {
          vehicleId: sendVehicleId,
          type: 'garage',
          vendor: sendVendor || null,
          expectedReturnDate: sendExpectedReturnDate ? new Date(sendExpectedReturnDate) : null,
          odometerAtDropOff: odometer,
          maintenanceStatus: 'in_progress',
          createdAt: serverTimestamp(),
        });

        tx.update(vehicleRef, { status: 'maintenance', lastMaintenanceId: maintRef.id });
      });

      // รีเฟรช vehiclesList ใหม่ทันที (ถ้ายังเปิด modal อยู่)
      const snaps = await getDocs(collection(db, 'vehicles'));
      const allVehicles = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      const notAllowedStatuses = [
        'maintenance',
        'in_use',
        'using',
        'on_trip',
        'busy',
        'reserved',
        'pending_approval',
        'unavailable',
      ];
      const list = allVehicles.filter(v => !notAllowedStatuses.includes((v.status || '').toLowerCase()));
      setVehiclesList(list);
      if (list.length) {
        setSendVehicleId(list[0].id);
        setSendMileage(list[0].currentMileage ?? '');
      } else {
        setSendVehicleId('');
        setSendMileage('');
      }

      closeSendModal();
    } catch (err) {
      console.error('send to maintenance error', err);
    } finally {
      setProcessing(p => ({ ...p, send: false }));
    }
  };

  const cancelRequest = async (rec) => {
    if (!rec || processing[rec.id]) return;
    setProcessing(p => ({ ...p, [rec.id]: true }));
    try {
      await updateDoc(doc(db, 'maintenances', rec.id), { maintenanceStatus: 'cancelled' });
    } catch (err) {
      console.error('cancelRequest error', err);
    } finally {
      setProcessing(p => ({ ...p, [rec.id]: false }));
    }
  };

  const openEdit = (rec) => {
    setEditRecord(rec);
  };

  const closeEdit = () => setEditRecord(null);

  const handleEditSubmit = async (updates) => {
    if (!editRecord) return;
    setProcessing(p => ({ ...p, [editRecord.id]: true }));
    try {
      await updateDoc(doc(db, 'maintenances', editRecord.id), updates);
      closeEdit();
    } catch (err) {
      console.error('edit error', err);
    } finally {
      setProcessing(p => ({ ...p, [editRecord.id]: false }));
    }
  };

  const openReceive = (rec) => {
    setReceiveRecord(rec);
    setReceiveData({
      finalCost: rec.finalCost ?? rec.cost ?? '',
      finalMileage: rec.finalMileage ?? rec.odometerAtDropOff ?? rec.mileage ?? '',
      notes: rec.completionNotes ?? '',
      partsUsed: rec.partsUsed ?? '',
      invoiceNumber: rec.invoiceNumber ?? '',
      warranty: rec.warranty ?? false,
      warrantyDate: rec.warrantyDate
        ? (rec.warrantyDate.seconds
            ? new Date(rec.warrantyDate.seconds * 1000).toISOString().split('T')[0]
            : new Date(rec.warrantyDate).toISOString().split('T')[0])
        : '',
    });
  };

  const closeReceive = () => setReceiveRecord(null);

  const handleReceiveSubmit = async () => {
    const rec = receiveRecord;
    if (!rec) return;
    setProcessing(p => ({ ...p, [rec.id]: true }));
    try {
      const maintRef = doc(db, 'maintenances', rec.id);
      const vehicleRef = doc(db, 'vehicles', rec.vehicleId);

      await runTransaction(db, async (tx) => {
        // read vehicle first (required by Firestore: all reads before writes)
        const vehicleSnap = await tx.get(vehicleRef);
        const prevMileage = vehicleSnap.data()?.currentMileage ?? null;
        let newMileage = prevMileage;
        if (receiveData.finalMileage) {
          const proposed = Number(receiveData.finalMileage);
          if (prevMileage != null && proposed < prevMileage) {
            throw new Error('finalMileage-less-than-current');
          }
          newMileage = proposed;
        }

        // update maintenance (add more detailed fields)
        const updateObj = {
          maintenanceStatus: 'completed',
          finalCost: Number(receiveData.finalCost) || 0,
          finalMileage: receiveData.finalMileage ? Number(receiveData.finalMileage) : null,
          completionNotes: receiveData.notes || '',
          partsUsed: receiveData.partsUsed || '',
          invoiceNumber: receiveData.invoiceNumber || '',
          warranty: !!receiveData.warranty,
          receivedAt: serverTimestamp(),
        };
        if (receiveData.warranty && receiveData.warrantyDate) {
          updateObj.warrantyDate = new Date(receiveData.warrantyDate);
        } else {
          updateObj.warrantyDate = null;
        }
        tx.update(maintRef, updateObj);

        // update vehicle
        tx.update(vehicleRef, { status: 'available', currentMileage: newMileage });
      });

      closeReceive();
    } catch (err) {
      console.error('receive error', err);
      // Optionally show an inline message — for now console is used
    } finally {
      setProcessing(p => ({ ...p, [rec.id]: false }));
    }
  };

  if (loading) return <p>Loading maintenance queue...</p>;

  return (
    <div>
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">รถที่ส่งอู่ (กำลังซ่อม)</h2>
          <button
            onClick={openSendModal}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-semibold text-sm"
          >
            + ส่งรถไปอู่
          </button>
        </div>
        {inProgressItems.length === 0 ? (
          <p className="text-gray-500">ไม่มีรถที่ส่งอู่ในขณะนี้</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inProgressItems.map(rec => (
              <div key={rec.id} className="bg-white rounded-lg shadow p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="w-20 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    {rec.vehicle?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={rec.vehicle.imageUrl} alt="vehicle" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">ไม่มีรูป</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{rec.vehicle ? `${rec.vehicle.brand} ${rec.vehicle.model}` : `รถ: ${rec.vehicleId}`}</div>
                    <div className="text-sm text-gray-600">ทะเบียน: {rec.vehicle?.licensePlate ?? '-'}</div>
                    <div className="text-sm text-gray-500 mt-2 line-clamp-2">ส่งเมื่อ: {rec.createdAt ? (rec.createdAt.seconds ? new Date(rec.createdAt.seconds * 1000).toLocaleString('th-TH') : new Date(rec.createdAt).toLocaleString('th-TH')) : '-'}</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">{rec.vendor ? `อู่: ${rec.vendor}` : 'อู่: -'}</div>
                  <div className="flex gap-2">
                      <button onClick={() => router.push(`/vehicles/${rec.vehicleId}/garage`)} className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">ประวัติ</button>
                    <button disabled={processing[rec.id]} onClick={() => openReceive(rec)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">รับคืน</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

  {/* AddMaintenanceForm removed from this page */}

      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg p-6 bg-white rounded shadow">
            <h3 className="text-lg font-semibold mb-3">ส่งรถไปอู่</h3>
            <div className="space-y-3">
              <label className="block text-sm text-gray-700">รถ</label>
              <select className="w-full p-2 border rounded" value={sendVehicleId} onChange={(e)=>{
                const vid = e.target.value; setSendVehicleId(vid); const v = vehiclesList.find(x=>x.id===vid); if (v) setSendMileage(v.currentMileage ?? '');
              }}>
                {vehiclesList.map(v => (<option key={v.id} value={v.id}>{v.brand ? `${v.brand} ${v.model}` : v.id} — {v.licensePlate ?? ''}</option>))}
              </select>

              <label className="block text-sm text-gray-700">ชื่ออู่ (ไม่บังคับ)</label>
              <input className="w-full p-2 border rounded" value={sendVendor} onChange={(e)=>setSendVendor(e.target.value)} placeholder="ชื่ออู่" />

              <label className="block text-sm text-gray-700">คาดคืน (ไม่บังคับ)</label>
              <input type="date" className="w-full p-2 border rounded" value={sendExpectedReturnDate} onChange={(e)=>setSendExpectedReturnDate(e.target.value)} />

              <label className="block text-sm text-gray-700">เลขไมล์ตอนส่ง (กม.)</label>
              <input type="number" className="w-full p-2 border rounded" value={sendMileage} onChange={(e)=>setSendMileage(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={closeSendModal} className="px-4 py-2 bg-gray-200 rounded">ยกเลิก</button>
              <button onClick={handleSendSubmit} disabled={processing['send']} className="px-4 py-2 bg-yellow-600 text-white rounded">{processing['send'] ? 'กำลังส่ง...' : 'ส่งรถไปอู่'}</button>
            </div>
          </div>
        </div>
      )}

      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg p-6 bg-white rounded shadow">
            <h3 className="text-lg font-semibold mb-3">แก้ไขคำขอซ่อม</h3>
            <div className="space-y-3">
              <input className="w-full p-2 border rounded" defaultValue={editRecord.vendor || ''} placeholder="ชื่ออู่" onChange={(e)=> setEditRecord(r=>({...r, vendor: e.target.value}))} />
              <input className="w-full p-2 border rounded" defaultValue={editRecord.expectedReturnDate ? new Date(editRecord.expectedReturnDate.seconds ? editRecord.expectedReturnDate.seconds * 1000 : editRecord.expectedReturnDate).toISOString().split('T')[0] : ''} type="date" onChange={(e)=> setEditRecord(r=>({...r, expectedReturnDate: e.target.value}))} />
              <textarea className="w-full p-2 border rounded" defaultValue={editRecord.details || ''} onChange={(e)=> setEditRecord(r=>({...r, details: e.target.value}))} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={closeEdit} className="px-4 py-2 bg-gray-200 rounded">ยกเลิก</button>
              <button onClick={() => handleEditSubmit({ vendor: editRecord.vendor, expectedReturnDate: editRecord.expectedReturnDate ? new Date(editRecord.expectedReturnDate) : null, details: editRecord.details })} className="px-4 py-2 bg-blue-600 text-white rounded">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {receiveRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded shadow">
            <h3 className="text-lg font-semibold mb-3">รับคืนรถ</h3>
            <div className="space-y-3">
              <input type="number" className="w-full p-2 border rounded" value={receiveData.finalCost} onChange={(e)=>setReceiveData(d=>({...d, finalCost: e.target.value}))} placeholder="ค่าใช้จ่ายจริง (บาท)" />
              <input type="number" className="w-full p-2 border rounded" value={receiveData.finalMileage} onChange={(e)=>setReceiveData(d=>({...d, finalMileage: e.target.value}))} placeholder="เลขไมล์ตอนรับคืน (กม.)" />
              <input type="text" className="w-full p-2 border rounded" value={receiveData.partsUsed} onChange={(e)=>setReceiveData(d=>({...d, partsUsed: e.target.value}))} placeholder="อะไหล่ที่ใช้ (คั่นด้วย comma)" />
              <input type="text" className="w-full p-2 border rounded" value={receiveData.invoiceNumber} onChange={(e)=>setReceiveData(d=>({...d, invoiceNumber: e.target.value}))} placeholder="เลขที่ใบแจ้งหนี้ / ใบเสร็จ" />
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!receiveData.warranty} onChange={(e)=>setReceiveData(d=>({...d, warranty: e.target.checked}))} />
                <span className="text-sm">รับประกัน (หากมี)</span>
              </label>
              {receiveData.warranty && (
                <input type="date" className="w-full p-2 border rounded" value={receiveData.warrantyDate} onChange={(e)=>setReceiveData(d=>({...d, warrantyDate: e.target.value}))} placeholder="วันที่รับประกัน" />
              )}
              <textarea className="w-full p-2 border rounded" value={receiveData.notes} onChange={(e)=>setReceiveData(d=>({...d, notes: e.target.value}))} placeholder="หมายเหตุ / สรุปงานซ่อม" />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={closeReceive} className="px-4 py-2 bg-gray-200 rounded">ยกเลิก</button>
              <button onClick={handleReceiveSubmit} className="px-4 py-2 bg-green-600 text-white rounded">บันทึกและรับคืน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

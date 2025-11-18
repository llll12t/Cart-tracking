"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, runTransaction } from "firebase/firestore";

export default function AddMaintenanceForm({ vehicleId, onClose, onlyCost = false }) {
  const { userProfile } = useAuth();
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const defaultDateTime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const [formData, setFormData] = useState({
    date: defaultDateTime,
    details: '',
    cost: '',
    mileage: '',
    type: onlyCost ? 'cost-only' : 'cost-only',
    vendor: '',
    expectedReturnDate: '',
  });
  const [latestMileage, setLatestMileage] = useState(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (formData.type === 'garage') {
        // ส่งซ่อมอู่ - บันทึกใน maintenances และเปลี่ยนสถานะรถ
        await runTransaction(db, async (tx) => {
          const vehicleRef = doc(db, 'vehicles', vehicleId);
          const vSnap = await tx.get(vehicleRef);
          if (!vSnap.exists()) throw new Error('vehicle-not-found');

          const maintRef = doc(collection(db, 'maintenances'));
          tx.set(maintRef, {
            vehicleId: vehicleId,
            date: new Date(formData.date),
            details: formData.details,
            cost: Number(formData.cost),
            type: 'garage',
            vendor: formData.vendor || null,
            odometerAtDropOff: formData.mileage ? Number(formData.mileage) : null,
            expectedReturnDate: formData.expectedReturnDate ? new Date(formData.expectedReturnDate) : null,
            maintenanceStatus: 'in_progress',
            createdAt: serverTimestamp(),
            userId: userProfile?.uid || null,
            source: 'admin',
          });

          tx.update(vehicleRef, { status: 'maintenance', lastMaintenanceId: maintRef.id });
        });
      } else {
        // บันทึกค่าใช้จ่าย - บันทึกใน expenses collection
        await addDoc(collection(db, "expenses"), {
          vehicleId: vehicleId,
          userId: userProfile?.uid || null, // ผู้บันทึก
          usageId: null, // ไม่เกี่ยวกับ usage
          type: 'other',
          amount: Number(formData.cost),
          mileage: formData.mileage ? Number(formData.mileage) : null,
          note: formData.details,
          timestamp: new Date(formData.date),
          createdAt: serverTimestamp(),
          source: 'admin',
        });
      }

      setMessage('บันทึกข้อมูลสำเร็จ!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error adding maintenance record: ", error);
      setMessage('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch latest mileage for display only
  useEffect(() => {
    let mounted = true;
    const fetchVehicle = async () => {
      try {
        const vRef = doc(db, 'vehicles', vehicleId);
        const snap = await getDoc(vRef);
        if (mounted && snap.exists()) {
          const data = snap.data();
          if (data.currentMileage || data.currentMileage === 0) {
            setLatestMileage(data.currentMileage);
          }
        }
      } catch (err) {
        console.error('Failed to fetch vehicle for maintenance form:', err);
      }
    };
    if (vehicleId) fetchVehicle();
    return () => { mounted = false; };
  }, [vehicleId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold">เพิ่มรายการซ่อมบำรุง</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">วันที่/เวลา</label>
            <input type="datetime-local" name="date" value={formData.date} onChange={handleChange} required className="w-full p-2 border rounded"/>
          </div>

          {!onlyCost && (
            <div>
              <label className="block mb-1 font-medium">ประเภทการแจ้งซ่อม</label>
              <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded">
                <option value="cost-only">แจ้งค่าซ่อม (บันทึกค่าใช้จ่าย)</option>
                <option value="garage">ซ่อมอู่ (รอรับ)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block mb-1 text-sm font-medium">รายละเอียดการซ่อม</label>
            <textarea name="details" placeholder="เช่น เปลี่ยนน้ำมันเครื่อง, สลับยาง" value={formData.details} onChange={handleChange} required className="w-full p-2 border rounded" rows="3"></textarea>
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium">ค่าใช้จ่าย (บาท)</label>
            <input type="number" name="cost" placeholder="0.00" value={formData.cost} onChange={handleChange} required className="w-full p-2 border rounded"/>
          </div>

          {latestMileage !== null && (
            <div className="mb-1 text-xs text-gray-500">เลขไมล์ล่าสุด: <span className="font-semibold">{latestMileage}</span></div>
          )}
          <div>
            <label className="block mb-1 text-sm font-medium">เลขไมล์ (ถ้ามี)</label>
            <input type="number" name="mileage" placeholder="เช่น 10500" value={formData.mileage} onChange={handleChange} className="w-full p-2 border rounded"/>
          </div>
          {userProfile && (
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-medium">ผู้บันทึก:</span> {userProfile.name || userProfile.email || 'ไม่ระบุ'}
              </p>
            </div>
          )}

          {formData.type === 'garage' && (
            <div className="space-y-2">
              <div>
                <label className="block mb-1 text-sm font-medium">ชื่ออู่/ศูนย์บริการ</label>
                <input type="text" name="vendor" placeholder="ชื่ออู่" value={formData.vendor} onChange={handleChange} className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">วันที่คาดว่าจะรับคืน</label>
                <input type="date" name="expectedReturnDate" value={formData.expectedReturnDate} onChange={handleChange} className="w-full p-2 border rounded" />
              </div>
            </div>
          )}
          
          {message && <p className="text-center">{message}</p>}

          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">ยกเลิก</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
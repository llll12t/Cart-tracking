"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, runTransaction } from "firebase/firestore";

export default function AddMaintenanceForm({ vehicleId, onClose, onlyCost = false }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // default to today (YYYY-MM-DD)
    mileage: '',
    details: '',
    cost: '',
    type: onlyCost ? 'cost-only' : 'cost-only', // default remains cost-only; onlyCost will hide selector
    vendor: '',
    expectedReturnDate: '',
  });
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
        // create maintenance and mark vehicle as in maintenance atomically
        await runTransaction(db, async (tx) => {
          const vehicleRef = doc(db, 'vehicles', vehicleId);
          const vSnap = await tx.get(vehicleRef);
          if (!vSnap.exists()) throw new Error('vehicle-not-found');

          const maintRef = doc(collection(db, 'maintenances'));
          const odometer = Number(formData.mileage) || vSnap.data()?.currentMileage || null;
          tx.set(maintRef, {
            vehicleId: vehicleId,
            date: new Date(formData.date),
            odometerAtDropOff: odometer,
            details: formData.details,
            cost: Number(formData.cost),
            type: 'garage',
            vendor: formData.vendor || null,
            expectedReturnDate: formData.expectedReturnDate ? new Date(formData.expectedReturnDate) : null,
            maintenanceStatus: 'in_progress',
            createdAt: serverTimestamp(),
          });

          tx.update(vehicleRef, { status: 'maintenance', lastMaintenanceId: maintRef.id, currentMileage: odometer });
        });
      } else {
        const maintRef = await addDoc(collection(db, "maintenances"), {
          vehicleId: vehicleId,
          date: new Date(formData.date),
          mileage: Number(formData.mileage),
          details: formData.details,
          cost: Number(formData.cost),
          type: formData.type,
          vendor: formData.vendor || null,
          expectedReturnDate: formData.expectedReturnDate ? new Date(formData.expectedReturnDate) : null,
          maintenanceStatus: 'recorded',
          createdAt: serverTimestamp(),
        });
        // update lastMaintenanceId for reference
        try {
          const vehicleRef = doc(db, 'vehicles', vehicleId);
          const updateData = { lastMaintenanceId: maintRef.id };
          if (formData.mileage) updateData.currentMileage = Number(formData.mileage);
          await updateDoc(vehicleRef, updateData);
        } catch (uErr) {
          console.error('Failed to update vehicle lastMaintenanceId after creating maintenance:', uErr);
        }
      }

      setMessage('บันทึกข้อมูลสำเร็จ!');
      setTimeout(() => {
        onClose(); // ปิดฟอร์ม
      }, 1500);
    } catch (error) {
      console.error("Error adding maintenance record: ", error);
      setMessage('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prefill mileage from vehicle.currentMileage when the component mounts
  useEffect(() => {
    let mounted = true;
    const fetchVehicle = async () => {
      try {
        const vRef = doc(db, 'vehicles', vehicleId);
        const snap = await getDoc(vRef);
        if (mounted && snap.exists()) {
          const data = snap.data();
          if (data.currentMileage || data.currentMileage === 0) {
            setFormData(f => ({ ...f, mileage: data.currentMileage }));
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
          <input type="date" name="date" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <input type="number" name="mileage" placeholder="เลขไมล์ (กม.)" onChange={handleChange} required className="w-full p-2 border rounded"/>

          {!onlyCost && (
            <div>
              <label className="block mb-1 font-medium">ประเภทการแจ้งซ่อม</label>
              <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded">
                <option value="cost-only">แจ้งค่าซ่อม (บันทึกค่าใช้จ่าย)</option>
                <option value="garage">ซ่อมอู่ (รอรับ)</option>
              </select>
            </div>
          )}

          <textarea name="details" placeholder="รายละเอียดการซ่อม (เช่น เปลี่ยนน้ำมันเครื่อง, สลับยาง)" onChange={handleChange} required className="w-full p-2 border rounded"></textarea>
          <input type="number" name="cost" placeholder="ค่าใช้จ่าย (บาท)" onChange={handleChange} required className="w-full p-2 border rounded"/>

          {formData.type === 'garage' && (
            <div className="space-y-2">
              <input type="text" name="vendor" placeholder="ชื่ออู่/ศูนย์บริการ" onChange={handleChange} className="w-full p-2 border rounded" />
              <input type="date" name="expectedReturnDate" placeholder="วันที่คาดว่าจะรับคืน" onChange={handleChange} className="w-full p-2 border rounded" />
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
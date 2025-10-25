"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

export default function AddFuelLogForm({ vehicleId, currentMileage, onClose }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cost: '',
    mileage: '',
    note: '',
  });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill mileage from vehicle.currentMileage
  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const vRef = doc(db, 'vehicles', vehicleId);
        const snap = await getDoc(vRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.currentMileage || data.currentMileage === 0) {
            setFormData(f => ({ ...f, mileage: data.currentMileage }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch vehicle for fuel form:', err);
      }
    };
    if (vehicleId) fetchVehicle();
  }, [vehicleId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // บันทึกลง expenses collection แทน fuel_logs
      await addDoc(collection(db, "expenses"), {
        vehicleId,
        userId: null, // ไม่มี userId เพราะบันทึกจาก admin
        usageId: null, // ไม่เกี่ยวกับ usage
        type: 'fuel',
        amount: Number(formData.cost),
        mileage: formData.mileage ? Number(formData.mileage) : null,
        note: formData.note || '',
        timestamp: new Date(formData.date),
        createdAt: serverTimestamp(),
      });
      setMessage('บันทึกข้อมูลสำเร็จ!');
      setTimeout(onClose, 1500);
    } catch (error) {
      setMessage('เกิดข้อผิดพลาดในการบันทึก');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold">เพิ่มรายการเติมน้ำมัน</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">วันที่</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full p-2 border rounded"/>
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">เลขไมล์ <span className="text-red-500">*</span></label>
            <input type="number" name="mileage" placeholder="เช่น 10500" value={formData.mileage} onChange={handleChange} required className="w-full p-2 border rounded"/>
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">ราคารวม (บาท) <span className="text-red-500">*</span></label>
            <input type="number" step="0.01" name="cost" placeholder="0.00" value={formData.cost} onChange={handleChange} required className="w-full p-2 border rounded"/>
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">หมายเหตุ (ถ้ามี)</label>
            <input type="text" name="note" placeholder="เช่น เติมที่ปั๊ม Shell" value={formData.note} onChange={handleChange} className="w-full p-2 border rounded"/>
          </div>
          
          {message && <p className="text-center text-sm font-medium">{message}</p>}
          
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">ยกเลิก</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
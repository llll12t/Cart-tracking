"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export default function AddFuelLogForm({ vehicleId, currentMileage, onClose }) {
  const { userProfile } = useAuth();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cost: '',
    mileage: '',
    note: '',
  });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestMileage, setLatestMileage] = useState(null);

  // Fetch latest mileage for display
  useEffect(() => {
    const fetchLatestMileage = async () => {
      try {
        const { query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
        // ดึงข้อมูลเติมน้ำมันล่าสุดที่มีเลขไมล์
        const fuelQuery = query(
          collection(db, 'expenses'),
          where('vehicleId', '==', vehicleId),
          where('type', '==', 'fuel'),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const fuelSnap = await getDocs(fuelQuery);
        if (!fuelSnap.empty) {
          const latestFuel = fuelSnap.docs[0].data();
          if (latestFuel.mileage || latestFuel.mileage === 0) {
            setLatestMileage(latestFuel.mileage);
            return;
          }
        }
        // ถ้าไม่มีข้อมูลเติมน้ำมัน ให้ใช้ currentMileage จาก vehicle
        const vRef = doc(db, 'vehicles', vehicleId);
        const snap = await getDoc(vRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.currentMileage || data.currentMileage === 0) {
            setLatestMileage(data.currentMileage);
          }
        }
      } catch (err) {
        console.error('Failed to fetch latest mileage for fuel form:', err);
      }
    };
    if (vehicleId) fetchLatestMileage();
  }, [vehicleId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // บันทึกลง expenses collection
      await addDoc(collection(db, "expenses"), {
        vehicleId,
        userId: userProfile?.uid || null, // บันทึกผู้ใช้ที่เพิ่มข้อมูล
        usageId: null, // ไม่เกี่ยวกับ usage
        type: 'fuel',
        amount: Number(formData.cost),
        mileage: formData.mileage ? Number(formData.mileage) : null,
        note: formData.note || '',
        timestamp: serverTimestamp(), // ใช้เวลาปัจจุบัน
        createdAt: serverTimestamp(),
        source: 'admin', // ระบุว่าเพิ่มจากผู้ดูแลระบบ
      });
      setMessage('บันทึกข้อมูลสำเร็จ!');
      setTimeout(() => onClose(true), 1000); // ส่ง true เพื่อบอกว่าบันทึกสำเร็จ
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
        <h2 className="mb-6 text-2xl font-bold">⛽ เพิ่มรายการเติมน้ำมัน</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">วันที่</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full p-2 border rounded"/>
          </div>
          
          {latestMileage !== null && (
            <div className="mb-1 text-xs text-gray-500">เลขไมล์ล่าสุด: <span className="font-semibold">{latestMileage}</span></div>
          )}
          <div>
            <label className="block mb-1 text-sm font-medium">เลขไมล์ <span className="text-red-500">*</span></label>
            <input type="number" name="mileage" placeholder="" value={formData.mileage} onChange={handleChange} required className="w-full p-2 border rounded"/>
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">ราคารวม (บาท) <span className="text-red-500">*</span></label>
            <input type="number" step="0.01" name="cost" placeholder="0.00" value={formData.cost} onChange={handleChange} required className="w-full p-2 border rounded"/>
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">หมายเหตุ (ถ้ามี)</label>
            <input type="text" name="note" placeholder="เช่น เติมที่ปั๊ม Shell" value={formData.note} onChange={handleChange} className="w-full p-2 border rounded"/>
          </div>

          {userProfile && (
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-medium">ผู้บันทึก:</span> {userProfile.name || userProfile.email || 'ไม่ระบุ'}
              </p>
            </div>
          )}
          
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
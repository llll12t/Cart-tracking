"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, limit, getDocs, where } from "firebase/firestore";

export default function AddFuelLogForm({ vehicleId, currentMileage, onClose }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // ตั้งค่าเริ่มต้นเป็นวันปัจจุบัน
    mileage: currentMileage || '',
    liters: '',
    cost: '',
  });
  const [previousMileage, setPreviousMileage] = useState(0);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ดึงเลขไมล์ครั้งล่าสุดเพื่อคำนวณอัตราสิ้นเปลือง
  useEffect(() => {
    const q = query(
      collection(db, "fuel_logs"),
      where('vehicleId', '==', vehicleId),
      orderBy("mileage", "desc"),
      limit(1)
    );
    getDocs(q).then(snapshot => {
      if (!snapshot.empty) {
        setPreviousMileage(snapshot.docs[0].data().mileage);
      }
    });
  }, [vehicleId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Prevent duplicate: check same vehicle + mileage already exists
      const existingQ = query(
        collection(db, "fuel_logs"),
        where('vehicleId', '==', vehicleId),
        where('mileage', '==', Number(formData.mileage)),
        limit(1)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        setMessage('มีรายการเติมน้ำมันสำหรับเลขไมล์นี้แล้ว');
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, "fuel_logs"), {
        vehicleId,
        date: new Date(formData.date),
        mileage: Number(formData.mileage),
        liters: Number(formData.liters),
        cost: Number(formData.cost),
        previousMileage: previousMileage, // บันทึกเลขไมล์ครั้งก่อนไว้
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
          <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full p-2 border rounded"/>
          <input type="number" name="mileage" value={formData.mileage} placeholder="เลขไมล์ปัจจุบัน (กม.)" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <input type="number" step="0.01" name="liters" placeholder="จำนวน (ลิตร)" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <input type="number" step="0.01" name="cost" placeholder="ราคารวม (บาท)" onChange={handleChange} required className="w-full p-2 border rounded"/>
          {message && <p className="text-center">{message}</p>}
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
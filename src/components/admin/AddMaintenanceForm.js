"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function AddMaintenanceForm({ vehicleId, onClose }) {
  const [formData, setFormData] = useState({
    date: '',
    mileage: '',
    details: '',
    cost: '',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      await addDoc(collection(db, "maintenances"), {
        vehicleId: vehicleId,
        date: new Date(formData.date),
        mileage: Number(formData.mileage),
        details: formData.details,
        cost: Number(formData.cost),
        createdAt: serverTimestamp(),
      });
      setMessage('บันทึกข้อมูลสำเร็จ!');
      setTimeout(() => {
        onClose(); // ปิดฟอร์ม
      }, 1500);
    } catch (error) {
      console.error("Error adding maintenance record: ", error);
      setMessage('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold">เพิ่มรายการซ่อมบำรุง</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="date" name="date" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <input type="number" name="mileage" placeholder="เลขไมล์ (กม.)" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <textarea name="details" placeholder="รายละเอียดการซ่อม (เช่น เปลี่ยนน้ำมันเครื่อง, สลับยาง)" onChange={handleChange} required className="w-full p-2 border rounded"></textarea>
          <input type="number" name="cost" placeholder="ค่าใช้จ่าย (บาท)" onChange={handleChange} required className="w-full p-2 border rounded"/>
          
          {message && <p className="text-center">{message}</p>}

          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  );
}
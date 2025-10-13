// src/components/admin/AddVehicleForm.js
"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export default function AddVehicleForm({ onClose }) {
  const [formData, setFormData] = useState({
    licensePlate: '',
    brand: '',
    model: '',
    type: 'รถเก๋ง', // Default value
    status: 'available', // Default value
    currentMileage: 0,
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!formData.licensePlate || !formData.brand || !formData.model) {
        setMessage('กรุณากรอก ทะเบียน, ยี่ห้อ, และรุ่น');
        return;
    }

    try {
        await addDoc(collection(db, "vehicles"), {
            ...formData,
            currentMileage: Number(formData.currentMileage) // แปลงเป็นตัวเลข
        });
        setMessage('เพิ่มรถสำเร็จ!');
        setTimeout(() => {
            onClose(); // ปิดฟอร์มหลังเพิ่มสำเร็จ
        }, 1500);
    } catch (error) {
        console.error("Error adding vehicle: ", error);
        setMessage('เกิดข้อผิดพลาดในการเพิ่มรถ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold">เพิ่มข้อมูลรถใหม่</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" name="licensePlate" placeholder="ทะเบียนรถ (เช่น กข 1234)" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <input type="text" name="brand" placeholder="ยี่ห้อ (เช่น Toyota)" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <input type="text" name="model" placeholder="รุ่น (เช่น Hilux)" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <input type="number" name="currentMileage" placeholder="เลขไมล์ปัจจุบัน" onChange={handleChange} required className="w-full p-2 border rounded"/>
          <div>
            <label className="block mb-1 text-sm">ประเภทรถ</label>
            <select name="type" onChange={handleChange} value={formData.type} className="w-full p-2 border rounded">
              <option value="รถเก๋ง">รถเก๋ง (Sedan)</option>
              <option value="รถกระบะ">รถกระบะ (Pickup)</option>
              <option value="รถตู้">รถตู้ (Van)</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm">สถานะเริ่มต้น</label>
            <select name="status" onChange={handleChange} value={formData.status} className="w-full p-2 border rounded">
              <option value="available">ว่าง (Available)</option>
              <option value="maintenance">ซ่อมบำรุง (Maintenance)</option>
            </select>
          </div>
          
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
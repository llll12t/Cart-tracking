"use client";

import { useState } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function AddVehicleForm({ onClose }) {
  const [formData, setFormData] = useState({
    licensePlate: '',
    brand: '',
    model: '',
    type: 'รถเก๋ง',
    status: 'available',
    currentMileage: 0,
    taxDueDate: '',
    insuranceExpireDate: '',
    imageUrl: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setImageFile(e.target.files[0]);
    } else {
      setImageFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);

    if (!formData.licensePlate || !formData.brand || !formData.model) {
        setMessage('กรุณากรอก ทะเบียน, ยี่ห้อ, และรุ่น');
        setIsLoading(false);
        return;
    }

    let finalImageUrl = formData.imageUrl;

    try {
        if (imageFile) {
            setMessage('กำลังอัปโหลดรูปภาพ...');
            const storageRef = ref(storage, `vehicle_images/${imageFile.name}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, imageFile);
            finalImageUrl = await getDownloadURL(snapshot.ref);
            setMessage('อัปโหลดรูปภาพสำเร็จ...');
        } else if (formData.imageUrl && !imageFile) {
            finalImageUrl = formData.imageUrl;
        } else {
            finalImageUrl = '';
        }

        setMessage('กำลังบันทึกข้อมูลรถ...');
        await addDoc(collection(db, "vehicles"), {
            ...formData,
            currentMileage: Number(formData.currentMileage),
            taxDueDate: formData.taxDueDate ? new Date(formData.taxDueDate) : null,
            insuranceExpireDate: formData.insuranceExpireDate ? new Date(formData.insuranceExpireDate) : null,
            imageUrl: finalImageUrl,
        });

        setMessage('เพิ่มรถสำเร็จ!');
        setTimeout(() => {
            onClose();
        }, 1500);

    } catch (error) {
        console.error("Error adding vehicle: ", error);
        setMessage('เกิดข้อผิดพลาดในการเพิ่มรถ: ' + error.message);
    } finally {
        setIsLoading(false);
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
            <label className="block mb-1 text-sm">วันสิ้นสุดภาษี</label>
            <input type="date" name="taxDueDate" onChange={handleChange} className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label className="block mb-1 text-sm">วันหมดอายุประกัน</label>
            <input type="date" name="insuranceExpireDate" onChange={handleChange} className="w-full p-2 border rounded"/>
          </div>

          <div>
            <label className="block mb-1 text-sm">รูปภาพรถ</label>
            <input 
                type="file" 
                onChange={handleFileChange} 
                accept="image/*" 
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="text-xs text-gray-500 mt-1">หรือกรอก URL รูปภาพโดยตรง:</p>
            <input 
                type="text" 
                name="imageUrl" 
                value={formData.imageUrl}
                onChange={handleChange} 
                placeholder="https://example.com/car-image.jpg" 
                className="w-full p-2 border rounded mt-1"
                disabled={!!imageFile}
            />
            {imageFile && <p className="text-sm text-green-600 mt-1">ไฟล์ที่เลือก: {imageFile.name}</p>}
          </div>

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
          
          {message && <p className="text-center text-sm">{message}</p>}

          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">ยกเลิก</button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400">
                {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
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
  const [imageBroken, setImageBroken] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      // set temporary preview URL
      setFormData(prev => ({ ...prev, imageUrl: URL.createObjectURL(file) }));
      setImageBroken(false);
    } else {
      setImageFile(null);
      setFormData(prev => ({ ...prev, imageUrl: '' }));
    }
  };

  const applyImageUrl = () => {
    if (!imageUrlInput) return;
    setImageFile(null);
    setFormData(prev => ({ ...prev, imageUrl: imageUrlInput }));
    setImageUrlInput('');
    setImageBroken(false);
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
  <div className="w-full max-w-5xl p-8 bg-white rounded-lg shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold">เพิ่มข้อมูลรถใหม่</h2>
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* main form (span 2) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm">ทะเบียน</label>
                  <input type="text" name="licensePlate" placeholder="ทะเบียนรถ (เช่น กข 1234)" onChange={handleChange} required className="w-full p-2 border rounded"/>
                </div>
                <div>
                  <label className="block mb-1 text-sm">เลขไมล์ปัจจุบัน</label>
                  <input type="number" name="currentMileage" placeholder="เลขไมล์ปัจจุบัน" onChange={handleChange} required className="w-full p-2 border rounded"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm">ยี่ห้อ</label>
                  <input type="text" name="brand" placeholder="ยี่ห้อ (เช่น Toyota)" onChange={handleChange} required className="w-full p-2 border rounded"/>
                </div>
                <div>
                  <label className="block mb-1 text-sm">รุ่น</label>
                  <input type="text" name="model" placeholder="รุ่น (เช่น Hilux)" onChange={handleChange} required className="w-full p-2 border rounded"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm">วันสิ้นสุดภาษี</label>
                  <input type="date" name="taxDueDate" onChange={handleChange} className="w-full p-2 border rounded"/>
                </div>
                <div>
                  <label className="block mb-1 text-sm">วันหมดอายุประกัน</label>
                  <input type="date" name="insuranceExpireDate" onChange={handleChange} className="w-full p-2 border rounded"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              {message && <div className="text-sm text-center text-teal-700">{message}</div>}
            </div>

            {/* right column - preview & actions */}
            <aside className="flex flex-col items-center gap-4">
              <div className="w-full">
                <label className="block mb-2 text-sm font-medium">รูปรถ</label>
                <div className="w-full bg-gray-50 rounded-lg border p-3 flex items-center justify-center">
                    {formData.imageUrl ? (
                      !imageBroken ? (
                        <img src={formData.imageUrl} alt="Vehicle" className="w-full h-44 object-cover rounded" onError={() => setImageBroken(true)} />
                      ) : (
                        <img src={formData.imageUrl} alt="Vehicle" className="w-full h-44 object-cover rounded" />
                      )
                    ) : (
                      <div className="w-full h-44 bg-gray-100 flex items-center justify-center rounded text-gray-400">ไม่มีรูป</div>
                    )}
                  </div>
                <input type="file" accept="image/*" onChange={handleFileChange} className="mt-3 w-full" />
                <div className="mt-3 flex gap-2">
                  <input value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} placeholder="วางลิงก์รูปที่นี่" className="flex-1 p-2 border rounded" />
                  <button type="button" onClick={applyImageUrl} className="px-3 py-2 bg-blue-600 text-white rounded">ใช้ลิงก์</button>
                </div>
              </div>

              <div className="w-full bg-gray-50 p-3 rounded border text-sm">
                <div className="font-semibold">ข้อมูลสรุป</div>
                <div className="text-xs text-gray-600 mt-2">{formData.brand} {formData.model}</div>
                <div className="text-xs text-gray-600">ทะเบียน: {formData.licensePlate}</div>
                <div className="text-xs text-gray-600">ไมล์: {formData.currentMileage}</div>
                <div className="text-xs text-gray-600">สถานะ: {formData.status || '-'}</div>
              </div>

              <div className="w-full flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">บันทึก</button>
              </div>
              {message && <p className="text-center text-sm text-teal-700 mt-2">{message}</p>}
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}
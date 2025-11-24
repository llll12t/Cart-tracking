"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- Icons ---
const Icons = {
  ArrowLeft: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  ),
  Photo: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  InformationCircle: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
  DocumentText: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  Beaker: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  )
};

export default function AddVehiclePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    brand: "",
    model: "",
    licensePlate: "",
    currentMileage: "",
    year: "",
    type: "",
    color: "",
    note: "",
    imageUrl: "",
    taxDueDate: "",
    insuranceExpireDate: "",
    status: "available"
  });
  // Initial fluid setup
  const [initFluidEnabled, setInitFluidEnabled] = useState(false);
  const [initFluid, setInitFluid] = useState({
    fluidType: "engine_oil",
    date: new Date().toISOString().split('T')[0],
    mileage: "",
    cost: "",
    note: ""
  });
  const [imageFile, setImageFile] = useState(null);
  const [imageBroken, setImageBroken] = useState(false);
  const [message, setMessage] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState(['รถ SUV', 'รถเก๋ง', 'รถกระบะ', 'รถตู้', 'รถบรรทุก', 'มอเตอร์ไซค์', 'อื่นๆ']);

  useEffect(() => {
    async function loadVehicleTypes() {
      try {
        const res = await fetch('/api/notifications/settings');
        const data = await res.json();
        if (data.vehicleTypes && data.vehicleTypes.length > 0) {
          setVehicleTypes(data.vehicleTypes);
        }
      } catch (err) {
        console.error('Failed to load vehicle types:', err);
      }
    }
    loadVehicleTypes();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleDateChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setForm({ ...form, imageUrl: URL.createObjectURL(file) });
      setImageBroken(false);
    }
  };

  const applyImageUrl = () => {
    if (!imageUrlInput) return;
    setImageFile(null);
    setForm({ ...form, imageUrl: imageUrlInput });
    setImageUrlInput("");
    setImageBroken(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        const storageRef = ref(storage, `vehicle_images/${imageFile.name}_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }
      const vehicleDoc = await addDoc(collection(db, "vehicles"), {
        brand: form.brand,
        model: form.model,
        licensePlate: form.licensePlate,
        currentMileage: Number(form.currentMileage),
        year: form.year,
        type: form.type,
        color: form.color,
        note: form.note,
        imageUrl: imageUrl,
        status: form.status || "available",
        taxDueDate: form.taxDueDate ? new Date(form.taxDueDate) : null,
        insuranceExpireDate: form.insuranceExpireDate ? new Date(form.insuranceExpireDate) : null
      });

      // If initial fluid setup enabled, create an initial fluid expense entry
      if (initFluidEnabled) {
        const mileageNum = initFluid.mileage ? Number(initFluid.mileage) : null;
        const costNum = initFluid.cost ? Number(initFluid.cost) : 0;
        await addDoc(collection(db, "expenses"), {
          vehicleId: vehicleDoc.id,
          userId: null,
          usageId: null,
          type: 'fluid',
          amount: costNum,
          mileage: mileageNum,
          note: `${initFluid.note || 'ตั้งค่าเริ่มต้น'}`,
          timestamp: new Date(initFluid.date),
          createdAt: serverTimestamp(),
          fluidType: initFluid.fluidType
        });
      }
      setMessage("เพิ่มรถสำเร็จ!");
      setTimeout(() => router.push(`/vehicles`), 1200);
    } catch (err) {
      setMessage("เกิดข้อผิดพลาดในการเพิ่มรถ");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Icons.ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มข้อมูลรถใหม่</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-2 space-y-6">

          {/* General Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
              <Icons.InformationCircle className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-gray-800">ข้อมูลทั่วไป</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานะรถ</label>
                <select name="status" value={form.status || "active"} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                  <option value="active">พร้อมใช้งาน</option>
                  <option value="maintenance">ซ่อมบำรุง</option>
                  <option value="retired">ไม่พร้อมใช้งาน</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                <select name="type" value={form.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                  <option value="">-- เลือกประเภท --</option>
                  {vehicleTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยี่ห้อ <span className="text-red-500">*</span></label>
                <input name="brand" value={form.brand} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" required placeholder="เช่น Toyota" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รุ่น <span className="text-red-500">*</span></label>
                <input name="model" value={form.model} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" required placeholder="เช่น Camry" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ทะเบียน <span className="text-red-500">*</span></label>
                <input name="licensePlate" value={form.licensePlate} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" required placeholder="เช่น กข 1234" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ปีที่ผลิต</label>
                <input name="year" type="number" value={form.year} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="เช่น 2023" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สี</label>
                <input name="color" value={form.color} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="เช่น ขาว" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขไมล์เริ่มต้น <span className="text-red-500">*</span></label>
                <input name="currentMileage" type="number" value={form.currentMileage} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" required placeholder="0" />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
              <textarea name="note" value={form.note} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" rows={3} placeholder="ข้อมูลเพิ่มเติม..." />
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
              <Icons.DocumentText className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-800">เอกสารสำคัญ</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ภาษีรถยนต์ (หมดอายุ)</label>
                <input name="taxDueDate" type="date" value={form.taxDueDate} onChange={handleDateChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประกันรถยนต์ (หมดอายุ)</label>
                <input name="insuranceExpireDate" type="date" value={form.insuranceExpireDate} onChange={handleDateChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
              </div>
            </div>
          </div>

          {/* Initial Fluid Setup */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icons.Beaker className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-semibold text-gray-800">ตั้งค่าของเหลวเริ่มต้น</h3>
                  <p className="text-xs text-gray-500">บันทึกการเปลี่ยนของเหลวล่าสุด</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={initFluidEnabled} onChange={(e) => setInitFluidEnabled(e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {initFluidEnabled && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชนิดของเหลว</label>
                  <select value={initFluid.fluidType} onChange={(e) => setInitFluid(v => ({ ...v, fluidType: e.target.value }))} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="engine_oil">น้ำมันเครื่อง</option>
                    <option value="coolant">น้ำยาหม้อน้ำ</option>
                    <option value="brake_fluid">น้ำมันเบรก</option>
                    <option value="transmission_fluid">น้ำมันเกียร์</option>
                    <option value="power_steering">เพาเวอร์พวงมาลัย</option>
                    <option value="differential">ดิฟเฟอเรนเชียล</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่เปลี่ยนล่าสุด</label>
                  <input type="date" value={initFluid.date} onChange={(e) => setInitFluid(v => ({ ...v, date: e.target.value }))} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เลขไมล์ขณะเปลี่ยน</label>
                  <input type="number" value={initFluid.mileage} onChange={(e) => setInitFluid(v => ({ ...v, mileage: e.target.value }))} placeholder="เช่น 10500" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ค่าใช้จ่าย (บาท)</label>
                  <input type="number" step="0.01" value={initFluid.cost} onChange={(e) => setInitFluid(v => ({ ...v, cost: e.target.value }))} placeholder="0.00" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                  <input type="text" value={initFluid.note} onChange={(e) => setInitFluid(v => ({ ...v, note: e.target.value }))} placeholder="ระบุรายละเอียดเพิ่มเติม" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Image & Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
              <Icons.Photo className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-800">รูปรถ</h2>
            </div>

            <div className="space-y-4">
              <div
                className="w-full aspect-video bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all group overflow-hidden relative"
                onClick={() => document.getElementById('vehicle-image-input')?.click()}
              >
                {form.imageUrl ? (
                  !imageBroken ? (
                    <Image
                      src={form.imageUrl}
                      alt="Vehicle"
                      fill
                      className="object-cover"
                      unoptimized
                      onError={() => setImageBroken(true)}
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Icons.Photo className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-red-500">รูปภาพเสียหาย</p>
                    </div>
                  )
                ) : (
                  <div className="text-center p-4 group-hover:scale-105 transition-transform">
                    <Icons.Photo className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">คลิกเพื่ออัพโหลดรูปภาพ</p>
                    <p className="text-xs text-gray-400 mt-1">หรือลากไฟล์มาวางที่นี่</p>
                  </div>
                )}
              </div>

              <input
                id="vehicle-image-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">หรือใช้ลิงก์</span>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button type="button" onClick={applyImageUrl} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors">
                  ใช้
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
            <h3 className="font-semibold text-gray-800 mb-4">การดำเนินการ</h3>
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    กำลังบันทึก...
                  </>
                ) : (
                  'บันทึกข้อมูล'
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-all"
              >
                ยกเลิก
              </button>
            </div>
            {message && (
              <div className={`mt-4 p-3 rounded-lg text-sm text-center ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

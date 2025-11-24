"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import { useRouter, useParams } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

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
  ),
  Trash: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
};

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params?.vehicleId;
  const [vehicle, setVehicle] = useState(null);
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
  // Initial fluid setup (optional)
  const [initFluidEnabled, setInitFluidEnabled] = useState(false);
  const [initFluid, setInitFluid] = useState({
    fluidType: "เปลี่ยนถ่ายของเหลว",
    date: new Date().toISOString().split('T')[0],
    mileage: "",
    cost: "",
    note: "ตั้งค่าเริ่มต้น"
  });
  const [imageFile, setImageFile] = useState(null);
  const [imageBroken, setImageBroken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
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

  useEffect(() => {
    async function fetchVehicle() {
      if (!vehicleId) return;
      setLoading(true);
      const docRef = doc(db, "vehicles", vehicleId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setVehicle(snap.data());
        // parse date fields: Firestore may return Timestamp objects
        // support either the old/new field names: taxDueDate or taxExpiryDate
        const taxField = snap.data().taxDueDate || snap.data().taxExpiryDate || null;
        const insuranceField = snap.data().insuranceExpireDate || snap.data().insuranceExpiryDate || null;
        const toInputDate = (d) => {
          if (!d) return "";
          // Firestore Timestamp -> JS Date
          if (d.seconds && typeof d.seconds === 'number') return new Date(d.seconds * 1000).toISOString().slice(0, 10);
          // JS Date
          if (d.toDate) return d.toDate().toISOString().slice(0, 10);
          // string
          try { return new Date(d).toISOString().slice(0, 10); } catch (e) { return ""; }
        };

        // normalize status to match Add page
        const rawStatus = snap.data().status || "available";
        const normalizedStatus = rawStatus === 'available' ? 'available' : rawStatus;

        setForm({
          brand: snap.data().brand || "",
          model: snap.data().model || "",
          licensePlate: snap.data().licensePlate || "",
          currentMileage: snap.data().currentMileage || "",
          year: snap.data().year || "",
          type: snap.data().type || "",
          color: snap.data().color || "",
          note: snap.data().note || "",
          imageUrl: snap.data().imageUrl || "",
          taxDueDate: toInputDate(taxField),
          insuranceExpireDate: toInputDate(insuranceField),
          status: normalizedStatus
        });
      }
      setLoading(false);
    }
    fetchVehicle();
  }, [vehicleId]);

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

  const [imageUrlInput, setImageUrlInput] = useState("");
  const applyImageUrl = () => {
    if (!imageUrlInput) return;
    setImageFile(null);
    setForm({ ...form, imageUrl: imageUrlInput });
    setImageUrlInput("");
    setImageBroken(false);
  };

  useEffect(() => {
    setImageBroken(false);
  }, [form.imageUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        const storageRef = ref(storage, `vehicle_images/${imageFile.name}_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }
      const docRef = doc(db, "vehicles", vehicleId);
      await updateDoc(docRef, {
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

      if (initFluidEnabled) {
        const mileageNum = initFluid.mileage ? Number(initFluid.mileage) : null;
        const costNum = initFluid.cost ? Number(initFluid.cost) : 0;
        await addDoc(collection(db, "expenses"), {
          vehicleId,
          userId: null,
          usageId: null,
          type: 'fluid',
          amount: costNum,
          mileage: mileageNum,
          note: `${initFluid.note || 'ตั้งค่าเริ่มต้น'} (${initFluid.fluidType})`,
          timestamp: new Date(initFluid.date),
          createdAt: serverTimestamp(),
          fluidType: initFluid.fluidType
        });
      }
      setImageFile(null);
      setMessage("บันทึกข้อมูลรถสำเร็จ!");
      setTimeout(() => router.push(`/vehicles`), 1200);
    } catch (err) {
      setMessage("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  const handleDelete = async () => {
    if (!vehicleId) return;
    const ok = typeof window !== 'undefined' ? window.confirm('ยืนยันการลบรถคันนี้? การลบนี้ไม่สามารถย้อนกลับได้') : true;
    if (!ok) return;
    setDeleting(true);
    try {
      try {
        const imageUrl = form.imageUrl;
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          const imageRef = ref(storage, imageUrl);
          await deleteObject(imageRef);
        }
      } catch (_) {
        // ignore image deletion errors
      }

      await deleteDoc(doc(db, 'vehicles', vehicleId));
      setMessage('ลบรถสำเร็จ');
      setTimeout(() => router.push('/vehicles'), 800);
    } catch (e) {
      setMessage('ลบรถไม่สำเร็จ');
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <Icons.ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">แก้ไขข้อมูลรถ</h1>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
        >
          <Icons.Trash className="w-5 h-5" />
          {deleting ? 'กำลังลบ...' : 'ลบรถ'}
        </button>
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
                  <option value="available">พร้อมใช้งาน</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขไมล์ปัจจุบัน <span className="text-red-500">*</span></label>
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
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    กำลังบันทึก...
                  </>
                ) : (
                  'บันทึกการแก้ไข'
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

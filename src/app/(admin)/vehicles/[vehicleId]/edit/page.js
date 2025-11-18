"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import { useRouter, useParams } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

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

  // handle image file select
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      // clear any pasted URL when a local file is chosen
      setForm({ ...form, imageUrl: URL.createObjectURL(file) });
      setImageBroken(false);
    }
  };

  // handle setting image via URL paste
  const [imageUrlInput, setImageUrlInput] = useState("");
  const applyImageUrl = () => {
    if (!imageUrlInput) return;
    // clear any selected local file preview
    setImageFile(null);
    setForm({ ...form, imageUrl: imageUrlInput });
    setImageUrlInput("");
    setImageBroken(false);
  };

  // reset broken flag when image url/source changes
  useEffect(() => {
    setImageBroken(false);
  }, [form.imageUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      let imageUrl = form.imageUrl;
      // If the user selected a local file, upload it to Firebase Storage and get the download URL
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

      // If initial fluid setup enabled, create a fluid expense record
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
      // clear selected local file after successful upload
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
      // Attempt to delete image from Storage if it's a Firebase URL
      try {
        const imageUrl = form.imageUrl;
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          const imageRef = ref(storage, imageUrl);
          await deleteObject(imageRef);
        }
      } catch (_) {
        // ignore image deletion errors
      }

      await (await import('firebase/firestore')).deleteDoc(doc(db, 'vehicles', vehicleId));
      setMessage('ลบรถสำเร็จ');
      setTimeout(() => router.push('/vehicles'), 800);
    } catch (e) {
      setMessage('ลบรถไม่สำเร็จ');
      setDeleting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูลรถ...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">แก้ไขข้อมูลรถ</h1>
        <button type="button" onClick={handleDelete} disabled={deleting} className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
          {deleting ? 'กำลังลบ...' : 'ลบรถ'}
        </button>
      </div>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* main form (span 2) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">สถานะรถ</label>
                <select name="status" value={form.status || 'available'} onChange={handleChange} className="w-full p-3 border rounded-md">
                  <option value="available">พร้อมใช้งาน</option>
                  <option value="maintenance">ซ่อมบำรุง</option>
                  <option value="retired">ไม่พร้อมใช้งาน</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">ยี่ห้อ</label>
                <input name="brand" value={form.brand} onChange={handleChange} className="w-full p-3 border rounded-md" required />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">รุ่น</label>
                <input name="model" value={form.model} onChange={handleChange} className="w-full p-3 border rounded-md" required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">ทะเบียน</label>
                <input name="licensePlate" value={form.licensePlate} onChange={handleChange} className="w-full p-3 border rounded-md" required />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">ปีที่ผลิต</label>
                <input name="year" type="number" value={form.year} onChange={handleChange} className="w-full p-3 border rounded-md" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">ประเภท</label>
                <select name="type" value={form.type} onChange={handleChange} className="w-full p-3 border rounded-md">
                  <option value="">-- เลือกประเภท --</option>
                  {vehicleTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">สี</label>
                <input name="color" value={form.color} onChange={handleChange} className="w-full p-3 border rounded-md" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">เลขไมล์ปัจจุบัน</label>
                <input name="currentMileage" type="number" value={form.currentMileage} onChange={handleChange} className="w-full p-3 border rounded-md" />
                <p className="text-xs text-gray-500 mt-1">* สามารถแก้ไขเลขไมล์ได้</p>
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium">หมายเหตุ</label>
              <textarea name="note" value={form.note} onChange={handleChange} className="w-full p-3 border rounded-md" rows={4} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">ภาษีรถยนต์ (หมดอายุ)</label>
                <input name="taxDueDate" type="date" value={form.taxDueDate} onChange={handleDateChange} className="w-full p-3 border rounded-md" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">ประกันรถยนต์ (หมดอายุ)</label>
                <input name="insuranceExpireDate" type="date" value={form.insuranceExpireDate} onChange={handleDateChange} className="w-full p-3 border rounded-md" />
              </div>
            </div>

            {/* Initial Fluid Setup - same as Add page, placed at bottom */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div>
                  <h3 className="font-semibold">ตั้งค่าของเหลวเริ่มต้น</h3>
                  <p className="text-xs text-slate-500 mt-0.5">บันทึกรายการเปลี่ยนของเหลวล่าสุด เพื่อใช้เป็นจุดเริ่มต้นการติดตาม</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm select-none">
                  <input type="checkbox" className="h-4 w-4" checked={initFluidEnabled} onChange={(e) => setInitFluidEnabled(e.target.checked)} />
                  เปิดใช้งาน
                </label>
              </div>
              {initFluidEnabled && (
                <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium">ชนิดของเหลว</label>
                    <select value={initFluid.fluidType} onChange={(e)=>setInitFluid(v=>({...v, fluidType:e.target.value}))} className="w-full p-3 border rounded-md bg-white">
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
                    <label className="block mb-1 text-sm font-medium">วันที่ (เปลี่ยนล่าสุด)</label>
                    <input type="date" value={initFluid.date} onChange={(e)=>setInitFluid(v=>({...v, date:e.target.value}))} className="w-full p-3 border rounded-md bg-white" />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium">เลขไมล์ขณะเปลี่ยน</label>
                    <input type="number" value={initFluid.mileage} onChange={(e)=>setInitFluid(v=>({...v, mileage:e.target.value}))} placeholder="เช่น 10500" className="w-full p-3 border rounded-md bg-white" />
                    <p className="text-xs text-gray-500 mt-1">ใช้เป็นจุดเริ่มต้นการติดตาม</p>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium">ค่าใช้จ่าย (ถ้ามี)</label>
                    <input type="number" step="0.01" value={initFluid.cost} onChange={(e)=>setInitFluid(v=>({...v, cost:e.target.value}))} placeholder="0.00" className="w-full p-3 border rounded-md bg-white" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-1 text-sm font-medium">หมายเหตุ</label>
                    <input type="text" value={initFluid.note} onChange={(e)=>setInitFluid(v=>({...v, note:e.target.value}))} placeholder="ตั้งค่าเริ่มต้น" className="w-full p-3 border rounded-md bg-white" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* right column - preview & actions */}
          <aside className="flex flex-col items-center gap-4">
            <div className="w-full">
              <label className="block mb-2 text-sm font-medium">รูปรถ</label>
              <div
                className="w-full bg-gray-50 rounded-lg border p-3 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-400"
                onClick={() => document.getElementById('vehicle-image-input')?.click()}
                title="คลิกเพื่ออัพโหลดรูปใหม่"
              >
                {form.imageUrl ? (
                  !imageBroken ? (
                    <Image
                      src={form.imageUrl}
                      alt="Vehicle"
                      width={600}
                      height={220}
                      className="w-full h-44 object-cover rounded"
                      unoptimized
                      onError={() => setImageBroken(true)}
                    />
                  ) : (
                    <img src={form.imageUrl} alt="Vehicle" className="w-full h-44 object-cover rounded" />
                  )
                ) : (
                  <div className="w-full h-44 bg-gray-100 flex items-center justify-center rounded text-gray-400">ไม่มีรูป</div>
                )}
              </div>
              <input
                id="vehicle-image-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <div className="mt-3 flex gap-2">
                <input value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} placeholder="วางลิงก์รูปที่นี่" className="flex-1 p-2 border rounded" />
                <button type="button" onClick={applyImageUrl} className="px-3 py-2 bg-blue-600 text-white rounded">ใช้ลิงก์</button>
              </div>
            </div>
            <div className="w-full flex gap-3 mt-10 pt-6 border-t">
              <button type="button" onClick={() => router.back()} className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
              <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">บันทึก</button>
            </div>
            {message && <p className="text-center text-sm text-teal-700 mt-2">{message}</p>}
          </aside>
        </div>
      </form>
    </div>
  );
}

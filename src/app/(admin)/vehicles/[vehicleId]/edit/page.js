"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import { useRouter, useParams } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
  const [imageFile, setImageFile] = useState(null);
  const [imageBroken, setImageBroken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
          status: snap.data().status || "available"
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
      // clear selected local file after successful upload
      setImageFile(null);
      setMessage("บันทึกข้อมูลรถสำเร็จ!");
      setTimeout(() => router.push(`/vehicles`), 1200);
    } catch (err) {
      setMessage("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูลรถ...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">แก้ไขข้อมูลรถ</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* main form (span 2) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">สถานะรถ</label>
                <select name="status" value={form.status} onChange={handleChange} className="w-full p-3 border rounded-md">
                  <option value="available">พร้อมใช้งาน</option>
                  <option value="pending">รออนุมัติ</option>
                  <option value="in_use">กำลังใช้งาน</option>
                  <option value="on_trip">อยู่ระหว่างเดินทาง</option>
                  <option value="maintenance">ซ่อมบำรุง</option>
                  <option value="inactive">ไม่พร้อมใช้งาน</option>
                  <option value="retired">ปลดระวาง</option>
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
                  <option value="รถเก๋ง">รถเก๋ง</option>
                  <option value="รถกระบะ">รถกระบะ</option>
                  <option value="รถตู้">รถตู้</option>
                  <option value="รถบรรทุก">รถบรรทุก</option>
                  <option value="มอเตอร์ไซค์">มอเตอร์ไซค์</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">สี</label>
                <input name="color" value={form.color} onChange={handleChange} className="w-full p-3 border rounded-md" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">เลขไมล์เริ่มต้น</label>
                <input name="currentMileage" type="number" value={form.currentMileage} readOnly className="w-full p-3 border rounded-md bg-gray-100" />
                <p className="text-xs text-gray-500 mt-1">* ไม่สามารถแก้ไขเลขไมล์เริ่มต้นได้</p>
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
          </div>

          {/* right column - preview & actions */}
          <aside className="flex flex-col items-center gap-4">
            <div className="w-full">
              <label className="block mb-2 text-sm font-medium">รูปรถ</label>
              <div className="w-full bg-gray-50 rounded-lg border p-3 flex items-center justify-center">
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
              <input type="file" accept="image/*" onChange={handleImageChange} className="mt-3 w-full" />
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

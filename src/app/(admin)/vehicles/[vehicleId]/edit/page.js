"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

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
    depreciationRate: "",
    year: "",
    type: "",
    color: "",
    note: "",
    imageUrl: ""
  });
  const [imageFile, setImageFile] = useState(null);
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
        setForm({
          brand: snap.data().brand || "",
          model: snap.data().model || "",
          licensePlate: snap.data().licensePlate || "",
          currentMileage: snap.data().currentMileage || "",
          depreciationRate: snap.data().depreciationRate || "",
          year: snap.data().year || "",
          type: snap.data().type || "",
          color: snap.data().color || "",
          note: snap.data().note || "",
          imageUrl: snap.data().imageUrl || ""
        });
      }
      setLoading(false);
    }
    fetchVehicle();
  }, [vehicleId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // handle image file select
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setForm({ ...form, imageUrl: URL.createObjectURL(file) });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      let imageUrl = form.imageUrl;
      // TODO: upload imageFile to storage and get url (mock only)
      // If imageFile exists, upload to Firebase Storage and get URL
      // For now, just use local preview
      const docRef = doc(db, "vehicles", vehicleId);
      await updateDoc(docRef, {
        brand: form.brand,
        model: form.model,
        licensePlate: form.licensePlate,
        currentMileage: Number(form.currentMileage),
        depreciationRate: Number(form.depreciationRate),
        year: form.year,
        type: form.type,
        color: form.color,
        note: form.note,
        imageUrl: imageUrl
      });
      setMessage("บันทึกข้อมูลรถสำเร็จ!");
      setTimeout(() => router.push(`/vehicles`), 1200);
    } catch (err) {
      setMessage("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูลรถ...</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">แก้ไขข้อมูลรถ</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block mb-1 text-sm font-medium">ยี่ห้อ</label>
              <input name="brand" value={form.brand} onChange={handleChange} className="w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">รุ่น</label>
              <input name="model" value={form.model} onChange={handleChange} className="w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">ทะเบียน</label>
              <input name="licensePlate" value={form.licensePlate} onChange={handleChange} className="w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">ปีที่ผลิต</label>
              <input name="year" type="number" value={form.year} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">ประเภท</label>
              <input name="type" value={form.type} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">สี</label>
              <input name="color" value={form.color} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">เลขไมล์ปัจจุบัน</label>
              <input name="currentMileage" type="number" value={form.currentMileage} onChange={handleChange} className="w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">อัตราค่าเสื่อม (บาท/กม.)</label>
              <input name="depreciationRate" type="number" step="0.01" value={form.depreciationRate} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">หมายเหตุ</label>
              <textarea name="note" value={form.note} onChange={handleChange} className="w-full p-2 border rounded" rows={2} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <label className="block mb-1 text-sm font-medium">รูปรถ</label>
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="Vehicle" className="w-full max-w-xs h-40 object-cover rounded border" />
            ) : (
              <div className="w-full max-w-xs h-40 bg-gray-100 flex items-center justify-center rounded border text-gray-400">ไม่มีรูป</div>
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} className="w-full" />
          </div>
        </div>
        {message && <p className="text-center text-sm text-teal-700 mt-6">{message}</p>}
        <div className="flex gap-4 justify-end mt-8">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
          <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">บันทึก</button>
        </div>
      </form>
    </div>
  );
}

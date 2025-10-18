"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
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
    imageUrl: "",
    // use the same keys as AddVehicleForm
    taxDueDate: "",
    insuranceExpireDate: ""
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
          if (d.seconds && typeof d.seconds === 'number') return new Date(d.seconds * 1000).toISOString().slice(0,10);
          // JS Date
          if (d.toDate) return d.toDate().toISOString().slice(0,10);
          // string
          try { return new Date(d).toISOString().slice(0,10); } catch (e) { return ""; }
        };

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
          imageUrl: snap.data().imageUrl || "",
          taxDueDate: toInputDate(taxField),
          insuranceExpireDate: toInputDate(insuranceField)
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
        imageUrl: imageUrl,
        // save as Date objects to match AddVehicleForm
        taxDueDate: form.taxDueDate ? new Date(form.taxDueDate) : null,
        insuranceExpireDate: form.insuranceExpireDate ? new Date(form.insuranceExpireDate) : null
      });
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
                <input name="type" value={form.type} onChange={handleChange} className="w-full p-3 border rounded-md" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">สี</label>
                <input name="color" value={form.color} onChange={handleChange} className="w-full p-3 border rounded-md" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">เลขไมล์ปัจจุบัน</label>
                <input name="currentMileage" type="number" value={form.currentMileage} onChange={handleChange} className="w-full p-3 border rounded-md" required />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">อัตราค่าเสื่อม (บาท/กม.)</label>
                <input name="depreciationRate" type="number" step="0.01" value={form.depreciationRate} onChange={handleChange} className="w-full p-3 border rounded-md" />
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
                      // fallback to native img when Next/Image fails (works for blob: urls and cross-origin cases)
                      // Using unoptimized above doesn't always cover blob: or blocked remote images, so display a plain <img>
                      // eslint-disable-next-line @next/next/no-img-element
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

            <div className="w-full bg-gray-50 p-3 rounded border text-sm">
              <div className="font-semibold">ข้อมูลสรุป</div>
              <div className="text-xs text-gray-600 mt-2">{form.brand} {form.model}</div>
              <div className="text-xs text-gray-600">ทะเบียน: {form.licensePlate}</div>
              <div className="text-xs text-gray-600">ไมล์: {form.currentMileage}</div>
              <div className="text-xs text-gray-600">สถานะ: {vehicle?.status || '-'}</div>
            </div>

            <div className="w-full flex gap-3">
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

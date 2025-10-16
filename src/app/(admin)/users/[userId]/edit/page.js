
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditUserPage() {
	const router = useRouter();
	const params = useParams();
	const userId = params?.userId;
	const [form, setForm] = useState({
		name: "",
		email: "",
		role: "driver",
		phone: "",
		position: "",
		note: "",
		imageUrl: ""
	});
	const [imageFile, setImageFile] = useState(null);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState("");

	useEffect(() => {
		async function fetchUser() {
			if (!userId) return;
			setLoading(true);
			const docRef = doc(db, "users", userId);
			const snap = await getDoc(docRef);
					if (snap.exists()) {
						const data = snap.data();
						setForm({
							name: data.name || "",
							email: data.email || "",
							role: data.role || "driver",
							phone: data.phone || "",
							position: data.position || "",
							note: data.note || "",
							imageUrl: data.imageUrl || ""
						});
					}
			setLoading(false);
		}
		fetchUser();
	}, [userId]);

	const handleChange = (e) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

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
			// For now, just use local preview
			const docRef = doc(db, "users", userId);
			await updateDoc(docRef, {
				name: form.name,
				email: form.email,
				role: form.role,
				phone: form.phone,
				position: form.position,
				note: form.note,
				imageUrl: imageUrl
			});
			setMessage("บันทึกข้อมูลผู้ใช้สำเร็จ!");
			setTimeout(() => router.push("/admin/users"), 1200);
		} catch (err) {
			setMessage("เกิดข้อผิดพลาดในการบันทึก");
		}
	};

	if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูลผู้ใช้...</div>;

	return (
		<div className="max-w-lg mx-auto p-8">
			<h1 className="text-2xl font-bold mb-8">แก้ไขข้อมูลผู้ใช้</h1>
			<form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
				<div className="flex flex-col items-center gap-4">
					<label className="block mb-1 text-sm font-medium">รูปโปรไฟล์</label>
					{form.imageUrl ? (
						<img src={form.imageUrl} alt="User" className="w-24 h-24 object-cover rounded-full border" />
					) : (
						<div className="w-24 h-24 bg-gray-200 flex items-center justify-center rounded-full border text-gray-400 text-xs">ไม่มีรูป</div>
					)}
					<input type="file" accept="image/*" onChange={handleImageChange} className="w-full" />
				</div>
				<div>
					<label className="block mb-1 text-sm font-medium">ชื่อ</label>
					<input name="name" value={form.name} onChange={handleChange} className="w-full p-2 border rounded" required />
				</div>
				<div>
					<label className="block mb-1 text-sm font-medium">อีเมล</label>
					<input name="email" type="email" value={form.email} onChange={handleChange} className="w-full p-2 border rounded" required />
				</div>
				<div>
					<label className="block mb-1 text-sm font-medium">เบอร์โทร</label>
					<input name="phone" value={form.phone} onChange={handleChange} className="w-full p-2 border rounded" />
				</div>
				<div>
					<label className="block mb-1 text-sm font-medium">ตำแหน่ง</label>
					<input name="position" value={form.position} onChange={handleChange} className="w-full p-2 border rounded" />
				</div>
				<div>
					<label className="block mb-1 text-sm font-medium">บทบาท</label>
					<select name="role" value={form.role} onChange={handleChange} className="w-full p-2 border rounded">
						<option value="admin">ผู้ดูแลระบบ</option>
						<option value="driver">พนักงานขับ</option>
					</select>
				</div>
				<div>
					<label className="block mb-1 text-sm font-medium">หมายเหตุ</label>
					<textarea name="note" value={form.note} onChange={handleChange} className="w-full p-2 border rounded" rows={2} />
				</div>
				{message && <p className="text-center text-sm text-teal-700">{message}</p>}
				<div className="flex gap-4 justify-end">
					<button type="button" onClick={() => router.back()} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
					<button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">บันทึก</button>
				</div>
			</form>
		</div>
	);
}

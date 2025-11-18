
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function EditUserPage() {
	const router = useRouter();
	const params = useParams();
	const userId = params?.userId;
	const [form, setForm] = useState({
		name: "",
		email: "",
		role: "driver",
		lineId: "",
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
							lineId: data.lineId || "",
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
		setLoading(true);
		try {
			let imageUrl = form.imageUrl;
			
			// อัพโหลดรูปใหม่ถ้ามี
			if (imageFile) {
				const timestamp = Date.now();
				const fileName = `users/${userId}_${timestamp}`;
				const storageRef = ref(storage, fileName);
				
				await uploadBytes(storageRef, imageFile);
				imageUrl = await getDownloadURL(storageRef);
			}
			
			// normalize phone
			let phoneToSave = form.phone || null;
			if (phoneToSave) {
				const digits = phoneToSave.replace(/\D/g, '');
				if (digits.length !== 10) {
					setMessage('หมายเลขโทรศัพท์ต้องเป็นตัวเลข 10 หลัก');
					setLoading(false);
					return;
				}
				phoneToSave = digits;
			}
			const docRef = doc(db, "users", userId);
			await updateDoc(docRef, {
				name: form.name,
				email: form.email,
				role: form.role,
				lineId: form.lineId || null,
				phone: phoneToSave,
				position: form.position,
				note: form.note,
				imageUrl: imageUrl
			});
			setMessage("บันทึกข้อมูลผู้ใช้สำเร็จ!");
			setLoading(false);
			setTimeout(() => router.push("/users"), 1200);
		} catch (err) {
			console.error(err);
			setMessage("เกิดข้อผิดพลาดในการบันทึก");
			setLoading(false);
		}
	};

	const handleSendReset = async () => {
		if (!form.email) {
			alert('ไม่มีอีเมลของผู้ใช้');
			return;
		}
		try {
			await sendPasswordResetEmail(auth, form.email);
			alert('ส่งอีเมลรีเซ็ตรหัสผ่านเรียบร้อยแล้ว');
		} catch (err) {
			console.error(err);
			alert('ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้');
		}
	};

	if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูลผู้ใช้...</div>;

	return (
		<div className="max-w-5xl mx-auto space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">แก้ไขข้อมูลพนักงาน</h1>

			<form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-xl shadow-sm">
				{/* Left: avatar (clickable image to change) */}
				<div className="flex flex-col items-center gap-4 md:items-center md:justify-start">
					<label className="block mb-1 text-sm font-medium">รูปโปรไฟล์</label>
					<label htmlFor="avatar-upload" className="cursor-pointer group relative">
						{form.imageUrl ? (
							<Image 
								src={form.imageUrl} 
								alt="User" 
								width={128} 
								height={128} 
								className="w-32 h-32 object-cover rounded-md border group-hover:opacity-80 transition"
								unoptimized
							/>
						) : (
							<div className="w-32 h-32 bg-gray-200 flex items-center justify-center rounded-md border text-gray-400 text-xs group-hover:opacity-80 transition">ไม่มีรูป</div>
						)}
						<div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition pointer-events-none select-none whitespace-nowrap">เปลี่ยนรูป</div>
					</label>
					<input
						id="avatar-upload"
						type="file"
						accept="image/*"
						onChange={handleImageChange}
						className="hidden"
					/>
				</div>

				{/* Right: fields span two columns on md */}
				<div className="md:col-span-2">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
							<label className="block mb-1 text-sm font-medium">Line ID (optional)</label>
							<input name="lineId" value={form.lineId} onChange={handleChange} placeholder="U1234567890" className="w-full p-2 border rounded" />
						</div>
						<div className="md:col-span-2">
							<label className="block mb-1 text-sm font-medium">หมายเหตุ</label>
							<textarea name="note" value={form.note} onChange={handleChange} className="w-full p-2 border rounded" rows={3} />
						</div>
					</div>

					{message && <p className="text-left text-sm text-teal-700 mt-4">{message}</p>}

					<div className="flex gap-4 justify-end mt-6">
						<button type="button" onClick={handleSendReset} className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all">ส่งอีเมลรีเซ็ตรหัสผ่าน</button>
						<button type="button" onClick={() => router.back()} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all">ยกเลิก</button>
						<button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed">
							{loading ? 'กำลังบันทึก...' : 'บันทึก'}
						</button>
					</div>
				</div>
			</form>
		</div>
	);
}

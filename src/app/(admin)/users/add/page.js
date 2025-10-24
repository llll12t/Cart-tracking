"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function AddUserPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    lineId: '',
    phone: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) {
      setImageFile(f);
      setImagePreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const payload = { ...formData };
      if (payload.phone) {
        const digits = payload.phone.replace(/\D/g, '');
        if (digits.length !== 10) throw new Error('หมายเลขโทรศัพท์ต้องเป็นตัวเลข 10 หลัก');
        payload.phone = digits;
      }

      // remove local blob preview before sending
      if (imagePreview && imagePreview.startsWith('blob:')) {
        // If you want to upload the file, implement upload logic here and set payload.imageUrl
        delete payload.imageUrl;
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

  setMessage(`สร้างผู้ใช้สำเร็จ! กำลังกลับไปหน้าหลัก...`);
      setIsSuccess(true);
      
      // Redirect กลับไปหน้า user list หลังจากสร้างสำเร็จ
      setTimeout(() => router.push('/users'), 1200);

    } catch (error) {
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>

      <div className="max-w-5xl mx-auto p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">เพิ่มผู้ใช้งานใหม่</h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: avatar */}
          <div className="flex flex-col items-center">
            <label className="block mb-1 text-sm font-medium">รูปโปรไฟล์</label>
            {imagePreview ? (
              <Image src={imagePreview} alt="avatar" width={128} height={128} className="w-32 h-32 object-cover rounded-full border" />
            ) : (
              <div className="w-32 h-32 bg-gray-200 flex items-center justify-center rounded-full border text-gray-400 text-xs">ไม่มีรูป</div>
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} className="w-full mt-4" />
          </div>

          <div className="md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">ชื่อ-สกุล</label>
                <input type="text" name="name" placeholder="John Doe" value={formData.name} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">อีเมล</label>
                <input type="email" name="email" placeholder="john.doe@example.com" value={formData.email} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">รหัสผ่าน</label>
                <input type="password" name="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={formData.password} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">บทบาท (Role)</label>
                <select name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md">
                  <option value="employee">พนักงาน (Employee)</option>
                  <option value="driver">คนขับรถ (Driver)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Line ID (optional)</label>
                <input type="text" name="lineId" placeholder="U1234567890" value={formData.lineId} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md"/>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">เบอร์โทร (10 หลัก)</label>
                <input type="text" name="phone" placeholder="0812345678" value={formData.phone} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md"/>
              </div>

              <div className="md:col-span-2">
                {message && (
                  <p className={`text-left text-sm mt-2 ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
                )}
              </div>
            </div>

            <div className="flex gap-4 justify-end mt-6">
              <button type="button" onClick={() => router.back()} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
              <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400">
                {isLoading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
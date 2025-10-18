"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddUserPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    lineId: '',
  });
  // vvvv แก้ไขบรรทัดนี้: ลบเครื่องหมาย = ออกไปหนึ่งตัว vvvv
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setMessage(`สร้างผู้ใช้สำเร็จ! กำลังกลับไปหน้าหลัก...`);
      setIsSuccess(true);
      
      // Redirect กลับไปหน้า user list หลังจากสร้างสำเร็จ
      setTimeout(() => {
        router.push('/users');
      }, 2000);

    } catch (error) {
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
        <Link href="/users" className="text-indigo-600 hover:text-indigo-800 mb-6 inline-block">
           &larr; กลับไปหน้ารายชื่อผู้ใช้
        </Link>
        <div className="p-8 bg-white rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">เพิ่มผู้ใช้งานใหม่</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                
                {message && (
                    <p className={`text-center text-sm ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
                )}

                <button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition-colors">
                    {isLoading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
                </button>
            </form>
        </div>
    </div>
  );
}
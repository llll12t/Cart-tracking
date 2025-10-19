"use client";

import { useAuth } from "@/context/AuthContext";
import useLiffAuth from '@/hooks/useLiffAuth';
import { useState } from 'react';
import LiffQueryRouter from '@/components/main/LiffQueryRouter';

// Layout หลักสำหรับพนักงาน
export default function MainLayout({ children }) {
  const { user, loading } = useAuth();
  const { loading: liffLoading, needsLink, linkProfile, linkByPhone, error: liffAuthError } = useLiffAuth();
  const [phoneInput, setPhoneInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');

  if (loading || liffLoading) {
    return <div className="flex items-center justify-center min-h-screen"><LiffQueryRouter />Loading...</div>;
  }

  // If LIFF sign-in returned a needsLink, show a small form to enter phone number
  if (needsLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-6 rounded shadow max-w-md w-full">
          <LiffQueryRouter />
          <h2 className="text-lg font-bold mb-2">ผูกบัญชีด้วยหมายเลขโทรศัพท์</h2>
          <p className="text-sm text-gray-600 mb-4">เราไม่พบบัญชีพนักงานที่เชื่อมกับ LINE นี้ ({linkProfile?.displayName || ''}). โปรดกรอกหมายเลขโทรศัพท์ที่ลงทะเบียนกับระบบ เพื่อผูกบัญชีเข้าด้วยกัน</p>
          <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="เบอร์โทร (ตัวอย่าง: 0812345678)" className="w-full p-2 border rounded mb-3" />
          {linkMessage && <p className="text-sm text-red-600 mb-2">{linkMessage}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={async () => {
              setLinking(true);
              setLinkMessage('');
              const res = await linkByPhone(phoneInput.trim());
              if (res.success) {
                setLinkMessage('ผูกบัญชีสำเร็จ กำลังโหลดข้อมูล...');
              } else {
                setLinkMessage(res.error || 'ไม่สามารถผูกบัญชีได้');
              }
              setLinking(false);
            }} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50" disabled={linking}>ผูกบัญชี</button>
          </div>
          <p className="text-xs text-gray-400 mt-4">ถ้าคุณยังไม่ลงทะเบียนในระบบ โปรดติดต่อผู้ดูแล</p>
        </div>
      </div>
    )
  }

  // หากไม่มี user login อยู่ ให้แสดงหน้าว่างๆ (middleware จะจัดการ redirect)
  if (!user) {
    return <LiffQueryRouter />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LiffQueryRouter />
      {children}
    </div>
  );
}
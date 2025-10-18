"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [liffMock, setLiffMock] = useState(false);

  useEffect(() => {
    const val = typeof window !== 'undefined' ? window.localStorage.getItem('LIFF_MOCK') : null;
    setLiffMock(val === '1' || val === 'true');
  }, []);

  const onToggle = (e) => {
    const next = e.target.checked;
    setLiffMock(next);
    try {
      if (next) window.localStorage.setItem('LIFF_MOCK', '1');
      else window.localStorage.removeItem('LIFF_MOCK');
    } catch (err) {
      console.error('localStorage error', err);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
  <Link href="/users" className="text-indigo-600 hover:text-indigo-800 mb-6 inline-block">&larr; ย้อนกลับ</Link>
  <h1 className="text-2xl font-bold mb-4">การตั้งค่า</h1>

      <div className="bg-white p-6 rounded-md shadow space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">โหมดจำลอง LIFF</div>
            <div className="text-sm text-gray-500">เมื่อเปิดใช้งาน แอปจะใช้โปรไฟล์ LIFF และโทเค็นจำลองสำหรับการพัฒนา/ทดสอบ</div>
          </div>
          <div>
            <label className="inline-flex items-center">
              <input type="checkbox" checked={liffMock} onChange={onToggle} className="form-checkbox h-5 w-5" />
            </label>
          </div>
        </div>

        <div>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded">รีโหลดเพื่อใช้การตั้งค่า</button>
        </div>
      </div>
    </div>
  );
}

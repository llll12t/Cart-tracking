"use client";

import { useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import useLiffAuth from '@/hooks/useLiffAuth';
import { useState, useEffect } from 'react';
import LiffQueryRouter from '@/components/main/LiffQueryRouter';

export default function MainLayout({ children }) {
  const { user, userProfile, loading: authLoading, setUserProfileFromAuth } = useAuth();
  // ดึง error: liffAuthError ออกมาใช้งาน
  const { loading: liffLoading, needsLink, linkProfile, linkByPhone, error: liffAuthError, userProfile: liffUserProfile } = useLiffAuth();
  const [phoneInput, setPhoneInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');

  useEffect(() => {
    if (liffUserProfile && setUserProfileFromAuth) {
      console.log('Setting userProfile from LIFF auth:', liffUserProfile);
      setUserProfileFromAuth(liffUserProfile);
    }
  }, [liffUserProfile, setUserProfileFromAuth]);

  if (liffLoading || authLoading) {
    return (
      <div className="flex items-center justify-center bg-white min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------
  // [ส่วนที่เพิ่ม] ถ้ามี Error จาก LIFF/API ให้แสดงออกมาเลย
  // -------------------------------------------------------
  if (liffAuthError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-sm w-full text-center">
          <h3 className="text-lg font-bold text-red-600 mb-2">เกิดข้อผิดพลาด!</h3>
          <div className="bg-gray-100 p-3 rounded text-sm font-mono text-left text-red-800 break-words mb-4">
            {typeof liffAuthError === 'string' ? liffAuthError : JSON.stringify(liffAuthError)}
          </div>
          <p className="text-xs text-gray-500 mb-4">
            กรุณาแคปหน้าจอนี้แจ้งผู้ดูแลระบบ หรือตรวจสอบ Console Log
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-full"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }
  // -------------------------------------------------------



  // ... (โค้ดส่วน needsLink และ return ปกติ ด้านล่างเหมือนเดิม) ...
  if (needsLink) {
     // ... (คงเดิม)
     return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <div className="mb-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-center mb-2">ผูกบัญชีด้วยหมายเลขโทรศัพท์</h2>
            <p className="text-sm text-gray-600 text-center mb-6">
              เราไม่พบบัญชีพนักงานที่เชื่อมกับ LINE นี้ ({linkProfile?.displayName || ''})
            </p>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              หมายเลขโทรศัพท์
            </label>
            <input 
              value={phoneInput} 
              onChange={(e) => setPhoneInput(e.target.value)} 
              placeholder="0812345678" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
              type="tel"
            />
          </div>
          
          {linkMessage && (
            <div className={`mb-4 p-3 rounded ${linkMessage.includes('สำเร็จ') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <p className="text-sm">{linkMessage}</p>
            </div>
          )}
          
          <button 
            onClick={async () => {
              setLinking(true);
              setLinkMessage('');
              const res = await linkByPhone(phoneInput.trim());
              if (res.success) {
                setLinkMessage('ผูกบัญชีสำเร็จ กำลังโหลดข้อมูล...');
              } else {
                setLinkMessage(res.error || 'ไม่สามารถผูกบัญชีได้');
              }
              setLinking(false);
            }} 
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
            disabled={linking || !phoneInput.trim()}
          >
            {linking ? 'กำลังผูกบัญชี...' : 'ผูกบัญชี'}
          </button>
          
          <p className="text-xs text-gray-500 text-center mt-4">
            ถ้าคุณยังไม่ลงทะเบียนในระบบ โปรดติดต่อผู้ดูแล
          </p>
        </div>
      </div>
    );
  }

  if (userProfile) {
    return (
      <DataProvider userId={userProfile.uid}>
        <div className="min-h-screen bg-gray-50">
          <LiffQueryRouter />
          {children}
        </div>
      </DataProvider>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">กำลังตรวจสอบข้อมูลผู้ใช้...</p>
      </div>
    </div>
  );
}


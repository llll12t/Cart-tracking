"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useLiff from '@/hooks/useLiff';

export default function ConfirmBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.bookingId;
  const { liff, profile, loading: liffLoading, error: liffError } = useLiff();
  const [booking, setBooking] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!bookingId) return;
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (res.ok) setBooking(await res.json());
    }
    load();
  }, [bookingId]);

  const handleConfirm = async () => {
    setMessage('กำลังยืนยัน...');
    try {
      // ensure LIFF is ready
      if (!liff) {
        setMessage('LIFF ไม่พร้อม กรุณาเปิดหน้าในแอป LINE');
        return;
      }
      if (!profile) {
        await liff.login();
      }
      const idToken = await liff.getIDToken();
      const res = await fetch(`/api/bookings/${bookingId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessage('ยืนยันเรียบร้อย');
        setTimeout(() => router.push('/users'), 1000);
      } else {
        setMessage('ไม่สามารถยืนยันได้: ' + (data.error || ''));
      }
    } catch (err) {
      console.error(err);
      setMessage('เกิดข้อผิดพลาดในการยืนยัน');
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">ยืนยันการอนุมัติการจอง</h1>
      {!booking ? <div>กำลังโหลด...</div> : (
        <div className="bg-white p-6 rounded shadow">
          <div className="mb-2"><strong>ผู้ขอ:</strong> {booking.requesterName}</div>
          <div className="mb-2"><strong>รถ:</strong> {booking.vehicleLicensePlate}</div>
          <div className="mb-2"><strong>วันที่:</strong> {new Date(booking.startDate).toLocaleString()}</div>
          <div className="mt-4">
            <button onClick={handleConfirm} className="px-4 py-2 bg-teal-600 text-white rounded">ยืนยัน</button>
          </div>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>
      )}
    </div>
  );
}

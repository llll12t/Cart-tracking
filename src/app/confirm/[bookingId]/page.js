// src/app/confirm/[bookingId]/page.js

"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useLiff from '@/hooks/useLiff';

export default function ConfirmBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.bookingId;
  const { liff, profile, loading: liffLoading, error: liffError } = useLiff(process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID);
  const [booking, setBooking] = useState(null);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function load() {
      if (!bookingId) return;
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (res.ok) {
          setBooking(await res.json());
        } else {
          setBooking(null);
        }
      } catch (e) {
        setBooking(null);
      }
    }
    load();
  }, [bookingId]);

  const handleAction = async (action) => {
    setProcessing(true);
    setMessage(`กำลัง${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}...`);
    try {
      if (!liff) {
        setMessage('LIFF ไม่พร้อม กรุณาเปิดหน้าในแอป LINE');
        setProcessing(false);
        return;
      }
      if (typeof liff.isLoggedIn !== 'function' || !liff.isLoggedIn()) {
        setMessage('LIFF ยังไม่พร้อมหรือไม่ได้เปิดในแอป LINE');
        setProcessing(false);
        return;
      }
      const idToken = typeof liff.getIDToken === 'function' ? liff.getIDToken() : null;
      if (!idToken) {
        setMessage('ไม่พบ idToken จาก LIFF');
        setProcessing(false);
        return;
      }
      const res = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessage(`${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}เรียบร้อย`);
        setTimeout(() => liff.closeWindow && liff.closeWindow(), 1500);
      } else {
        setMessage(`ไม่สามารถดำเนินการได้: ${data.error || ''}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('เกิดข้อผิดพลาดในการดำเนินการ');
    }
    setProcessing(false);
  };

  if (liffLoading) return <div>กำลังโหลด...</div>;
  if (liffError) return <div>เกิดข้อผิดพลาดในการโหลด LIFF: {liffError}</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">รายละเอียดการจอง</h1>
      <div className="bg-white p-6 rounded shadow">
        {booking ? (
          <div className="space-y-2 mb-6">
            <div><span className="font-semibold">ผู้ขอ:</span> {booking.requesterName} ({booking.userEmail})</div>
            <div><span className="font-semibold">รถ:</span> {booking.vehicleLicensePlate}</div>
            <div><span className="font-semibold">วันที่:</span> {booking.startDate && booking.endDate ? `${new Date(booking.startDate).toLocaleString('th-TH', { dateStyle: 'medium' })} - ${new Date(booking.endDate).toLocaleString('th-TH', { dateStyle: 'medium' })}` : '-'}</div>
            <div><span className="font-semibold">วัตถุประสงค์:</span> {booking.purpose}</div>
            <div><span className="font-semibold">หมายเหตุ:</span> {booking.notes}</div>
          </div>
        ) : (
          <div>กำลังโหลดข้อมูลการจอง...</div>
        )}
        <div className="flex gap-4">
          <button
            onClick={() => handleAction('approve')}
            disabled={processing}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
          >
            อนุมัติ
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={processing}
            className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-60"
          >
            ปฏิเสธ
          </button>
        </div>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>
    </div>
  );
}
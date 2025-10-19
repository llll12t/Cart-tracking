"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useLiff from '@/hooks/useLiff';

export default function ConfirmBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.bookingId;
  // only use NEXT_PUBLIC_* env vars here so the value is available in the browser
  const confirmLiffId = process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID;
  const { liff, profile, loading: liffLoading, error: liffError } = useLiff(confirmLiffId);
  const [booking, setBooking] = useState(null);
  const [message, setMessage] = useState('');

  function toDate(value) {
    if (!value) return null;
    // Firestore Timestamp { seconds, nanoseconds }
    if (typeof value === 'object') {
      if (value.seconds != null) return new Date(value.seconds * 1000);
      if (value._seconds != null) return new Date(value._seconds * 1000);
      if (typeof value.toDate === 'function') {
        try { return value.toDate(); } catch (e) {}
      }
    }
    // number (ms) or numeric string
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const n = Number(value);
      if (!Number.isNaN(n)) return new Date(n);
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  function fmtDate(value) {
    const d = toDate(value);
    if (!d) return '-';
    try {
      return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return d.toString();
    }
  }

  useEffect(() => {
    async function load() {
      if (!bookingId) return;
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (res.ok) {
          setBooking(await res.json());
        } else if (res.status === 404) {
          setMessage('ไม่พบรายการการจอง (404)')
        } else {
          let txt = '';
          try { txt = await res.text(); } catch (e) {}
          setMessage(`ข้อผิดพลาดในการโหลด: ${res.status} ${txt}`);
        }
      } catch (err) {
        console.error('load booking error', err);
        setMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }
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
      {!booking ? (
        <div>{message || 'กำลังโหลด...'}</div>
      ) : (
        <div className="bg-white p-6 rounded shadow">
          <div className="mb-2"><strong>ผู้ขอ:</strong> {booking.requesterName || booking.userEmail || '-'}</div>
          <div className="mb-2"><strong>รถที่เลือก/ทะเบียน:</strong> {booking.vehicleLicensePlate || booking.vehicleId || '-'}</div>
          <div className="mb-2"><strong>วัตถุประสงค์:</strong> {booking.purpose || '-'}</div>
          <div className="mb-2"><strong>ต้นทาง:</strong> {booking.origin || '-'}</div>
          <div className="mb-2"><strong>ปลายทาง:</strong> {booking.destination || '-'}</div>
          <div className="mb-2"><strong>วันที่เดินทาง:</strong> {fmtDate(booking.startDate)}{booking.endDate ? ` → ${fmtDate(booking.endDate)}` : ''}</div>
          <div className="mb-2 text-xs text-gray-500">Booking ID: {booking.id || bookingId}</div>

          {booking.issues && booking.issues.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded">
              <strong className="text-red-600">ตรวจพบปัญหา:</strong>
              <ul className="list-disc list-inside text-sm text-red-600 mt-2">
                {booking.issues.map((it, idx) => <li key={idx}>{it}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button onClick={handleConfirm} className="px-4 py-2 bg-teal-600 text-white rounded">ยืนยัน</button>
            <button onClick={() => router.back()} className="px-4 py-2 bg-gray-200 rounded">ยกเลิก</button>
          </div>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>
      )}
    </div>
  );
}

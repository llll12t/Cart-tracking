// src/app/confirm/[bookingId]/page.js

"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useLiff from '@/hooks/useLiff';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';

export default function ConfirmBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.bookingId;
  const { liff, profile, loading: liffLoading, error: liffError } = useLiff(process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID);
  const [booking, setBooking] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [requester, setRequester] = useState(null);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function load() {
      if (!bookingId) return;
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (res.ok) {
          const bk = await res.json();
          setBooking(bk);
          // fetch vehicle and requester info if available
          try {
            if (bk.vehicleId) {
              const vRef = doc(db, 'vehicles', bk.vehicleId);
              const vSnap = await getDoc(vRef);
              if (vSnap.exists()) setVehicle({ id: vSnap.id, ...vSnap.data() });
            }
          } catch (e) {
            // ignore
          }
          try {
            if (bk.userId) {
              const uRef = doc(db, 'users', bk.userId);
              const uSnap = await getDoc(uRef);
              if (uSnap.exists()) setRequester({ id: uSnap.id, ...uSnap.data() });
            } else if (bk.userEmail) {
              const q = query(collection(db, 'users'), where('email', '==', bk.userEmail));
              const snaps = await getDocs(q);
              if (!snaps.empty) setRequester({ id: snaps.docs[0].id, ...snaps.docs[0].data() });
            }
          } catch (e) {
            // ignore
          }
        } else {
          setBooking(null);
        }
      } catch (e) {
        setBooking(null);
      }
    }
    load();
  }, [bookingId]);

  function formatDateOnly(value) {
    if (!value) return '-';
    try {
      let d;
      // Firestore timestamp
      if (value.seconds) d = new Date(value.seconds * 1000);
      // Firestore Timestamp with toDate
      else if (typeof value.toDate === 'function') d = value.toDate();
      else d = new Date(value);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('th-TH', { dateStyle: 'medium' });
    } catch (e) {
      return '-';
    }
  }

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
        // Attempt to close LIFF window (robust fallback)
        try {
          if (liff && typeof liff.closeWindow === 'function') {
            // Give UI a moment to show success message, then close
            setTimeout(() => {
              try { liff.closeWindow(); } catch (e) { console.warn('liff.closeWindow() failed', e); try { window.close(); } catch(_) { window.history.back(); } }
            }, 800);
          } else {
            // Not a LIFF environment; try to close the window or go back
            setTimeout(() => {
              try { window.close(); } catch (e) { window.history.back(); }
            }, 800);
          }
        } catch (e) {
          console.warn('Error while attempting to close LIFF/window', e);
        }
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
            <div className="flex items-center gap-3">
              {requester && requester.imageUrl ? (
                <Image src={requester.imageUrl} alt={requester.name || 'ผู้ขอ'} width={56} height={56} className="rounded-full object-cover" unoptimized />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-sm">U</div>
              )}
              <div>
                <div><span className="font-semibold">ผู้ขอ:</span> {booking.requesterName || requester?.name || '-'}</div>
                <div className="text-xs text-gray-500">{requester?.position || ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {vehicle && vehicle.imageUrl ? (
                <Image src={vehicle.imageUrl} alt={`${vehicle.brand || ''} ${vehicle.model || ''}`} width={120} height={80} className="object-cover rounded" unoptimized />
              ) : (
                <div className="w-28 h-20 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">No Image</div>
              )}
              <div><span className="font-semibold">รถ:</span> {booking.vehicleLicensePlate || vehicle?.licensePlate || booking.vehicleId || '-'}</div>
            </div>
            <div><span className="font-semibold">วันที่:</span> {booking.startDate && booking.endDate ? `${formatDateOnly(booking.startDate)} - ${formatDateOnly(booking.endDate)}` : '-'}</div>
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
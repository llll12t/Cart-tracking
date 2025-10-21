// src/app/confirm/[bookingId]/page.js

"use client";

import { useState, useEffect } from 'react';

import { useParams } from 'next/navigation';
import { doc, getDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

export default function ConfirmBookingPage() {
  const params = useParams();
  const bookingId = params?.bookingId;
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
          } catch (e) {}
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
          } catch (e) {}
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
      if (value.seconds) d = new Date(value.seconds * 1000);
      else if (typeof value.toDate === 'function') d = value.toDate();
      else d = new Date(value);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('th-TH', { dateStyle: 'medium' });
    } catch (e) {
      return '-';
    }
  }

  const handleApprove = async () => {
    setProcessing(true);
    setMessage('กำลังอนุมัติ...');
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'approved' });
      setMessage('อนุมัติเรียบร้อยแล้ว');
    } catch (e) {
      setMessage('เกิดข้อผิดพลาดในการอนุมัติ');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    setProcessing(true);
    setMessage('กำลังปฏิเสธ...');
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'rejected' });
      setMessage('ปฏิเสธเรียบร้อยแล้ว');
    } catch (e) {
      setMessage('เกิดข้อผิดพลาดในการปฏิเสธ');
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-100 py-8 px-2">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-6 md:p-10">
        <h1 className="text-3xl font-extrabold text-teal-700 mb-6 text-center tracking-tight">ยืนยันการจองรถ</h1>
        {booking ? (
          <div className="space-y-6 mb-8">
            <div className="flex items-center gap-4">
              {requester && requester.imageUrl ? (
                <Image src={requester.imageUrl} alt={requester.name || 'ผู้ขอ'} width={64} height={64} className="rounded-full object-cover border-2 border-teal-400" unoptimized />
              ) : (
                <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-lg font-bold text-teal-600 border-2 border-teal-200">U</div>
              )}
              <div>
                <div className="font-semibold text-lg text-gray-800">{booking.requesterName || requester?.name || '-'}</div>
                <div className="text-xs text-gray-500">{requester?.position || ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {vehicle && vehicle.imageUrl ? (
                <Image src={vehicle.imageUrl} alt={`${vehicle.brand || ''} ${vehicle.model || ''}`} width={140} height={90} className="object-cover rounded-lg border border-gray-200" unoptimized />
              ) : (
                <div className="w-36 h-24 bg-gray-100 rounded-lg flex items-center justify-center text-base text-gray-400 border border-gray-200">No Image</div>
              )}
              <div className="ml-2">
                <div className="font-semibold text-gray-700">รถ:</div>
                <div className="text-base text-gray-800">{booking.vehicleLicensePlate || vehicle?.licensePlate || booking.vehicleId || '-'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold text-gray-700">วันที่</div>
                <div className="text-base text-gray-800">{booking.startDate && booking.endDate ? `${formatDateOnly(booking.startDate)} - ${formatDateOnly(booking.endDate)}` : '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">วัตถุประสงค์</div>
                <div className="text-base text-gray-800">{booking.purpose || '-'}</div>
              </div>
            </div>
            {booking.notes && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-yellow-800 text-sm">
                <span className="font-semibold">หมายเหตุ:</span> {booking.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">กำลังโหลดข้อมูลการจอง...</div>
        )}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button
            onClick={handleApprove}
            disabled={processing}
            className="flex-1 px-6 py-3 text-lg font-bold rounded-lg shadow-sm bg-gradient-to-r from-teal-500 to-green-500 text-white hover:from-teal-600 hover:to-green-600 transition disabled:opacity-60"
          >
            ✅ อนุมัติ
          </button>
          <button
            onClick={handleReject}
            disabled={processing}
            className="flex-1 px-6 py-3 text-lg font-bold rounded-lg shadow-sm bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 transition disabled:opacity-60"
          >
            ❌ ปฏิเสธ
          </button>
        </div>
        {message && (
          <div className="mt-6 text-center text-lg font-semibold text-blue-700 animate-pulse">{message}</div>
        )}
      </div>
    </div>
  );
}
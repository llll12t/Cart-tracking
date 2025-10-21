// src/app/confirm/[bookingId]/page.js

"use client";

import { useState, useEffect, useRef } from 'react';

import { useParams } from 'next/navigation';
import { doc, getDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

// Helper to check if running in LIFF
function isLiff() {
  if (typeof window === 'undefined') return false;
  return !!window.liff && typeof window.liff.close === 'function';
}

export default function ConfirmBookingPage() {
  const params = useParams();
  const bookingId = params?.bookingId;
  const [booking, setBooking] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [requester, setRequester] = useState(null);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  // โหลดข้อมูลคนขับที่ถูกจองมา (ถ้ามี driverId)
  const [driver, setDriver] = useState(null);
  // modal state สำหรับยืนยันก่อนดำเนินการ
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(''); // 'approve' หรือ 'reject'
  useEffect(() => {
    async function loadDriver() {
      if (booking?.driverId) {
        const dRef = doc(db, 'users', booking.driverId);
        const dSnap = await getDoc(dRef);
        if (dSnap.exists()) setDriver({ id: dSnap.id, ...dSnap.data() });
      } else {
        setDriver(null);
      }
    }
    loadDriver();
  }, [booking?.driverId]);

  // Track if booking is already approved/rejected
  const isFinalStatus = booking && (booking.status === 'approved' || booking.status === 'rejected');

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
    if (isFinalStatus) return;
    setProcessing(true);
    setMessage('กำลังอนุมัติ...');
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'approved' });
      setBooking((prev) => prev ? { ...prev, status: 'approved' } : prev);
      setMessage('อนุมัติเรียบร้อยแล้ว');
      setTimeout(() => {
        if (isLiff()) window.liff.close();
      }, 1200);
    } catch (e) {
      setMessage('เกิดข้อผิดพลาดในการอนุมัติ');
    }
    setProcessing(false);
  };

  // ฟังก์ชันบันทึกการมอบหมาย
  const handleAssign = async () => {
    setAssignError('');
    if (!selectedDriver) {
      setAssignError('กรุณาเลือกคนขับก่อนมอบหมาย');
      return;
    }
    setProcessing(true);
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { driverId: selectedDriver });
      setBooking((prev) => prev ? { ...prev, driverId: selectedDriver } : prev);
      setShowAssignModal(false);
      setProcessing(false);
      setMessage('มอบหมายคนขับสำเร็จ กรุณากดอนุมัติอีกครั้ง');
    } catch (e) {
      setAssignError('เกิดข้อผิดพลาดในการมอบหมาย');
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isFinalStatus) return;
    setProcessing(true);
    setMessage('กำลังปฏิเสธ...');
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'rejected' });
      setBooking((prev) => prev ? { ...prev, status: 'rejected' } : prev);
      setMessage('ปฏิเสธเรียบร้อยแล้ว');
      // ปิด LIFF ถ้าอยู่ใน LIFF
      setTimeout(() => {
        if (isLiff()) window.liff.close();
      }, 1200);
    } catch (e) {
      setMessage('เกิดข้อผิดพลาดในการปฏิเสธ');
    }
    setProcessing(false);
  };

  return (
    <div className="flex items-center justify-center bg-white">
      <div className="w-full max-w-md h-screen p-8">
        {booking ? (
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
              {requester && requester.imageUrl ? (
                <Image src={requester.imageUrl} alt={requester.name || 'ผู้ขอ'} width={48} height={48} className="rounded-full object-cover border-2 border-green-700" unoptimized />
              ) : (
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-base font-bold text-green-800 border-2 border-green-300">U</div>
              )}
              <div>
                <div className="font-semibold text-base text-green-900">{booking.requesterName || requester?.name || '-'}</div>
                <div className="text-xs text-green-700">{requester?.position || ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {vehicle && vehicle.imageUrl ? (
                <Image src={vehicle.imageUrl} alt={`${vehicle.brand || ''} ${vehicle.model || ''}`} width={100} height={64} className="object-cover rounded-lg border border-green-200" unoptimized />
              ) : (
                <div className="w-24 h-16 bg-green-50 rounded-lg flex items-center justify-center text-xs text-green-400 border border-green-200">No Image</div>
              )}
              <div className="ml-1 flex">
                <div className="font-semibold text-green-800 text-sm">รถ:</div>
                <div className="text-sm text-green-900">{booking.vehicleLicensePlate || vehicle?.licensePlate || booking.vehicleId || '-'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div className="font-semibold text-green-800 text-sm">วันที่</div>
                <div className="text-sm text-green-900">{booking.startDate && booking.endDate ? `${formatDateOnly(booking.startDate)} - ${formatDateOnly(booking.endDate)}` : '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-green-800 text-sm">วัตถุประสงค์</div>
                <div className="text-sm text-green-900">{booking.purpose || '-'}</div>
              </div>
            </div>
            {booking.notes && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-2 rounded text-yellow-900 text-xs">
                <span className="font-semibold">หมายเหตุ:</span> {booking.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-green-700 py-6">กำลังโหลดข้อมูลการจอง...</div>
        )}
        {booking && (
          <>
            {/* ไม่ต้องแสดงชื่อคนขับซ้ำ ถ้ามีใน booking แล้ว */}
            <div className="flex flex-row gap-3 justify-center mt-2 w-full">
              <button
                onClick={() => { setConfirmAction('approve'); setShowConfirmModal(true); }}
                disabled={processing || isFinalStatus}
                className="w-1/2 px-4 py-2 text-base font-bold rounded-lg shadow bg-green-900 text-white hover:bg-green-800 transition disabled:opacity-60 border-2 border-green-900"
              >
                ✅ อนุมัติ
              </button>
              <button
                onClick={() => { setConfirmAction('reject'); setShowConfirmModal(true); }}
                disabled={processing || isFinalStatus}
                className="w-1/2 px-4 py-2 text-base font-bold rounded-lg shadow bg-white text-green-900 hover:bg-green-100 transition disabled:opacity-60 border-2 border-green-900"
              >
                ❌ ปฏิเสธ
              </button>
            </div>
            {/* Modal ยืนยันก่อนดำเนินการจริง */}
            {showConfirmModal && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
                  <h2 className="text-lg font-bold mb-3 text-green-900">
                    {confirmAction === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}
                  </h2>
                  <div className="mb-4 text-gray-700 text-sm">
                    {confirmAction === 'approve'
                      ? 'คุณต้องการอนุมัติการจองนี้ใช่หรือไม่? เมื่ออนุมัติแล้วจะมอบหมายข้อมูลคนขับและรถตามที่จองไว้ทันที'
                      : 'คุณต้องการปฏิเสธการจองนี้ใช่หรือไม่?'}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 bg-gray-200 rounded">ยกเลิก</button>
                    <button
                      onClick={() => {
                        setShowConfirmModal(false);
                        if (confirmAction === 'approve') handleApprove();
                        else handleReject();
                      }}
                      className={`px-4 py-2 rounded ${confirmAction === 'approve' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'}`}
                    >
                      {confirmAction === 'approve' ? 'ยืนยันอนุมัติ' : 'ยืนยันปฏิเสธ'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {message && (
          <div className="mt-4 text-center text-base font-semibold text-green-900 animate-pulse">{message}</div>
        )}
        {isFinalStatus && (
          <div className="mt-4 text-center text-base font-semibold text-green-700">{booking.status === 'approved' ? 'รายการนี้ได้รับการอนุมัติแล้ว' : 'รายการนี้ถูกปฏิเสธแล้ว'}</div>
        )}
      </div>
    </div>
  );
}
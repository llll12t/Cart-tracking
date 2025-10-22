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
    if (value === null || value === undefined || value === '') return '-';
    try {
      let d = null;
      // Firestore Timestamp-like object with toDate()
      if (value && typeof value.toDate === 'function') {
        d = value.toDate();
      // Firestore-like plain object with seconds/nanoseconds
      } else if (value && typeof value.seconds === 'number') {
        const ms = (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1e6);
        d = new Date(ms);
      // ISO string or numeric timestamp
      } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        // calendar-only string: treat as local midnight
        const parts = value.split('-');
        d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0);
      } else {
        d = new Date(value);
      }
      if (!d || isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('th-TH', { dateStyle: 'medium' });
    } catch (e) {
      return '-';
    }
  }

  // derive displayable start/end values from canonical or legacy fields
  const displayStart = booking ? (booking.startDateTime || booking.startCalendarDate || booking.startDate || booking.from) : null;
  const displayEnd = booking ? (booking.endDateTime || booking.endCalendarDate || booking.endDate || booking.to) : null;

  const handleApprove = async () => {
    if (isFinalStatus) return;
    setProcessing(true);
    setMessage('กำลังอนุมัติ...');
    // If no driver assigned, attempt to auto-assign the requester when they are a driver or admin
    let assignedDriverId = booking?.driverId;
    let assignedDriverName = booking?.driverName;
    if (!assignedDriverId) {
      try {
        // If booking was created by a userId, try to fetch that user
        if (booking?.userId) {
          const uRef = doc(db, 'users', booking.userId);
          const uSnap = await getDoc(uRef);
          if (uSnap.exists()) {
            const ud = uSnap.data();
            // อนุญาตให้ทั้ง driver และ admin เป็นคนขับได้
            if (ud.role === 'driver' || ud.role === 'admin') {
              assignedDriverId = uSnap.id;
              assignedDriverName = ud.name || ud.displayName || ud.email || '';
            }
          }
        }
        // Otherwise, try lookup by email and restrict to drivers and admins
        if (!assignedDriverId && booking?.userEmail) {
          const q = query(collection(db, 'users'), where('email', '==', booking.userEmail));
          const snaps = await getDocs(q);
          if (!snaps.empty) {
            const udoc = snaps.docs[0];
            const ud = udoc.data();
            // อนุญาตให้ทั้ง driver และ admin เป็นคนขับได้
            if (ud.role === 'driver' || ud.role === 'admin') {
              assignedDriverId = udoc.id;
              assignedDriverName = ud.name || ud.displayName || ud.email || '';
            }
          }
        }
      } catch (e) {
        console.warn('Auto-assign driver lookup failed', e);
      }

      if (!assignedDriverId) {
        setMessage('กรุณามอบหมายคนขับก่อนการอนุมัติ เพื่อให้คนขับสามารถเห็นทริป');
        setProcessing(false);
        return;
      }
    }
    try {
      // Use batch write so we update booking and vehicle atomically (if vehicle assigned)
      const batch = (await import('firebase/firestore')).writeBatch(db);
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingUpdate = { status: 'approved' };
      if (assignedDriverId) {
        bookingUpdate.driverId = assignedDriverId;
        bookingUpdate.driverName = assignedDriverName;
      }
      batch.update(bookingRef, bookingUpdate);
      if (booking?.vehicleId) {
        const vehicleRef = doc(db, 'vehicles', booking.vehicleId);
        batch.update(vehicleRef, { status: 'in_use' });
      }
      await batch.commit();
  setBooking((prev) => prev ? { ...prev, status: 'approved', driverId: assignedDriverId, driverName: assignedDriverName } : prev);
      setMessage('อนุมัติเรียบร้อยแล้ว');
      // หลังอนุมัติ: ส่งการแจ้งเตือนผ่าน API (จะส่งเฉพาะ Admin + คนจอง)
        try {
        const notifResp = await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'booking_approved',
            booking: {
              id: bookingId,
              userId: booking?.userId || booking?.requesterId,
              requesterName: booking?.requesterName,
              userEmail: booking?.userEmail,
              vehicleLicensePlate: booking?.vehicleLicensePlate,
              driverId: assignedDriverId,
              driverName: assignedDriverName,
              vehicleId: booking?.vehicleId,
              startDateTime: booking?.startDateTime,
              startCalendarDate: booking?.startCalendarDate || booking?.startDate,
              endDateTime: booking?.endDateTime,
              endCalendarDate: booking?.endCalendarDate || booking?.endDate
            }
          })
        });
        const notifJson = await notifResp.json().catch(() => null);
        if (notifJson && notifJson.results) {
          const r = notifJson.results;
          const sent = (r.sent && r.sent.length) || 0;
          console.log(`✅ ส่งการแจ้งเตือนไปยัง ${sent} คน (Admin + คนจอง)`);
        }
      } catch (e) {
        console.warn('Failed to request booking_approved notifications', e);
      }
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
      
      // ส่งการแจ้งเตือนผ่าน API (จะส่งเฉพาะ Admin + คนจอง)
      try {
        await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'booking_rejected',
            booking: {
              id: bookingId,
              userId: booking?.userId || booking?.requesterId,
              requesterName: booking?.requesterName,
              userEmail: booking?.userEmail,
              vehicleLicensePlate: booking?.vehicleLicensePlate,
              vehicleId: booking?.vehicleId,
              startDateTime: booking?.startDateTime,
              startCalendarDate: booking?.startCalendarDate || booking?.startDate
            }
          })
        });
        console.log('✅ ส่งการแจ้งเตือนการปฏิเสธไปยัง Admin + คนจอง');
      } catch (e) {
        console.warn('Failed to send rejection notification', e);
      }
      
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
                <Image src={requester.imageUrl} alt={requester.name || 'ผู้ขอ'} width={48} height={48} className="rounded-full object-cover border-2 border-[#075b50]" unoptimized />
              ) : (
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-base font-bold text-green-800 border-2 border-green-300">U</div>
              )}
              <div>
                <div className="font-semibold text-base text-[#075b50]">{booking.requesterName || requester?.name || '-'}</div>
                <div className="text-xs text-[#075b50]">{requester?.position || ''}</div>
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
                <div className="text-sm text-[#075b50]">{booking.vehicleLicensePlate || vehicle?.licensePlate || booking.vehicleId || '-'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div className="font-semibold text-green-800 text-sm">วันที่</div>
                <div className="text-sm text-[#075b50]">{displayStart ? `${formatDateOnly(displayStart)}${displayEnd ? ` - ${formatDateOnly(displayEnd)}` : ''}` : '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-green-800 text-sm">วัตถุประสงค์</div>
                <div className="text-sm text-[#075b50]">{booking.purpose || '-'}</div>
              </div>
            </div>
            {booking.notes && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-2 rounded text-yellow-900 text-xs">
                <span className="font-semibold">หมายเหตุ:</span> {booking.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[#075b50] py-6">กำลังโหลดข้อมูลการจอง...</div>
        )}
        {booking && (
          <>
            {/* ไม่ต้องแสดงชื่อคนขับซ้ำ ถ้ามีใน booking แล้ว */}
            <div className="flex flex-row gap-3 justify-center mt-2 w-full">
              <button
                onClick={() => { setConfirmAction('approve'); setShowConfirmModal(true); }}
                disabled={processing || isFinalStatus}
                className="w-1/2 px-4 py-2 text-base font-bold rounded-lg shadow bg-[#075b50] text-white hover:bg-green-800 transition disabled:opacity-60 border-2 border-[#075b50]"
              >
                ✅ อนุมัติ
              </button>
              <button
                onClick={() => { setConfirmAction('reject'); setShowConfirmModal(true); }}
                disabled={processing || isFinalStatus}
                className="w-1/2 px-4 py-2 text-base font-bold rounded-lg shadow bg-white text-[#075b50] hover:bg-green-100 transition disabled:opacity-60 border-2 border-[#075b50]"
              >
                ❌ ปฏิเสธ
              </button>
            </div>
            {/* Modal ยืนยันก่อนดำเนินการจริง */}
            {showConfirmModal && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
                  <h2 className="text-lg font-bold mb-3 text-[#075b50]">
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
                      className={`px-4 py-2 rounded ${confirmAction === 'approve' ? 'bg-[#075b50] text-white' : 'bg-red-600 text-white'}`}
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
          <div className="mt-4 text-center text-base font-semibold text-[#075b50] animate-pulse">{message}</div>
        )}
        {/* Notification summary removed per UX request */}
        {isFinalStatus && (
          <div className="mt-4 text-center text-base font-semibold text-[#075b50]">{booking.status === 'approved' ? 'รายการนี้ได้รับการอนุมัติแล้ว' : 'รายการนี้ถูกปฏิเสธแล้ว'}</div>
        )}
      </div>
    </div>
  );
}
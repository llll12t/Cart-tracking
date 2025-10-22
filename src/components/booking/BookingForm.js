// src/components/booking/BookingForm.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getImageUrl } from '@/lib/imageHelpers';
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";

export default function BookingForm() {
  const { user, userProfile } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [destination, setDestination] = useState("");
  const [mileage, setMileage] = useState("");
  const [originalMileage, setOriginalMileage] = useState(null);
  const [purpose, setPurpose] = useState("");
  // origin should be fixed to บริษัท
  const FIXED_ORIGIN = 'บริษัท';
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('00:00');
  const [isMileageEditing, setIsMileageEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // ดึงรายการรถที่พร้อมใช้งาน
  useEffect(() => {
    // ดึงรถที่ status == 'available' เท่านั้น (ไม่รวม booked/pending)
    const q = query(collection(db, "vehicles"), where("status", "==", "available"));
    let unsubVehicles = null;
    let unsubBookings = null;
    let allVehicles = [];
    let bookedVehicleIds = new Set();
    let vehiclesLoaded = false;
    let bookingsLoaded = false;

    // ดึง bookings ที่ยังไม่จบ (pending, approved, on_trip)
    unsubBookings = onSnapshot(
      query(collection(db, "bookings"), where("status", "in", ["pending", "approved", "on_trip"])),
      (snapshot) => {
        bookedVehicleIds = new Set(snapshot.docs.map(doc => doc.data().vehicleId));
        bookingsLoaded = true;
        // หลังจากได้ bookings แล้ว ให้ filter vehicles อีกที
        if (allVehicles.length > 0) {
          setVehicles(allVehicles.filter(v => !bookedVehicleIds.has(v.id)));
        }
        // ถ้าทั้ง vehicles และ bookings โหลดเสร็จแล้ว ให้ปิด loading
        if (vehiclesLoaded && bookingsLoaded) {
          setLoadingVehicles(false);
        }
      }
    );

    unsubVehicles = onSnapshot(q, (snapshot) => {
      allVehicles = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(v => v.status === 'available');
      vehiclesLoaded = true;
      // filter ซ้ำ: ไม่เอารถที่ถูกจองแล้ว
      setVehicles(allVehicles.filter(v => !bookedVehicleIds.has(v.id)));
      // ถ้าทั้ง vehicles และ bookings โหลดเสร็จแล้ว ให้ปิด loading
      if (vehiclesLoaded && bookingsLoaded) {
        setLoadingVehicles(false);
      }
    });

    return () => {
      if (unsubVehicles) unsubVehicles();
      if (unsubBookings) unsubBookings();
    };
  }, []);

  // close dropdown on outside click (container wraps button + list)
  useEffect(() => {
    function onDocClick(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // when selectedVehicle changes, populate mileage from vehicle data if available
  useEffect(() => {
    if (!selectedVehicle) return;
    const sel = vehicles.find(v => v.id === selectedVehicle);
    if (sel && sel.currentMileage !== undefined && sel.currentMileage !== null) {
      setMileage(sel.currentMileage);
      setOriginalMileage(sel.currentMileage);
    }
  }, [selectedVehicle, vehicles]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVehicle || !destination || !startDate) {
      setMessage("กรุณากรอกข้อมูลให้ครบ: เลือกรถ, จุดหมาย, และวันที่เริ่ม");
      return;
    }
    if (!user) {
      setMessage("ไม่พบข้อมูลผู้ใช้ กรุณาลองเข้าสู่ระบบใหม่");
      return;
    }

    setIsLoading(true);
    try {
      const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);

      // combine date + time into local Date to represent the intended local moment
      const startDateTime = new Date(`${startDate}T${startTime}:00`);

      // store calendar-only date string separately (preserve user's intended calendar date)
      // and store startDateTime (JS Date) which will be saved as Firestore Timestamp
      const bookingData = {
        userId: user.uid,
        userEmail: user.email,
        requesterId: user.uid,
        requesterName: userProfile?.name || userProfile?.displayName || user.displayName || '',
        vehicleId: selectedVehicle,
        vehicleLicensePlate: selectedVehicleData?.licensePlate,
        origin: FIXED_ORIGIN,
        destination,
        purpose,
        // keep the original date string YYYY-MM-DD so we can display the calendar date exactly as entered
        startCalendarDate: startDate,
        startTime: startTime,
        // store combined timestamp (local time)
        startDateTime,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "bookings"), bookingData);
      const bookingId = docRef.id;

        // อัปเดตสถานะรถเป็น pending ทันทีหลังจอง
        try {
          const { doc, updateDoc } = await import("firebase/firestore");
          await updateDoc(doc(db, "vehicles", selectedVehicle), { status: "pending" });
        } catch (e) {
          console.warn("อัปเดตสถานะรถไม่สำเร็จ", e);
        }

      setMessage("ส่งคำขอจองรถสำเร็จ!");
      // Reset form
      setSelectedVehicle("");
      setDestination("");
      setMileage("");
      setOriginalMileage(null);
      setIsMileageEditing(false);
      setPurpose("");
  setStartDate(new Date().toISOString().slice(0, 10));
    // reset start time to midnight
    setStartTime('00:00');
      setIsLoading(false);

      // Trigger LINE notification (fire-and-forget) only if settings allow
      try {
        const settingsRes = await fetch('/api/notifications/settings');
        const settings = await settingsRes.json().catch(() => ({}));
        const roles = settings.roles || {};
        // if any role has booking_created enabled, proceed
        const anyEnabled = ['admin', 'driver', 'employee'].some(r => {
          const roleSettings = roles[r] || {};
          return typeof roleSettings['booking_created'] === 'boolean' ? roleSettings['booking_created'] : true;
        });
        if (anyEnabled) {
          const notifyPayload = {
            event: 'booking_created',
            booking: {
              id: bookingId,
              requesterName: bookingData.requesterName,
              userEmail: bookingData.userEmail,
              vehicleLicensePlate: bookingData.vehicleLicensePlate,
              startDateTime: startDateTime instanceof Date ? startDateTime.toISOString() : new Date(startDateTime).toISOString()
            }
          };
          // fire-and-forget
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notifyPayload)
          }).catch((e) => console.warn('notify send error', e));
        } else {
          console.debug('Notification for booking_created disabled in settings — skipping send');
        }
      } catch (e) {
        console.warn('notify prepare error', e);
      }

      // navigate to bookings list so the user sees their request
      router.push('/my-bookings');
    } catch (error) {
      console.error("Error creating booking: ", error);
      setMessage("เกิดข้อผิดพลาดในการส่งคำขอ");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* เลือกรถ - custom dropdown with images */}
        <div>
          <label className="block text-sm font-medium text-teal-700 mb-1">เลือกรถ</label>
          <div className="relative" ref={containerRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              onClick={() => setIsOpen(o => !o)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white text-left"
            >
              <div className="flex items-center gap-3">
                {selectedVehicle ? (
                  (() => {
                    const sel = vehicles.find(v => v.id === selectedVehicle);
                    if (!sel) return <span className="text-gray-500">-- เลือกรถ --</span>;
                    return (
                      <>
            {getImageUrl(sel) ? (
              <Image src={getImageUrl(sel)} alt={`${sel.brand} ${sel.model}`} width={40} height={32} className="object-cover rounded-md border" unoptimized />
                        ) : (
                          <div className="w-10 h-8 bg-gray-200 rounded-md flex items-center justify-center text-xs text-gray-500 border">ไม่มีรูป</div>
                        )}
                        <div className="text-sm">
                          <div className="font-medium">{sel.brand} {sel.model}</div>
                          <div className="text-xs text-gray-600">{sel.licensePlate}</div>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <span className="text-gray-500">-- เลือกรถ --</span>
                )}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {/* dropdown list */}
            <div className={`absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded shadow-lg max-h-64 overflow-auto ${isOpen ? '' : 'hidden'}`} role="listbox">
              {vehicles.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">ไม่มีรถว่าง</div>
              ) : vehicles.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setSelectedVehicle(v.id); setIsOpen(false); setMileage(v.currentMileage ?? ''); }}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                >
                  {getImageUrl(v) ? (
                    <Image src={getImageUrl(v)} alt={`${v.brand} ${v.model}`} width={48} height={32} className="object-cover rounded-md border" unoptimized />
                  ) : (
                    <div className="w-12 h-8 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-500 border">ไม่มีรูป</div>
                  )}
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{v.brand} {v.model}</div>
                    <div className="text-xs text-gray-600">{v.licensePlate}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* (เลขไมล์) - แสดง/แก้ไขที่ส่วนถัดไป */}
        <div>
          <label className="block text-sm font-medium text-teal-700 mb-1">เลขไมล์</label>

          {!isMileageEditing ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">{mileage || '-'}</div>
              <button type="button" onClick={() => setIsMileageEditing(true)} className="p-3 bg-gray-100 text-black rounded">แก้ไข</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg" />
              <button type="button" onClick={() => { setIsMileageEditing(false); }} className="p-3 bg-gray-200 rounded">ยกเลิก</button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-1">จุดหมาย</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="ระบุ"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>
        </div>

        {/* กำหนดการ (วันที่เริ่ม - วันที่สิ้นสุด) */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-1">วันที่จะใช้รถ</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <input
                type="time"
                value={startTime || ''}
                onChange={e => setStartTime(e.target.value)}
                className="w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>
        </div>


        {/* วัตถุประสงค์ */}
        <div>
          <label className="block text-sm font-medium text-teal-700 mb-1">วัตถุประสงค์</label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="ระบุวัตถุประสงค์การใช้รถ..."
            rows="4"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </div>

        {message && (
          <p className={`text-sm text-center ${message.includes('สำเร็จ') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-all disabled:bg-gray-400"
        >
          {isLoading ? 'กำลังส่ง...' : 'ยืนยันจองรถ'}
        </button>
      </form>
    </div>
  );
}
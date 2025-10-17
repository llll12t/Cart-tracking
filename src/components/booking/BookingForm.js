// src/components/booking/BookingForm.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";

export default function BookingForm() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mileage, setMileage] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ดึงรายการรถที่พร้อมใช้งาน
  useEffect(() => {
    const q = query(collection(db, "vehicles"), where("status", "==", "available"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vehiclesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vehiclesData);
    });
    return unsubscribe;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVehicle || !origin || !destination || !startDateTime || !endDateTime) {
      setMessage("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (!user) {
      setMessage("ไม่พบข้อมูลผู้ใช้ กรุณาลองเข้าสู่ระบบใหม่");
      return;
    }

    setIsLoading(true);
    try {
      const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);
      
      const bookingData = {
        userId: user.uid,
        userEmail: user.email,
        vehicleId: selectedVehicle,
        vehicleLicensePlate: selectedVehicleData?.licensePlate,
        origin,
        destination,
        purpose,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        status: "pending",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "bookings"), bookingData);

      setMessage("ส่งคำขอจองรถสำเร็จ!");
      // Reset form
      setSelectedVehicle("");
      setOrigin("");
      setDestination("");
      setMileage("");
      setPurpose("");
      setStartDateTime("");
      setEndDateTime("");
      setIsLoading(false);
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
                        {sel.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sel.imageUrl} alt={`${sel.brand} ${sel.model}`} className="w-10 h-8 object-cover rounded-md border" />
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
                  onClick={() => { setSelectedVehicle(v.id); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                >
                  {v.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.imageUrl} alt={`${v.brand} ${v.model}`} className="w-12 h-8 object-cover rounded-md border" />
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

        {/* จุดเริ่ม และ จุดหมาย */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-1">จุดเริ่ม</label>
            <input 
              type="text" 
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="กรุงเทพ"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-1">จุดหมาย</label>
            <input 
              type="text" 
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="เชียงใหม่"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>
        </div>

        {/* เลขไมล์ */}
        <div>
          <label className="block text-sm font-medium text-teal-700 mb-1">เลขไมล์</label>
          <input 
            type="number" 
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="10000"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* กำหนดการเดินทาง */}
        <div>
          <label className="block text-sm font-medium text-teal-700 mb-1">กำหนดการเดินทาง</label>
          <div className="grid grid-cols-2 gap-4">
            <input 
              type="datetime-local" 
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
            <input 
              type="datetime-local" 
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">ถึง</p>
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
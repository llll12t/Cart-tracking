// src/components/booking/BookingForm.js
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";

export default function BookingForm() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
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
        {/* เลือกรถ */}
        <div>
          <label className="block text-sm font-medium text-teal-700 mb-1">เลือกรถ</label>
          <select 
            value={selectedVehicle} 
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-700"
            required
          >
            <option value="">-- เลือกรถ --</option>
            {vehicles.map(vehicle => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.brand} {vehicle.model} - {vehicle.licensePlate}
              </option>
            ))}
          </select>
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
          {isLoading ? 'กำลังส่ง...' : '+ เพิ่มค่าใช้จ่าย'}
        </button>
      </form>
    </div>
  );
}
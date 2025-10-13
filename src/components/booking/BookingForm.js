// src/components/booking/BookingForm.js
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function BookingForm() {
  const { user } = useAuth();
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destination || !purpose || !startDateTime || !endDateTime) {
      setMessage("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (!user) {
      setMessage("ไม่พบข้อมูลผู้ใช้ กรุณาลองเข้าสู่ระบบใหม่");
      return;
    }

    try {
      const bookingData = {
        userId: user.uid,
        userEmail: user.email,
        destination,
        purpose,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        status: "pending", // สถานะเริ่มต้นคือรอดำเนินการ
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "bookings"), bookingData);

      setMessage("ส่งคำขอจองรถสำเร็จ!");
      // Reset form
      setDestination("");
      setPurpose("");
      setStartDateTime("");
      setEndDateTime("");
    } catch (error) {
      console.error("Error creating booking: ", error);
      setMessage("เกิดข้อผิดพลาดในการส่งคำขอ");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-md"
    >
      <div className="space-y-2">
        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-gray-700">ปลายทาง</label>
          <input id="destination" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">วัตถุประสงค์</label>
          <textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
          <label htmlFor="startDateTime" className="block text-sm font-medium text-gray-700">วัน-เวลาที่เริ่มใช้</label>
          <input id="startDateTime" type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
          <label htmlFor="endDateTime" className="block text-sm font-medium text-gray-700">วัน-เวลาที่สิ้นสุด</label>
          <input id="endDateTime" type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
      </div>

      {message && <p className="text-sm text-center text-green-600">{message}</p>}

      <button type="submit" className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        ส่งคำขอจองรถ
      </button>
    </form>
  );
}
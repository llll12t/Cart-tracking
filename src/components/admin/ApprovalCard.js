"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";

// Modal Component
function AssignVehicleModal({ booking, onClose, onAssign }) {
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch available vehicles
      const vehicleQuery = query(collection(db, "vehicles"), where("status", "==", "available"));
      const vehicleSnapshot = await getDocs(vehicleQuery);
      const vehicles = vehicleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableVehicles(vehicles);

      // Fetch available drivers
      const driverQuery = query(collection(db, "users"), where("role", "==", "driver"));
      const driverSnapshot = await getDocs(driverQuery);
      const drivers = driverSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableDrivers(drivers);
      
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleAssign = () => {
    if (!selectedVehicleId || !selectedDriverId) {
      alert("กรุณาเลือกรถและคนขับ");
      return;
    }
    const selectedVehicle = availableVehicles.find(v => v.id === selectedVehicleId);
    const selectedDriver = availableDrivers.find(d => d.id === selectedDriverId);
    onAssign(selectedVehicle, selectedDriver);
  };

  if (loading) return <div className="p-4">Loading available assets...</div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold mb-4">มอบหมายรถสำหรับ Booking ID: {booking.id.substring(0, 6)}...</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">เลือกรถที่ว่าง</label>
            <select onChange={(e) => setSelectedVehicleId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
              <option value="">-- เลือกรถ --</option>
              {availableVehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.licensePlate})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">เลือกคนขับ</label>
            <select onChange={(e) => setSelectedDriverId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
              <option value="">-- เลือกคนขับ --</option>
              {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">ยกเลิก</button>
          <button onClick={handleAssign} className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">ยืนยันการมอบหมาย</button>
        </div>
      </div>
    </div>
  );
}

// ApprovalCard Component
export default function ApprovalCard({ booking }) {
  const [showModal, setShowModal] = useState(false);

  const formatDate = (timestamp) => new Date(timestamp.seconds * 1000).toLocaleString('th-TH');

  const handleApprove = async (vehicle, driver) => {
    try {
      // Use a batch write to update multiple documents atomically
      const batch = writeBatch(db);

      // 1. Update the booking document
      const bookingRef = doc(db, "bookings", booking.id);
      batch.update(bookingRef, {
        status: "approved",
        vehicleId: vehicle.id,
        vehicleLicensePlate: vehicle.licensePlate, // Store for easy display
        driverId: driver.id,
        driverName: driver.name, // Store for easy display
      });

      // 2. Update the vehicle's status
      const vehicleRef = doc(db, "vehicles", vehicle.id);
      batch.update(vehicleRef, {
        status: "in_use"
      });
      
      await batch.commit();
      setShowModal(false);

    } catch (error) {
      console.error("Error approving booking: ", error);
      alert("Failed to approve booking.");
    }
  };

  const handleReject = async () => {
    if (window.confirm("คุณต้องการปฏิเสธคำขอนี้ใช่หรือไม่?")) {
        try {
            const bookingRef = doc(db, "bookings", booking.id);
            await updateDoc(bookingRef, {
                status: "rejected",
            });
        } catch (error) {
            console.error("Error rejecting booking: ", error);
            alert("Failed to reject booking.");
        }
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-400">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm text-gray-500">ผู้ขอ: {booking.userEmail}</p>
                <h3 className="text-lg font-bold text-gray-800 mt-1">{booking.destination}</h3>
                <p className="text-sm text-gray-600 mt-1">วัตถุประสงค์: {booking.purpose}</p>
            </div>
            <div className="text-right">
                <p className="text-sm"><strong>เริ่ม:</strong> {formatDate(booking.startDateTime)}</p>
                <p className="text-sm"><strong>สิ้นสุด:</strong> {formatDate(booking.endDateTime)}</p>
            </div>
        </div>
        <div className="mt-4 pt-4 border-t flex justify-end gap-4">
            <button onClick={handleReject} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
                ปฏิเสธ
            </button>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                อนุมัติ
            </button>
        </div>
      </div>
      {showModal && <AssignVehicleModal booking={booking} onClose={() => setShowModal(false)} onAssign={handleApprove} />}
    </>
  );
}
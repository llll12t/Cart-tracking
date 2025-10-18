"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";
import Image from 'next/image';

// Modal Component
function AssignVehicleModal({ booking, onClose, onAssign }) {
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [assignOther, setAssignOther] = useState(false); // whether admin wants to pick a different driver
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

      // Try to pre-select requester as driver when possible
      try {
        const requesterEmail = booking.userEmail || booking.requesterEmail || booking.requester?.email;
        if (requesterEmail) {
          const found = drivers.find(d => d.email === requesterEmail);
          if (found) {
            setSelectedDriverId(found.id);
            setAssignOther(false);
          } else {
            setAssignOther(true);
          }
        } else {
          setAssignOther(true);
        }
      } catch (e) {
        // fallback: allow selecting other
        setAssignOther(true);
      }
      
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 overflow-auto max-h-[85vh]">
        <h3 className="text-xl font-bold mb-4">มอบหมายรถสำหรับ Booking ID: {booking.id.substring(0, 6)}...</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">เลือกรถที่ว่าง</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableVehicles.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicleId(v.id)}
                  className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition ${selectedVehicleId === v.id ? 'border-blue-600 shadow-sm' : 'border-gray-200 hover:shadow-sm'}`}
                >
                  {/* vehicle image */}
                  {v.imageUrl ? (
                    <Image src={v.imageUrl} alt={`${v.brand} ${v.model}`} width={80} height={56} className="object-cover rounded" unoptimized />
                  ) : (
                    <div className="w-20 h-14 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">No Image</div>
                  )}
                  <div className="text-sm">
                    <div className="font-medium">{v.brand} {v.model}</div>
                    <div className="text-xs text-gray-600">{v.licensePlate}</div>
                    <div className="text-xs text-gray-600">ไมล์: {v.currentMileage ?? '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">คนขับที่ถูกมอบหมาย</p>
            {/* If requester is a driver and wasn't marked as assignOther, show requester as default */}
            {!assignOther && selectedDriverId && (() => {
              const d = availableDrivers.find(x => x.id === selectedDriverId);
              if (d) {
                return (
                  <div className="flex items-center gap-3 p-3 border rounded-md">
                    {d.imageUrl ? (
                      <Image src={d.imageUrl} alt={d.name} width={48} height={48} className="rounded-full object-cover" unoptimized />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">{(d.name || d.email || 'U')[0]}</div>
                    )}
                    <div className="text-sm">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-gray-600">{d.email}</div>
                      <div className="text-xs text-gray-600">{d.position || ''}</div>
                    </div>
                    <div className="ml-auto">
                      <button onClick={() => setAssignOther(true)} className="px-3 py-1 text-sm bg-gray-100 rounded-md">มอบหมายคนอื่น</button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* If admin wants to pick other drivers, show grid */}
            {(assignOther || !selectedDriverId) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableDrivers.map(d => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDriverId(d.id)}
                    className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition ${selectedDriverId === d.id ? 'border-blue-600 shadow-sm' : 'border-gray-200 hover:shadow-sm'}`}
                  >
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.imageUrl} alt={d.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">{(d.name || d.email || 'U')[0]}</div>
                    )}
                    <div className="text-sm">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-gray-600">{d.email}</div>
                      <div className="text-xs text-gray-600">{d.position || ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
      <div className="bg-white p-5 rounded-lg shadow-sm border hover:shadow-md transition">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">ผู้ขอ: <span className="font-medium text-gray-800">{booking.requesterName || booking.userEmail}</span></p>
                <h3 className="text-md font-bold text-gray-800 mt-1">{booking.destination}</h3>
              </div>
              <div className="text-right text-xs text-gray-600">
                <div>สร้าง: {booking.createdAt ? new Date(booking.createdAt.seconds * 1000).toLocaleString('th-TH') : '-'}</div>
                <div className="mt-1">ID: <span className="font-mono text-xs">{booking.id.substring(0,6)}</span></div>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-600 space-y-2">
              <div><strong>ต้นทาง:</strong> {booking.origin || '-'}</div>
              <div><strong>ปลายทาง:</strong> {booking.destination || '-'}</div>
              <div><strong>วันที่เดินทาง:</strong> {booking.startDateTime ? formatDate(booking.startDateTime) : '-'} {booking.endDateTime ? ` — ${formatDate(booking.endDateTime)}` : ''}</div>
              <div><strong>จำนวนผู้โดยสาร:</strong> {booking.passengers || '-'}</div>
              <div><strong>ประเภทรถที่ต้องการ:</strong> {booking.vehicleType || '-'}</div>
              <div><strong>วัตถุประสงค์:</strong> <span className="text-gray-700">{booking.purpose || '-'}</span></div>
              {booking.notes && <div><strong>หมายเหตุ:</strong> {booking.notes}</div>}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex justify-end gap-3">
          <button onClick={handleReject} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
            ปฏิเสธ
          </button>
          <button onClick={() => setShowModal(true)} className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
            มอบหมาย / อนุมัติ
          </button>
        </div>
      </div>
      {showModal && <AssignVehicleModal booking={booking} onClose={() => setShowModal(false)} onAssign={handleApprove} />}
    </>
  );
}
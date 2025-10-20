"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import Image from 'next/image';

// Modal Component
function AssignVehicleModal({ booking, onClose, onAssign }) {
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  // Hide the full vehicle list UI by default (user requested to keep it hidden)
  const [showVehicleList, setShowVehicleList] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [assignOther, setAssignOther] = useState(false); // whether admin wants to pick a different driver
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch available vehicles
      const vehicleQuery = query(collection(db, "vehicles"), where("status", "==", "available"));
      const vehicleSnapshot = await getDocs(vehicleQuery);
      const vehicles = vehicleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // If booking already has a vehicleId or vehicleLicensePlate, try to preselect it and move to front
      let ordered = vehicles;
      try {
        const bookedId = booking.vehicleId;
        const bookedPlate = booking.vehicleLicensePlate;
        if (bookedId || bookedPlate) {
          const matchIndex = vehicles.findIndex(v => (bookedId && v.id === bookedId) || (bookedPlate && v.licensePlate === bookedPlate));
          if (matchIndex > -1) {
            const [matched] = vehicles.splice(matchIndex, 1);
            ordered = [matched, ...vehicles];
          }
        }
      } catch (e) {
        // ignore ordering errors
      }
      setAvailableVehicles(ordered);

      // preselect the vehicle id if found
      try {
        const bookedId = booking.vehicleId;
        const bookedPlate = booking.vehicleLicensePlate;
        if (bookedId) {
          setSelectedVehicleId(bookedId);
        } else if (bookedPlate) {
          const found = ordered.find(v => v.licensePlate === bookedPlate);
          if (found) setSelectedVehicleId(found.id);
        }
      } catch (e) {
        // ignore
      }

      // if a vehicle was preselected, hide the full list initially
      try {
        if (booking.vehicleId || booking.vehicleLicensePlate) setShowVehicleList(false);
      } catch (e) {}

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

        <div className={`grid grid-cols-1 ${showVehicleList ? 'md:grid-cols-2' : ''} gap-6`}>
          {showVehicleList && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">เลือกรถที่ว่าง</p>
              {/* If a vehicle is preselected, hide the full grid until admin chooses to change it */}
              {!showVehicleList ? null : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableVehicles.map(v => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVehicleId(v.id)}
                      className={`flex items-center gap-3 p-3 shadow-sm rounded-md cursor-pointer transition ${selectedVehicleId === v.id ? 'border-blue-600' : 'border-gray-200 hover:shadow-md'}`}
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
              )}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">คนขับที่ถูกมอบหมาย</p>
            {/* Show selected vehicle preview similar to the selected driver */}
            {selectedVehicleId && (() => {
              const sv = availableVehicles.find(x => x.id === selectedVehicleId);
              if (sv) {
                return (
                  <div className="flex items-center gap-3 p-3 border rounded-md mb-3">
                    {sv.imageUrl ? (
                      <Image src={sv.imageUrl} alt={`${sv.brand} ${sv.model}`} width={80} height={56} className="object-cover rounded" unoptimized />
                    ) : (
                      <div className="w-20 h-14 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">No Image</div>
                    )}
                    <div className="text-sm">
                      <div className="font-medium">{sv.brand} {sv.model}</div>
                      <div className="text-xs text-gray-600">{sv.licensePlate}</div>
                      <div className="text-xs text-gray-600">ไมล์: {sv.currentMileage ?? '-'}</div>
                    </div>
                    <div className="ml-auto">
                      <button onClick={() => { setSelectedVehicleId(''); setShowVehicleList(true); }} className="px-3 py-1 text-sm bg-gray-100 rounded-md">เปลี่ยนรถ</button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
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
  const [requesterNameState, setRequesterNameState] = useState(booking.requesterName || '');

  // แสดงเฉพาะวันที่ (ไม่รวมเวลา)
  const formatDateOnly = (value) => {
    if (!value) return '-';
    try {
      let d;
      if (value.seconds) d = new Date(value.seconds * 1000);
      else if (value.toDate) d = new Date(value.toDate());
      else d = value instanceof Date ? value : new Date(value);
      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH');
    } catch (e) {
      return '-';
    }
  };

  // If booking doesn't include requesterName but has userId, try to fetch user's name
  useEffect(() => {
    let mounted = true;
    async function fetchRequester() {
      if (requesterNameState) return;
      try {
        if (booking.userId) {
          const uRef = doc(db, 'users', booking.userId);
          const uSnap = await getDoc(uRef);
          if (uSnap.exists() && mounted) {
            const data = uSnap.data();
            if (data.name || data.displayName) setRequesterNameState(data.name || data.displayName);
          }
        } else if (booking.userEmail) {
          // try lookup by email
          const q = query(collection(db, 'users'), where('email', '==', booking.userEmail));
          const snaps = await getDocs(q);
          if (!snaps.empty && mounted) {
            const u = snaps.docs[0].data();
            if (u.name || u.displayName) setRequesterNameState(u.name || u.displayName);
          }
        }
      } catch (e) {
        // ignore
      }
    }
    fetchRequester();
    return () => { mounted = false; };
  }, [booking.userId, booking.userEmail, requesterNameState]);

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

  // ลบคำขอ
  const handleDelete = async () => {
    if (window.confirm("⚠️ การลบนี้จะลบคำขอออกจากระบบถาวรและไม่สามารถกู้คืนได้\n\nคุณต้องการลบคำขอนี้จริงหรือไม่?")) {
      try {
        const bookingRef = doc(db, "bookings", booking.id);
        await (await import("firebase/firestore")).deleteDoc(bookingRef);
        alert("ลบคำขอเรียบร้อยแล้ว");
      } catch (error) {
        console.error("Error deleting booking: ", error);
        alert("Failed to delete booking.");
      }
    }
  };

  return (
    <>
      <div className="bg-white p-5 rounded-lg shadow-sm  hover:shadow-md transition">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">ผู้ขอ: <span className="font-medium text-gray-800">{requesterNameState || booking.requesterName || booking.userEmail}</span></p>
                <h3 className="text-md font-bold text-gray-800 mt-1">
                  {booking.driverName ? (
                    `${booking.driverName} — ${booking.vehicleLicensePlate || booking.vehicleId || ''} — ${requesterNameState || booking.requesterName || booking.userEmail}`
                  ) : (
                    (booking.vehicleLicensePlate || booking.vehicleId) ? `${booking.vehicleLicensePlate || booking.vehicleId} — ${requesterNameState || booking.requesterName || booking.userEmail}` : (requesterNameState || booking.requesterName || booking.userEmail)
                  )}
                </h3>
              </div>
              <div className="text-right text-xs text-gray-600">
                <div>สร้าง: {booking.createdAt ? new Date(booking.createdAt.seconds * 1000).toLocaleString('th-TH') : '-'}</div>
                <div className="mt-1">ID: <span className="font-mono text-xs">{booking.id.substring(0,6)}</span></div>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-600 space-y-2">
              <div><strong>ต้นทาง:</strong> {booking.origin || '-'}</div>
              <div><strong>ปลายทาง:</strong> {booking.destination || '-'}</div>
              <div>
                <strong>วันที่เริ่มต้น:</strong>{' '}
                {booking.startDate || booking.startDateTime ? formatDateOnly(booking.startDate || booking.startDateTime) : '-'}
              </div>
              <div>
                <strong>วันที่สิ้นสุด:</strong>{' '}
                {booking.endDate || booking.endDateTime ? formatDateOnly(booking.endDate || booking.endDateTime) : '-'}
              </div>
              {/* จำนวนผู้โดยสาร และ ประเภทรถที่ต้องการ ถูกเอาออกตามคำขอ */}
              <div><strong>รถที่เลือก/ทะเบียน:</strong> {booking.vehicleLicensePlate || booking.vehicleId || '-'}</div>
              <div><strong>วัตถุประสงค์:</strong> <span className="text-gray-700">{booking.purpose || '-'}</span></div>
              {booking.notes && <div><strong>หมายเหตุ:</strong> {booking.notes}</div>}

              {/* validation issues (if any) */}
              {booking.issues && booking.issues.length > 0 && (
                <div className="mt-2">
                  <strong className="text-red-600">ตรวจพบปัญหา:</strong>
                  <ul className="list-disc list-inside text-sm text-red-600 mt-1">
                    {booking.issues.map((it, idx) => <li key={idx}>{it}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex justify-end gap-3">
          <button onClick={handleDelete} className="px-3 py-2 text-sm font-medium text-white bg-gray-500 rounded-md hover:bg-gray-700">
            ลบคำขอ
          </button>
          <button onClick={handleReject} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
            ปฏิเสธ
          </button>
          <button onClick={() => {
            const liffId = process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID;
            if (liffId) {
              const liffUrl = `https://liff.line.me/${liffId}?liff.state=/confirm/${booking.id}`;
              window.open(liffUrl, '_blank');
            } else {
              const url = `/confirm/${booking.id}`;
              window.open(url, '_blank');
            }
          }} className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
            อนุมัติ (ผ่าน LIFF)
          </button>
        </div>
      </div>
  {/* AssignVehicleModal intentionally no longer opened from this card; approval now handled via LIFF confirm page */}
    </>
  );
}
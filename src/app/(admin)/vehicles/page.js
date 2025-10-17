"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AddVehicleForm from "@/components/admin/AddVehicleForm";
import Link from "next/link";

function VehicleList({ vehicles }) {
  const getStatusClass = (status) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "in_use":
      case "on_trip":
        return "bg-yellow-100 text-yellow-800";
      case "maintenance":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "available":
        return "พร้อมใช้งาน";
      case "in_use":
        return "กำลังถูกใช้งาน";
      case "on_trip":
        return "อยู่ระหว่างเดินทาง";
      case "maintenance":
        return "ซ่อมบำรุง";
      default:
        return "ไม่ทราบสถานะ";
    }
  };

  if (vehicles.length === 0) {
    return (
      <div className="mt-8 text-center text-gray-500">ไม่มีรถในระบบ</div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {vehicles.map((vehicle) => (
        <div key={vehicle.id} className="bg-white rounded-xl shadow-md p-4 flex flex-col">
          <div className="flex gap-4 items-center">
            {vehicle.imageUrl ? (
              <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} className="w-24 h-16 object-cover rounded-lg border" />
            ) : (
              <div className="w-24 h-16 bg-gray-200 flex items-center justify-center text-xs text-gray-500 rounded-lg border">ไม่มีรูป</div>
            )}
            <div className="flex-1">
              <div className="font-bold text-lg">{vehicle.brand} {vehicle.model}</div>
              <div className="text-sm text-gray-600">ทะเบียน: <span className="font-semibold">{vehicle.licensePlate}</span></div>
              <div className="text-sm text-gray-600">ประเภท: <span className="font-semibold">{vehicle.type}</span></div>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(vehicle.status)}`}>
              {getStatusLabel(vehicle.status)}
            </span>
            <div className="flex gap-2">
              <Link
                href={`/vehicles/${vehicle.id}/edit`}
                className="px-3 py-1 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200"
              >
                แก้ไข
              </Link>
              <Link
                href={`/vehicles/${vehicle.id}/maintenance`}
                className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              >
                ดูประวัติซ่อม
              </Link>
              <Link
                href={`/vehicles/${vehicle.id}/fuel`}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                ประวัติน้ำมัน
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VehiclesPage() {
  const [showForm, setShowForm] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "vehicles"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const vehiclesData = [];
      querySnapshot.forEach((doc) => {
        vehiclesData.push({ id: doc.id, ...doc.data() });
      });
      setVehicles(vehiclesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">จัดการรถในระบบ</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + เพิ่มรถใหม่
        </button>
      </div>

      {showForm && (
        <div className="mb-8">
          <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6">
            <AddVehicleForm onClose={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-6">กำลังโหลดข้อมูลรถ...</p>
      ) : (
        <VehicleList vehicles={vehicles} />
      )}
    </div>
  );
}
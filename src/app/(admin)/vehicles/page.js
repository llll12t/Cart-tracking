"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AddVehicleForm from "@/components/admin/AddVehicleForm";
import Link from "next/link";

// Component for the vehicle list table
function VehicleList({ vehicles }) {
  const getStatusClass = (status) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "in_use":
        return "bg-yellow-100 text-yellow-800";
      case "maintenance":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="mt-6 overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full text-sm text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3">ทะเบียน</th>
            <th scope="col" className="px-6 py-3">ยี่ห้อ / รุ่น</th>
            <th scope="col" className="px-6 py-3">ประเภท</th>
            <th scope="col" className="px-6 py-3">สถานะ</th>
            <th scope="col" className="px-6 py-3">Action</th>
          </tr>
        </thead>
        {/* Make sure there are no comments or whitespace here */}
        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id} className="bg-white border-b hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">{vehicle.licensePlate}</td>
              <td className="px-6 py-4">{vehicle.brand} {vehicle.model}</td>
              <td className="px-6 py-4">{vehicle.type}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(vehicle.status)}`}>
                  {vehicle.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <Link
                  href={`/vehicles/${vehicle.id}/maintenance`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  ดูประวัติซ่อม
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Main Page Component
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">จัดการรถในระบบ</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + เพิ่มรถใหม่
        </button>
      </div>

      {showForm && <AddVehicleForm onClose={() => setShowForm(false)} />}

      {loading ? (
        <p className="mt-6">กำลังโหลดข้อมูลรถ...</p>
      ) : (
        <VehicleList vehicles={vehicles} />
      )}
    </div>
  );
}
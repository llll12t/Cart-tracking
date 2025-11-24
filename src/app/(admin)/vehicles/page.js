"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import Image from 'next/image';

// --- Icons ---
const Icons = {
  Car: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  Plus: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  PencilSquare: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  Wrench: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  BuildingStorefront: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  ),
  Beaker: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
  Drop: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
    </svg>
  ),
  User: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  Tag: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.593l6.202-2.073c.827-.276.933-1.357.234-2.056l-9.581-9.581a2.25 2.25 0 00-1.591-.659z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  )
};

// --- Helper Functions ---
const getStatusConfig = (status) => {
  switch (status) {
    case "available":
      return { label: "พร้อมใช้งาน", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" };
    case "pending":
      return { label: "รออนุมัติ", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    case "in_use":
    case "in-use":
      return { label: "กำลังใช้งาน", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" };
    case "on_trip":
    case "on-trip":
      return { label: "เดินทาง", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
    case "maintenance":
      return { label: "ซ่อมบำรุง", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
    case "retired":
      return { label: "ปลดระวาง", bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" };
    default:
      return { label: status || "ไม่ระบุ", bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
  }
};

// --- Components ---

function ActionButton({ href, icon: Icon, colorClass, label }) {
  return (
    <Link href={href} className={`p-2 rounded-lg transition-colors ${colorClass} group relative`} title={label}>
      <Icon className="w-4 h-4" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}

function VehicleTable({ vehicles }) {
  return (
    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50/50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ยานพาหนะ</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้ขับขี่ / ใช้งาน</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ข้อมูลล่าสุด</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {vehicles.map((vehicle) => {
            const status = getStatusConfig(vehicle.status);
            return (
              <tr key={vehicle.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-12 w-16 flex-shrink-0 relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                      {vehicle.imageUrl ? (
                        <Image src={vehicle.imageUrl} alt={vehicle.model} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex items-center justify-center h-full w-full text-gray-400">
                          <Icons.Car className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{vehicle.brand} {vehicle.model}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Icons.Tag className="w-3 h-3" />
                        {vehicle.licensePlate}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.text} ${status.border}`}>
                    {status.label}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-600">
                    {vehicle.driver || vehicle.driverName ? (
                      <>
                        <Icons.User className="w-4 h-4 mr-1.5 text-gray-400" />
                        {vehicle.driver?.displayName || vehicle.driverName}
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-gray-500 space-y-1">
                  {vehicle.latestFuel && (
                    <div className="flex items-center gap-1 text-blue-600" title="เติมน้ำมันล่าสุด">
                      <Icons.Drop className="w-3 h-3" />
                      <span>{new Date(vehicle.latestFuel.timestamp?.seconds * 1000).toLocaleDateString('th-TH')}</span>
                    </div>
                  )}
                  {vehicle.latestMaintenance && (
                    <div className="flex items-center gap-1 text-red-600" title="ซ่อมล่าสุด">
                      <Icons.Wrench className="w-3 h-3" />
                      <span>{new Date(vehicle.latestMaintenance.amount ? Date.now() : 0).toLocaleDateString('th-TH')}</span> {/* Note: Timestamp logic might need adjustment based on actual data */}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <ActionButton href={`/vehicles/${vehicle.id}/edit`} icon={Icons.PencilSquare} colorClass="bg-teal-50 text-teal-600 hover:bg-teal-100" label="แก้ไข" />
                    <ActionButton href={`/vehicles/${vehicle.id}/maintenance`} icon={Icons.Wrench} colorClass="bg-indigo-50 text-indigo-600 hover:bg-indigo-100" label="ค่าใช้จ่าย" />
                    <ActionButton href={`/vehicles/${vehicle.id}/garage`} icon={Icons.BuildingStorefront} colorClass="bg-purple-50 text-purple-600 hover:bg-purple-100" label="ส่งซ่อม" />
                    <ActionButton href={`/vehicles/${vehicle.id}/fuel`} icon={Icons.Drop} colorClass="bg-blue-50 text-blue-600 hover:bg-blue-100" label="น้ำมัน" />
                    <ActionButton href={`/vehicles/${vehicle.id}/fluid`} icon={Icons.Beaker} colorClass="bg-yellow-50 text-yellow-600 hover:bg-yellow-100" label="ของเหลว" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VehicleCards({ vehicles }) {
  return (
    <div className="md:hidden grid grid-cols-1 gap-4">
      {vehicles.map((vehicle) => {
        const status = getStatusConfig(vehicle.status);
        return (
          <div key={vehicle.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex gap-4">
              <div className="h-20 w-24 flex-shrink-0 relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                {vehicle.imageUrl ? (
                  <Image src={vehicle.imageUrl} alt={vehicle.model} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex items-center justify-center h-full w-full text-gray-400">
                    <Icons.Car className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 truncate">{vehicle.brand} {vehicle.model}</h3>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Icons.Tag className="w-3 h-3" />
                      {vehicle.licensePlate}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${status.bg} ${status.text} ${status.border}`}>
                    {status.label}
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                  <Icons.User className="w-3 h-3 text-gray-400" />
                  <span className="truncate">{vehicle.driver?.displayName || vehicle.driverName || 'ไม่มีผู้ขับขี่'}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-5 gap-2">
              <Link href={`/vehicles/${vehicle.id}/edit`} className="flex flex-col items-center justify-center p-2 rounded bg-gray-50 text-gray-600 hover:bg-gray-100">
                <Icons.PencilSquare className="w-4 h-4" />
                <span className="text-[10px] mt-1">แก้ไข</span>
              </Link>
              <Link href={`/vehicles/${vehicle.id}/maintenance`} className="flex flex-col items-center justify-center p-2 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                <Icons.Wrench className="w-4 h-4" />
                <span className="text-[10px] mt-1">ซ่อม</span>
              </Link>
              <Link href={`/vehicles/${vehicle.id}/garage`} className="flex flex-col items-center justify-center p-2 rounded bg-purple-50 text-purple-600 hover:bg-purple-100">
                <Icons.BuildingStorefront className="w-4 h-4" />
                <span className="text-[10px] mt-1">อู่</span>
              </Link>
              <Link href={`/vehicles/${vehicle.id}/fuel`} className="flex flex-col items-center justify-center p-2 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                <Icons.Drop className="w-4 h-4" />
                <span className="text-[10px] mt-1">น้ำมัน</span>
              </Link>
              <Link href={`/vehicles/${vehicle.id}/fluid`} className="flex flex-col items-center justify-center p-2 rounded bg-yellow-50 text-yellow-600 hover:bg-yellow-100">
                <Icons.Beaker className="w-4 h-4" />
                <span className="text-[10px] mt-1">ของเหลว</span>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "vehicles"));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const vehiclesData = [];
      querySnapshot.forEach((doc) => {
        vehiclesData.push({ id: doc.id, ...doc.data() });
      });

      // enrich vehicles with driver name and latest fuel/fluid/maintenance log
      const enriched = await Promise.all(vehiclesData.map(async v => {
        // Driver info
        if (v.driverId) {
          try {
            const { doc, getDoc } = await import('firebase/firestore');
            const userRef = doc(db, 'users', v.driverId);
            const snap = await getDoc(userRef);
            if (snap.exists()) v.driver = { id: snap.id, ...snap.data() };
          } catch (e) { console.error('driver lookup failed', e); }
        }
        if (!v.driver && !v.driverName) {
          try {
            const fr = await import('firebase/firestore');
            const { collection: col, query: qfn, where, orderBy, limit, getDocs } = fr;
            const bookingsRef = col(db, 'bookings');
            const bq = qfn(bookingsRef, where('vehicleId', '==', v.id), where('status', 'in', ['approved', 'in_use', 'on_trip']), orderBy('createdAt', 'desc'), limit(1));
            const bSnap = await getDocs(bq);
            if (!bSnap.empty) {
              const bd = bSnap.docs[0].data();
              if (bd.driverId) {
                try {
                  const { doc: docFn, getDoc: getDocFn } = await import('firebase/firestore');
                  const userRef2 = docFn(db, 'users', bd.driverId);
                  const uSnap = await getDocFn(userRef2);
                  if (uSnap.exists()) v.driver = { id: uSnap.id, ...uSnap.data() };
                  else v.driverName = bd.driverName || bd.requesterName || '-';
                } catch (e) { v.driverName = bd.driverName || bd.requesterName || '-'; }
              } else { v.driverName = bd.driverName || bd.requesterName || '-'; }
            }
          } catch (e) { console.error('latest booking lookup failed', e); }
        }

        // Latest fuel/fluid/maintenance expense
        try {
          const fr = await import('firebase/firestore');
          const { collection: col, query: qfn, where, getDocs } = fr;
          const expensesRef = col(db, 'expenses');

          // Fuel
          try {
            const fuelQ = qfn(expensesRef, where('vehicleId', '==', v.id), where('type', '==', 'fuel'));
            const fuelSnap = await getDocs(fuelQ);
            if (!fuelSnap.empty) {
              const fuelDocs = fuelSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
                const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return bTime - aTime;
              });
              v.latestFuel = fuelDocs[0];
            }
          } catch (e) { console.error(`[ERROR] Failed to fetch fuel for vehicle ${v.id}:`, e.message); }

          // Fluid
          try {
            const fluidQ = qfn(expensesRef, where('vehicleId', '==', v.id), where('type', '==', 'fluid'));
            const fluidSnap = await getDocs(fluidQ);
            if (!fluidSnap.empty) {
              const fluidDocs = fluidSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
                const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return bTime - aTime;
              });
              v.latestFluid = fluidDocs[0];
            }
          } catch (e) { console.error(`[ERROR] Failed to fetch fluid for vehicle ${v.id}:`, e.message); }

          // Maintenance
          try {
            const maintenancesRef = col(db, 'maintenances');
            const maintenanceQ = qfn(maintenancesRef, where('vehicleId', '==', v.id));
            const maintenanceSnap = await getDocs(maintenanceQ);
            if (!maintenanceSnap.empty) {
              const maintenanceDocs = maintenanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
                const aTime = a.receivedAt?.toDate ? a.receivedAt.toDate() : (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0));
                const bTime = b.receivedAt?.toDate ? b.receivedAt.toDate() : (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0));
                return bTime - aTime;
              });
              const latest = maintenanceDocs[0];
              v.latestMaintenance = { mileage: latest.finalMileage || latest.odometerAtDropOff || null, amount: latest.finalCost || null, note: latest.type || latest.details || null };
            }
          } catch (e) { console.error(`[ERROR] Failed to fetch maintenance for vehicle ${v.id}:`, e.message); }
        } catch (e) { console.error('[ERROR] Failed to import firestore:', e); }

        return v;
      }));

      setVehicles(enriched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ยานพาหนะ</h1>
          <p className="text-gray-500 text-sm mt-1">จัดการข้อมูลรถและประวัติการซ่อมบำรุง</p>
        </div>
        <Link
          href="/vehicles/add"
          className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
        >
          <Icons.Plus className="w-5 h-5 mr-1.5" />
          เพิ่มรถใหม่
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icons.Car className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">ยังไม่มีรถในระบบ</h3>
          <p className="text-gray-500 mt-1">เริ่มต้นด้วยการเพิ่มรถคันแรกของคุณ</p>
        </div>
      ) : (
        <>
          <VehicleTable vehicles={vehicles} />
          <VehicleCards vehicles={vehicles} />
        </>
      )}
    </div>
  );
}
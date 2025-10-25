"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import Image from 'next/image';

function VehicleList({ vehicles }) {
  const getStatusClass = (status) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 border-green-300";
      case "pending":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "in_use":
      case "in-use":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "on_trip":
      case "on-trip":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "maintenance":
        return "bg-red-100 text-red-800 border-red-300";
      case "retired":
        return "bg-gray-300 text-gray-700 border-gray-400";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusLabel = (status) => {
    if (status === null || status === undefined || status === "") {
      return "ไม่ระบุสถานะ";
    }
    switch (status) {
      case "available":
        return "พร้อมใช้งาน";
      case "pending":
        return "อยู่ระหว่างรออนุมัติ";
      case "in_use":
      case "in-use":
        return "กำลังใช้งาน";
      case "on_trip":
      case "on-trip":
        return "อยู่ระหว่างเดินทาง";
      case "maintenance":
        return "ซ่อมบำรุง";
      case "retired":
        return "ปลดระวาง";
      default:
        return `สถานะ: ${status}`;
    }
  };

  if (vehicles.length === 0) {
    return (
      <div className="mt-8 text-center text-gray-500">ไม่มีรถในระบบ</div>
    );
  }

  // DEBUG: log vehicle id and latestFuel
  vehicles.forEach(v => {
    console.log(`[DEBUG] VehicleList id=${v.id} latestFuel=`, v.latestFuel);
  });
  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {vehicles.map((vehicle) => (
        <div key={vehicle.id} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col min-h-[320px] justify-between">
          <div className="flex gap-6 items-center mb-4 relative">
            {/* Status badge overlay on image */}
            <div className="absolute left-0 top-0 z-10">
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusClass(vehicle.status)}`}>
                {getStatusLabel(vehicle.status)}
              </span>
            </div>
            {vehicle.imageUrl ? (
              <Image src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} width={120} height={80} className="object-cover rounded-xl border" unoptimized />
            ) : (
              <div className="w-28 h-20 bg-gray-200 flex items-center justify-center text-xs text-gray-500 rounded-xl border">ไม่มีรูป</div>
            )}
            <div className="flex-1">
              <div className="font-bold text-lg mb-1">{vehicle.brand} {vehicle.model} <span className="text-sm text-gray-500">{vehicle.year}</span></div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mb-2">
                <div>ทะเบียน: <span className="font-semibold">{vehicle.licensePlate}</span></div>
                <div>สี: <span className="font-semibold">{vehicle.color || '-'}</span></div>
                <div>ประเภท: <span className="font-semibold">{vehicle.type}</span></div>
                {/* Latest fuel expense (always show) */}
                <div className="col-span-2 text-xs text-blue-700">
                  <span className="font-semibold">เติมน้ำมันล่าสุด:</span>
                  {vehicle.latestFuel ? (
                    <>
                      {vehicle.latestFuel.mileage ? <span className="ml-1">{vehicle.latestFuel.mileage.toLocaleString()} กม.</span> : <span className="ml-1">-</span>}
                      {vehicle.latestFuel.amount ? <span className="ml-2">{Number(vehicle.latestFuel.amount).toLocaleString()} ฿</span> : null}
                      {vehicle.latestFuel.note ? <span className="ml-2 text-gray-500">({vehicle.latestFuel.note})</span> : null}
                    </>
                  ) : <span className="ml-1">-</span>}
                </div>
                {/* Latest fluid change (always show) */}
                <div className="col-span-2 text-xs text-yellow-700">
                  <span className="font-semibold">เปลี่ยนของเหลวล่าสุด:</span>
                  {vehicle.latestFluid ? (
                    <>
                      {vehicle.latestFluid.mileage ? <span className="ml-1">{vehicle.latestFluid.mileage.toLocaleString()} กม.</span> : <span className="ml-1">-</span>}
                      {vehicle.latestFluid.amount ? <span className="ml-2">{Number(vehicle.latestFluid.amount).toLocaleString()} ฿</span> : null}
                      {vehicle.latestFluid.note ? <span className="ml-2 text-gray-500">({vehicle.latestFluid.note})</span> : null}
                    </>
                  ) : <span className="ml-1">-</span>}
                </div>
                {/* Latest maintenance (always show) */}
                <div className="col-span-2 text-xs text-red-700">
                  <span className="font-semibold">ซ่อมล่าสุด:</span>
                  {vehicle.latestMaintenance ? (
                    <>
                      {vehicle.latestMaintenance.mileage ? <span className="ml-1">{vehicle.latestMaintenance.mileage.toLocaleString()} กม.</span> : <span className="ml-1">-</span>}
                      {vehicle.latestMaintenance.amount ? <span className="ml-2">{Number(vehicle.latestMaintenance.amount).toLocaleString()} ฿</span> : null}
                      {vehicle.latestMaintenance.note ? <span className="ml-2 text-gray-500">({vehicle.latestMaintenance.note})</span> : null}
                    </>
                  ) : <span className="ml-1">-</span>}
                </div>
                {(() => {
                  let show = false;
                  let display = '';
                  if (vehicle.depreciationRate !== undefined && vehicle.depreciationRate !== null && vehicle.depreciationRate !== '') {
                    const r = Number(vehicle.depreciationRate) || 0;
                    if (r > 0) {
                      show = true;
                      display = `${r.toLocaleString('th-TH')} บ./กม.`;
                    }
                  }
                  if (!show) {
                    const purchasePrice = vehicle.purchasePrice ? Number(vehicle.purchasePrice) : null;
                    const salvage = vehicle.salvageValue ? Number(vehicle.salvageValue) : 0;
                    const expectedKm = vehicle.expectedLifetimeKm ? Number(vehicle.expectedLifetimeKm) : null;
                    const initialMileage = vehicle.initialMileage ? Number(vehicle.initialMileage) : 0;
                    const currentMileage = vehicle.currentMileage != null ? Number(vehicle.currentMileage) : null;
                    if (purchasePrice && expectedKm && expectedKm > 0) {
                      const rate = (purchasePrice - salvage) / expectedKm;
                      if (rate > 0) {
                        show = true;
                        if (currentMileage != null) {
                          const accumulated = Math.max(0, (currentMileage - initialMileage) * rate);
                          display = `${rate.toFixed(2)} บ./กม. (สะสม ${Number(accumulated).toLocaleString('th-TH')} บ.)`;
                        } else {
                          display = `${rate.toFixed(2)} บ./กม.`;
                        }
                      }
                    }
                  }
                  if (!show) return null;
                  return (
                    <div>
                      ค่าเสื่อม: <span className="font-semibold">{display}</span>
                    </div>
                  );
                })()}
              </div>
              {vehicle.note && <p className="mt-2 text-sm text-gray-500 truncate">หมายเหตุ: {vehicle.note}</p>}
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <div>ภาษีหมดอายุ: {vehicle.taxDueDate ? (new Date(vehicle.taxDueDate.seconds * 1000).toLocaleDateString('th-TH')) : '-'}</div>
                <div>ประกันหมดอายุ: {vehicle.insuranceExpireDate ? (new Date(vehicle.insuranceExpireDate.seconds * 1000).toLocaleDateString('th-TH')) : '-'}</div>
              </div>
            </div>
          </div>
          <div className="flex justify-end items-center mt-2 pt-2 border-t border-gray-100">
            <div className="flex gap-2">
              <Link
                href={`/vehicles/${vehicle.id}/edit`}
                className="px-3 py-3 rounded-md text-xs bg-teal-100 text-teal-700 hover:bg-teal-200"
              >
                แก้ไข
              </Link>
              <Link
                href={`/vehicles/${vehicle.id}/maintenance`}
                className="px-3 py-3 rounded-md text-xs bg-indigo-100 text-indigo hover:bg-indigo-200"
              >
                ค่าใช้จ่าย
              </Link>
              <Link
                href={`/vehicles/${vehicle.id}/garage`}
                className="px-3 py-3 rounded-md text-xs bg-purple-100 text-purple hover:bg-purple-200"
              >
                ส่งซ่อม
              </Link>
              <Link
                href={`/vehicles/${vehicle.id}/fuel`}
                className="px-3 py-3 rounded-md text-xs bg-green-100 text-green-7 hover:bg-green-200"
              >
                น้ำมัน
              </Link>
              <Link
                href={`/vehicles/${vehicle.id}/fluid`}
                className="px-3 py-3 rounded-md text-xs bg-yellow-100 text-yellow hover:bg-green-200"
              >
                ของเหลว
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VehiclesPage() {
  // Remove modal state for add vehicle
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
        console.log(`[DEBUG] Processing vehicle: id=${v.id}, licensePlate=${v.licensePlate}`);
        
        // Driver info (existing logic)
        if (v.driverId) {
          try {
            const { doc, getDoc } = await import('firebase/firestore');
            const userRef = doc(db, 'users', v.driverId);
            const snap = await getDoc(userRef);
            if (snap.exists()) v.driver = { id: snap.id, ...snap.data() };
          } catch (e) {
            console.error('driver lookup failed', e);
          }
        }
        if (!v.driver && !v.driverName) {
          try {
            const fr = await import('firebase/firestore');
            const { collection: col, query: qfn, where, orderBy, limit, getDocs } = fr;
            const bookingsRef = col(db, 'bookings');
            const bq = qfn(
              bookingsRef,
              where('vehicleId', '==', v.id),
              where('status', 'in', ['approved', 'in_use', 'on_trip']),
              orderBy('createdAt', 'desc'),
              limit(1)
            );
            const bSnap = await getDocs(bq);
            if (!bSnap.empty) {
              const bd = bSnap.docs[0].data();
              if (bd.driverId) {
                try {
                  const { doc: docFn, getDoc: getDocFn } = await import('firebase/firestore');
                  const userRef2 = docFn(db, 'users', bd.driverId);
                  const uSnap = await getDocFn(userRef2);
                  if (uSnap.exists()) {
                    v.driver = { id: uSnap.id, ...uSnap.data() };
                  } else {
                    v.driverName = bd.driverName || bd.requesterName || '-';
                  }
                } catch (e) {
                  v.driverName = bd.driverName || bd.requesterName || '-';
                }
              } else {
                v.driverName = bd.driverName || bd.requesterName || '-';
              }
            }
          } catch (e) {
            console.error('latest booking lookup failed', e);
          }
        }

        // Latest fuel/fluid/maintenance expense
        try {
          const fr = await import('firebase/firestore');
          const { collection: col, query: qfn, where, orderBy, limit, getDocs } = fr;
          const expensesRef = col(db, 'expenses');
          
          // Fuel - ดึงทั้งหมดแล้วเรียงเอง (หลีกเลี่ยง composite index)
          try {
            const fuelQ = qfn(
              expensesRef,
              where('vehicleId', '==', v.id),
              where('type', '==', 'fuel')
            );
            const fuelSnap = await getDocs(fuelQ);
            console.log(`[DEBUG] vehicleId=${v.id} fuel count:`, fuelSnap.size);
            if (!fuelSnap.empty) {
              // เรียงเองใน JavaScript
              const fuelDocs = fuelSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                  const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                  const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                  return bTime - aTime;
                });
              v.latestFuel = fuelDocs[0];
            }
          } catch (e) {
            console.error(`[ERROR] Failed to fetch fuel for vehicle ${v.id}:`, e.message);
          }
          
          // Fluid
          try {
            const fluidQ = qfn(
              expensesRef,
              where('vehicleId', '==', v.id),
              where('type', '==', 'fluid')
            );
            const fluidSnap = await getDocs(fluidQ);
            console.log(`[DEBUG] vehicleId=${v.id} fluid count:`, fluidSnap.size);
            if (!fluidSnap.empty) {
              const fluidDocs = fluidSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                  const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                  const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                  return bTime - aTime;
                });
              v.latestFluid = fluidDocs[0];
            }
          } catch (e) {
            console.error(`[ERROR] Failed to fetch fluid for vehicle ${v.id}:`, e.message);
          }
          
          // Maintenance - ดึงจาก collection maintenances
          try {
            const maintenancesRef = col(db, 'maintenances');
            const maintenanceQ = qfn(
              maintenancesRef,
              where('vehicleId', '==', v.id)
            );
            const maintenanceSnap = await getDocs(maintenanceQ);
            console.log(`[DEBUG] vehicleId=${v.id} maintenance count:`, maintenanceSnap.size);
            if (!maintenanceSnap.empty) {
              const maintenanceDocs = maintenanceSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                  // ใช้ receivedAt หรือ createdAt สำหรับเรียง
                  const aTime = a.receivedAt?.toDate ? a.receivedAt.toDate() : 
                                (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0));
                  const bTime = b.receivedAt?.toDate ? b.receivedAt.toDate() : 
                                (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0));
                  return bTime - aTime;
                });
              
              // ใช้ข้อมูลจาก maintenance record
              const latest = maintenanceDocs[0];
              v.latestMaintenance = {
                mileage: latest.finalMileage || latest.odometerAtDropOff || null,
                amount: latest.finalCost || null,
                note: latest.type || latest.details || null
              };
            }
          } catch (e) {
            console.error(`[ERROR] Failed to fetch maintenance for vehicle ${v.id}:`, e.message);
          }
        } catch (e) {
          console.error('[ERROR] Failed to import firestore:', e);
        }

        return v;
      }));

      setVehicles(enriched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <div className="flex items-center mb-6">
        <Link
          href="/vehicles/add"
          className="px-4 py-2 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          + เพิ่มรถใหม่
        </Link>
      </div>

      {loading ? (
        <p className="mt-6">กำลังโหลดข้อมูลรถ...</p>
      ) : (
        <VehicleList vehicles={vehicles} />
      )}
    </div>
  );
}
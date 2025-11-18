"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from 'next/image';

function getStatusLabel(status) {
  switch (status) {
    case "in-use": return "กำลังถูกใช้งาน";
    case "on-trip": return "อยู่ระหว่างเดินทาง";
    default: return "ไม่ทราบสถานะ";
  }
}

export default function VehiclesInUsePage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "vehicles"),
      where("status", "in", ["in-use", "on-trip"]) 
    );

    const unsubscribe = onSnapshot(q, async (qs) => {
      const list = [];
      for (const docSnap of qs.docs) {
        const data = { id: docSnap.id, ...docSnap.data() };
        // fetch active vehicle-usage for this vehicle
        try {
          const usageQ = query(
            collection(db, 'vehicle-usage'),
            where('vehicleId', '==', data.id),
            where('status', '==', 'active')
          );
          const usageSnap = await getDocs(usageQ);
          if (!usageSnap.empty) {
            const usageDoc = usageSnap.docs[0];
            const usageData = usageDoc.data();
            // set driver name from userName field in vehicle-usage
            data.driver = { name: usageData.userName };
            data.activeUsageId = usageDoc.id;
            
            // fetch expenses for this usage
            const expensesQ = query(
              collection(db, 'expenses'),
              where('usageId', '==', usageDoc.id),
              orderBy('timestamp', 'desc')
            );
            const expensesSnap = await getDocs(expensesQ);
            const expenses = expensesSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp)
            }));
            data.expenses = expenses;
            data.totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
          }
        } catch (e) {
          console.error('Failed to fetch active vehicle-usage for driver', e);
        }
        list.push(data);
      }
      setVehicles(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p className="text-gray-600">กำลังโหลด...</p>;

  if (vehicles.length === 0) {
    return <div className="bg-white rounded-xl shadow p-6">ไม่มีรถที่กำลังใช้งานอยู่</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">รถที่กำลังใช้งาน</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map(v => (
          <div key={v.id} className="bg-white rounded-xl shadow p-4 flex flex-col">
            <div className="flex items-center gap-4">
              {v.imageUrl ? (
                <Image src={v.imageUrl} alt={v.brand + ' ' + v.model} width={112} height={80} className="object-cover rounded-md border" unoptimized />
              ) : (
                <div className="w-28 h-20 bg-gray-100 rounded-md flex items-center justify-center text-sm text-gray-500 border">ไม่มีรูป</div>
              )}
              <div className="flex-1">
                <div className="font-semibold">{v.brand} {v.model}</div>
                <div className="text-sm text-gray-600">ทะเบียน: <span className="font-medium">{v.licensePlate || '-'}</span></div>
                <div className="text-sm text-gray-600">ประเภท: <span className="font-medium">{v.type || '-'}</span></div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm">{getStatusLabel(v.status)}</span>
                <div className="text-right">
                  {/* คนขับที่กำลังใช้งาน: แสดงชื่อ userName หรือชื่อจริงของ driver */}
                  {v.driver?.name ? (
                    <div className="text-sm">คนขับ: <span className="font-medium">{v.driver.name}</span></div>
                  ) : v.driver?.displayName ? (
                    <div className="text-sm">คนขับ: <span className="font-medium">{v.driver.displayName}</span></div>
                  ) : v.booking?.driverName ? (
                    <div className="text-sm">คนขับ: <span className="font-medium">{v.booking.driverName}</span></div>
                  ) : (
                    <div className="text-sm text-gray-500">คนขับ: ไม่ระบุ</div>
                  )}
                </div>
              </div>

              {v.booking && (
                <div className="bg-gray-50 border border-gray-100 rounded p-3 text-sm">
                  <div className="font-medium text-sm mb-1">รายละเอียดการเดินทาง</div>
                  <div className="text-xs text-gray-600">ผู้จอง: {v.booking.requester?.name || v.booking.requester?.email || v.booking.userEmail || v.booking.userId || 'ไม่ระบุ'}</div>
                  <div className="text-xs text-gray-600">ต้นทาง: {v.booking.origin || '-'}</div>
                  <div className="text-xs text-gray-600">ปลายทาง: {v.booking.destination || '-'}</div>
                  <div className="text-xs text-gray-600">วัตถุประสงค์: {v.booking.purpose || '-'}</div>
                  <div className="text-xs text-gray-600">วันเริ่ม: {v.booking.startDateTime ? new Date(v.booking.startDateTime.seconds * 1000).toLocaleString('th-TH') : v.booking.startDate ? new Date(v.booking.startDate.seconds ? v.booking.startDate.seconds * 1000 : v.booking.startDate).toLocaleString('th-TH') : '-'}</div>
                  <div className="text-xs text-gray-600">วันสิ้นสุด: {v.booking.endDateTime ? new Date(v.booking.endDateTime.seconds * 1000).toLocaleString('th-TH') : v.booking.endDate ? new Date(v.booking.endDate.seconds ? v.booking.endDate.seconds * 1000 : v.booking.endDate).toLocaleString('th-TH') : '-'}</div>
                  <div className="text-xs text-gray-600">ทะเบียนรถ: {v.booking.vehicleLicensePlate || v.booking.vehicleId || '-'}</div>
                  <div className="text-xs text-gray-600">คนขับ: {v.booking.driverName || v.booking.driverId || '-'}</div>
                  {v.booking.notes && <div className="text-xs text-gray-600">หมายเหตุ: {v.booking.notes}</div>}
                </div>
              )}

            </div>

            {/* ค่าใช้จ่ายระหว่างการใช้งาน */}
            {v.expenses && v.expenses.length > 0 && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3">
                <div className="font-medium text-sm mb-2 text-blue-900">ค่าใช้จ่ายระหว่างการใช้งาน</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {v.expenses.map(exp => (
                    <div key={exp.id} className="flex justify-between items-start text-xs">
                      <div className="flex-1">
                        <span className="font-medium">
                          {exp.type === 'fuel' ? '⛽ เติมน้ำมัน' : 
                           exp.type === 'fluid' ? '🛢️ เปลี่ยนของเหลว' : 
                           '💰 ' + (exp.title || 'อื่นๆ')}
                        </span>
                        {exp.note && <span className="text-gray-600 ml-1">({exp.note})</span>}
                        {exp.mileage && <div className="text-gray-600">ไมล์: {exp.mileage.toLocaleString()} กม.</div>}
                      </div>
                      <span className="font-semibold text-teal-700 ml-2">{exp.amount.toLocaleString()} ฿</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-blue-300 flex justify-between items-center">
                  <span className="text-sm font-semibold text-blue-900">รวมทั้งหมด:</span>
                  <span className="text-sm font-bold text-teal-700">{v.totalExpenses.toLocaleString()} ฿</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

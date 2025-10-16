"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export default function VehicleUsageTable() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBookings() {
      setLoading(true);
      const q = query(collection(db, "bookings"), orderBy("startDateTime", "desc"));
      const snap = await getDocs(q);
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }
    fetchBookings();
  }, []);

  // สร้างสรุปการใช้งานตามทะเบียนรถ
  const vehicleSummary = {};
  const userSummary = {};
  bookings.forEach(b => {
    const plate = b.vehicleLicensePlate || b.vehicleId;
    const user = b.userEmail || b.userId;
    // สรุปตามรถ
    if (!vehicleSummary[plate]) vehicleSummary[plate] = { count: 0, times: [] };
    vehicleSummary[plate].count++;
    vehicleSummary[plate].times.push(b.startDateTime?.seconds ? new Date(b.startDateTime.seconds * 1000) : null);
    // สรุปตามผู้ใช้
    if (!userSummary[user]) userSummary[user] = 0;
    userSummary[user]++;
  });

  // หาช่วงเวลาที่มีการใช้งานบ่อย (เช่น รายเดือน)
  const monthUsage = {};
  bookings.forEach(b => {
    if (b.startDateTime?.seconds) {
      const d = new Date(b.startDateTime.seconds * 1000);
      const key = `${d.getFullYear()}-${d.getMonth()+1}`;
      if (!monthUsage[key]) monthUsage[key] = 0;
      monthUsage[key]++;
    }
  });

  return (
    <div className="mb-12">
      <h2 className="text-lg font-semibold mb-2">ตารางการเดินรถ (ย้อนหลัง)</h2>
      {loading ? (
        <div className="p-4 text-center">กำลังโหลด...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 border">ทะเบียนรถ</th>
                <th className="px-2 py-2 border">จำนวนรอบ</th>
                <th className="px-2 py-2 border">ช่วงเวลาที่ใช้งานบ่อย</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(vehicleSummary).map(([plate, info]) => (
                <tr key={plate}>
                  <td className="px-2 py-2 border font-semibold">{plate}</td>
                  <td className="px-2 py-2 border text-center">{info.count}</td>
                  <td className="px-2 py-2 border text-center">
                    {info.times.length > 0 ? (
                      info.times.map((d, idx) => d ? d.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }) : '-').join(', ')
                    ) : '-' }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-lg font-semibold mt-8 mb-2">ผู้ใช้งานบ่อย</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-2 border">ผู้ใช้งาน</th>
              <th className="px-2 py-2 border">จำนวนรอบ</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(userSummary)
              .sort((a, b) => b[1] - a[1])
              .map(([user, count]) => (
                <tr key={user}>
                  <td className="px-2 py-2 border font-semibold">{user}</td>
                  <td className="px-2 py-2 border text-center">{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-2">ช่วงเวลาที่มีการใช้งานบ่อย</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-2 border">เดือน/ปี</th>
              <th className="px-2 py-2 border">จำนวนรอบ</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(monthUsage)
              .sort((a, b) => b[1] - a[1])
              .map(([month, count]) => (
                <tr key={month}>
                  <td className="px-2 py-2 border font-semibold">{month}</td>
                  <td className="px-2 py-2 border text-center">{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

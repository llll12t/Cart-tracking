"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export default function VehicleUsageTable() {
  const [bookings, setBookings] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [vehiclesMap, setVehiclesMap] = useState({});
  const [vehiclesList, setVehiclesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expensesMap, setExpensesMap] = useState({});

  // UI filters
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    async function fetchBookings() {
      setLoading(true);
      const snap = await getDocs(collection(db, "bookings"));
      let bookingsArr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      bookingsArr.sort((a,b) => {
        const at = a.startDateTime?.seconds ? a.startDateTime.seconds * 1000 : 0;
        const bt = b.startDateTime?.seconds ? b.startDateTime.seconds * 1000 : 0;
        return bt - at;
      });
      setBookings(bookingsArr);
  // also fetch fuel logs and sort
      const fsnap = await getDocs(collection(db, 'fuel_logs'));
      let fuelArr = fsnap.docs.map(d => ({ id: d.id, ...d.data() }));
      fuelArr.sort((a,b) => {
        const at = a.date?.seconds ? a.date.seconds * 1000 : a.date ? new Date(a.date).getTime() : 0;
        const bt = b.date?.seconds ? b.date.seconds * 1000 : b.date ? new Date(b.date).getTime() : 0;
        return bt - at;
      });
      setFuelLogs(fuelArr);
      // fetch expenses and group by bookingId
      try {
        const esnap = await getDocs(collection(db, 'expenses'));
        const emap = {};
        esnap.docs.forEach(d => {
          const data = d.data();
          const bid = data.bookingId;
          if (!bid) return;
          emap[bid] = emap[bid] || 0;
          emap[bid] += (data.amount || 0);
        });
        setExpensesMap(emap);
      } catch (e) {
        console.error('failed to load expenses', e);
      }
      // fetch vehicles to map id -> licensePlate for nicer labels
      try {
        const vsnap = await getDocs(collection(db, 'vehicles'));
        const vmap = {};
        const vlist = [];
        vsnap.docs.forEach(d => {
          const data = d.data();
          const label = data.licensePlate || data.license || data.plate || `${data.brand || ''} ${data.model || ''}` || d.id;
          vmap[d.id] = label;
          vlist.push({ id: d.id, label });
        });
        setVehiclesMap(vmap);
        setVehiclesList(vlist);
      } catch (e) {
        console.error('failed to load vehicles for map', e);
      }
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

  // Build detailed trip rows including distance and expense per booking
  const tripRows = useMemo(() => {
    return bookings.map(b => {
      const plate = b.vehicleLicensePlate || vehiclesMap[b.vehicleId] || b.vehicleId || 'unknown';
      const start = b.startMileage != null ? Number(b.startMileage) : (b.startOdometer != null ? Number(b.startOdometer) : null);
      const end = b.endMileage != null ? Number(b.endMileage) : (b.endOdometer != null ? Number(b.endOdometer) : null);
      const distance = (start != null && end != null) ? (end - start) : null;
      const expense = expensesMap[b.id] || 0;
      const date = b.startDateTime?.seconds ? new Date(b.startDateTime.seconds * 1000) : (b.startDateTime ? new Date(b.startDateTime) : null);
      return {
        id: b.id,
        date,
        plate,
        requester: b.requesterName || b.userEmail || b.userId,
        distance,
        expense,
        status: b.status || '-',
      };
    });
  }, [bookings, vehiclesMap, expensesMap]);

  // Apply filters to tripRows
  const filteredTrips = useMemo(() => {
    return tripRows.filter(r => {
      if (filterVehicle && r.plate !== (filterVehicle)) return false;
      if (filterStartDate) {
        const sd = new Date(filterStartDate);
        if (!r.date || r.date < sd) return false;
      }
      if (filterEndDate) {
        // include whole day
        const ed = new Date(filterEndDate);
        ed.setHours(23,59,59,999);
        if (!r.date || r.date > ed) return false;
      }
      return true;
    }).sort((a,b) => (b.date?.getTime()||0) - (a.date?.getTime()||0));
  }, [tripRows, filterVehicle, filterStartDate, filterEndDate]);

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
      {/* Filters: vehicle + date range */}
      <div className="flex gap-3 items-center mb-4">
        <div>
          <label className="text-sm text-gray-600">รถ</label>
          <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} className="ml-2 p-2 border rounded">
            <option value="">ทั้งหมด</option>
            {vehiclesList.map(v => (
              <option key={v.id} value={v.label}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600">จาก</label>
          <input type="date" value={filterStartDate} onChange={(e)=>setFilterStartDate(e.target.value)} className="ml-2 p-2 border rounded" />
        </div>
        <div>
          <label className="text-sm text-gray-600">ถึง</label>
          <input type="date" value={filterEndDate} onChange={(e)=>setFilterEndDate(e.target.value)} className="ml-2 p-2 border rounded" />
        </div>
        <div className="ml-auto">
          <button onClick={() => { setFilterVehicle(''); setFilterStartDate(''); setFilterEndDate(''); }} className="px-3 py-2 bg-gray-100 rounded">รีเซ็ต</button>
        </div>
      </div>
      {loading ? (
        <div className="p-4 text-center">กำลังโหลด...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 border">วันที่</th>
                <th className="px-2 py-2 border">ทะเบียนรถ</th>
                <th className="px-2 py-2 border">ผู้ขอ</th>
                <th className="px-2 py-2 border text-right">ระยะทาง (กม.)</th>
                <th className="px-2 py-2 border text-right">ค่าใช้จ่าย (บาท)</th>
                <th className="px-2 py-2 border text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map(t => (
                <tr key={t.id}>
                  <td className="px-2 py-2 border">{t.date ? t.date.toLocaleString('th-TH') : '-'}</td>
                  <td className="px-2 py-2 border font-semibold">{t.plate}</td>
                  <td className="px-2 py-2 border">{t.requester}</td>
                  <td className="px-2 py-2 border text-right">{t.distance != null ? t.distance : '-'}</td>
                  <td className="px-2 py-2 border text-right">{t.expense ? t.expense.toLocaleString('th-TH') : '-'}</td>
                  <td className="px-2 py-2 border text-center">{t.status}</td>
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
      
      <h2 className="text-lg font-semibold mt-8 mb-2">การวิเคราะห์อัตราสิ้นเปลืองน้ำมัน (กม./ลิตร)</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-2 border">ทะเบียนรถ</th>
              <th className="px-2 py-2 border">เฉลี่ย (กม./ลิตร)</th>
              <th className="px-2 py-2 border">บันทึกล่าสุด (กม./ลิตร)</th>
              <th className="px-2 py-2 border">จำนวนบันทึก</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // group fuel logs by vehicleId or plate
                      const byVehicle = {};
                      fuelLogs.forEach(f => {
                        const key = f.vehicleId || f.vehiclePlate || 'unknown';
                        if (!byVehicle[key]) byVehicle[key] = [];
                        byVehicle[key].push(f);
                      });

                      // compute km/l for each fill by sorting logs by date asc and pairing consecutive records
                      const rows = Object.entries(byVehicle).map(([vehicle, logs]) => {
                        // sort by date ascending so we can pair previous -> current
                        logs.sort((a,b) => {
                          const at = a.date?.seconds ? a.date.seconds * 1000 : a.date ? new Date(a.date).getTime() : 0;
                          const bt = b.date?.seconds ? b.date.seconds * 1000 : b.date ? new Date(b.date).getTime() : 0;
                          return at - bt;
                        });

                        const efficiencies = [];
                        for (let i = 1; i < logs.length; i++) {
                          const prev = logs[i-1];
                          const cur = logs[i];
                          const prevMileage = prev.mileage != null ? Number(prev.mileage) : (prev.previousMileage != null ? Number(prev.previousMileage) : null);
                          const curMileage = cur.mileage != null ? Number(cur.mileage) : (cur.previousMileage != null ? Number(cur.previousMileage) : null);
                          const liters = cur.liters != null ? Number(cur.liters) : null;
                          if (prevMileage != null && curMileage != null && liters && curMileage > prevMileage) {
                            const km = curMileage - prevMileage;
                            efficiencies.push(km / liters);
                          }
                        }

                        const avg = efficiencies.length ? (efficiencies.reduce((a,b)=>a+b,0)/efficiencies.length) : null;
                        const last = efficiencies.length ? efficiencies[efficiencies.length-1] : null; // last computed pair
                        const label = vehiclesMap[vehicle] || vehicle;
                        return { vehicle: label, avg, last, count: logs.length };
                      });

              return rows.map(r => (
                <tr key={r.vehicle}>
                  <td className="px-2 py-2 border font-semibold">{r.vehicle}</td>
                  <td className="px-2 py-2 border text-center">{r.avg ? r.avg.toFixed(2) : '-'}</td>
                  <td className="px-2 py-2 border text-center">{r.last ? r.last.toFixed(2) : '-'}</td>
                  <td className="px-2 py-2 border text-center">{r.count}</td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

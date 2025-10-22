"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Bar, Line } from "react-chartjs-2";
import Chart from "chart.js/auto";
import VehicleUsageTable from './VehicleUsageTable';

export default function VehiclesAnalysisPage() {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [depreciationData, setDepreciationData] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [efficiencyData, setEfficiencyData] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [maintenanceSummary, setMaintenanceSummary] = useState([]);
  const [topN, setTopN] = useState(30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // 1. Get all vehicles
      const vehiclesSnap = await getDocs(collection(db, "vehicles"));
      const vehiclesArr = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vehiclesArr);

      // 2. For each vehicle, get total expense (we will focus on maintenance expenses) and depreciation
      const expenseArr = [];
      const depreciationArr = [];
      for (const vehicle of vehiclesArr) {
        // Total expense (all expenses)
        const expensesSnap = await getDocs(query(collection(db, "expenses"), where("vehicleId", "==", vehicle.id)));
        const totalExpense = expensesSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
        expenseArr.push(totalExpense);

        // Depreciation placeholder (keep for possible future use)
        const depreciationRate = vehicle.depreciationRate || 2;
        const depreciation = (vehicle.currentMileage || 0) * depreciationRate;
        depreciationArr.push(depreciation);
      }
      setExpenseData(expenseArr);
      setDepreciationData(depreciationArr);
      // fetch all bookings for month aggregation
      const bSnap = await getDocs(collection(db, 'bookings'));
      const bArr = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      // sort bookings by startDateTime desc
      bArr.sort((a,b) => {
        const at = a.startDateTime?.seconds ? a.startDateTime.seconds * 1000 : 0;
        const bt = b.startDateTime?.seconds ? b.startDateTime.seconds * 1000 : 0;
        return bt - at;
      });
  setBookings(bArr);
  // fetch fuel logs for efficiency analysis (fetch then sort client-side)
  const fSnap = await getDocs(collection(db, 'fuel_logs'));
      let fArr = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      fArr.sort((a, b) => {
        const at = a.date?.seconds ? a.date.seconds * 1000 : a.date ? new Date(a.date).getTime() : 0;
        const bt = b.date?.seconds ? b.date.seconds * 1000 : b.date ? new Date(b.date).getTime() : 0;
        return bt - at;
      });
      setFuelLogs(fArr);
      // compute average efficiency per vehicle from fuel_logs
      const effMap = {};
      fArr.forEach(f => {
        const key = f.vehicleId || f.vehiclePlate || 'unknown';
        if (!effMap[key]) effMap[key] = [];
        if (f.previousMileage != null && f.liters) {
          const km = f.mileage - f.previousMileage;
          if (km > 0 && f.liters > 0) effMap[key].push(km / f.liters);
        }
      });
      const effArr = vehiclesArr.map(v => {
        const vals = effMap[v.id] || [];
        const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : null;
        return { vehicleId: v.id, label: v.licensePlate || v.id, avg, latest: (effMap[v.id] && effMap[v.id][0]) || null, count: vals.length };
      });
      setEfficiencyData(effArr);

      // fetch maintenances and compute total per vehicle
      const mSnap = await getDocs(query(collection(db, 'maintenances')));
      const mArr = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaintenances(mArr);
      const mMap = {};
      mArr.forEach(m => {
        if (!mMap[m.vehicleId]) mMap[m.vehicleId] = { total: 0, items: [] };
        mMap[m.vehicleId].total += (m.cost || 0);
        mMap[m.vehicleId].items.push(m);
      });
      const mSummary = vehiclesArr.map(v => ({ vehicleId: v.id, label: v.licensePlate || v.id, totalCost: mMap[v.id]?.total || 0, items: mMap[v.id]?.items || [] }));
      setMaintenanceSummary(mSummary);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">กำลังโหลดข้อมูล...</div>;
  }

  const labels = vehicles.map(v => v.licensePlate || v.id);

  // Helper: filter by date range if provided
  const inRange = (ts) => {
    if (!ts) return false;
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (startDate && new Date(startDate) > date) return false;
    if (endDate && new Date(endDate) < date) return false;
    return true;
  };

  // Prepare monthly usage series (global)
  const monthBuckets = {};
  bookings.forEach(b => {
    if (!b.startDateTime) return;
    if (!inRange(b.startDateTime)) return;
    const d = new Date(b.startDateTime.seconds * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthBuckets[key] = (monthBuckets[key] || 0) + 1;
  });
  const monthLabels = Object.keys(monthBuckets).sort();
  const monthValues = monthLabels.map(k => monthBuckets[k]);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">วิเคราะห์: อัตราสิ้นเปลืองน้ำมัน และ ค่าใช้จ่ายซ่อมบำรุง</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">อัตราสิ้นเปลืองน้ำมัน (กม./ลิตร) ต่อรถ</h2>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <Bar
              data={{
                labels: efficiencyData.map(e => e.label),
                datasets: [{ label: 'เฉลี่ย กม./ลิตร', data: efficiencyData.map(e => e.avg || 0), backgroundColor: '#0ea5e9' }]
              }}
              options={{ responsive: true, plugins: { legend: { display: false } } }}
            />

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">รถ</th>
                    <th className="px-3 py-2 text-right">เฉลี่ย (กม./ลิตร)</th>
                    <th className="px-3 py-2 text-right">บันทึกล่าสุด</th>
                    <th className="px-3 py-2 text-right">จำนวนการเติม</th>
                  </tr>
                </thead>
                <tbody>
                  {efficiencyData.map(e => (
                    <tr key={e.vehicleId} className="border-b">
                      <td className="px-3 py-2">{e.label}</td>
                      <td className="px-3 py-2 text-right">{e.avg ? e.avg.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2 text-right">{e.latest ? e.latest.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2 text-right">{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">ค่าใช้จ่ายการซ่อมบำรุง ต่อรถ</h2>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <Bar
              data={{ labels: maintenanceSummary.map(m => m.label), datasets: [{ label: 'รวมค่าใช้จ่าย (บาท)', data: maintenanceSummary.map(m => m.totalCost), backgroundColor: '#f59e0b' }] }}
              options={{ responsive: true, plugins: { legend: { display: false } } }}
            />

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">รถ</th>
                    <th className="px-3 py-2 text-right">รวมค่าใช้จ่าย (บาท)</th>
                    <th className="px-3 py-2 text-left">รายการล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceSummary.map(m => (
                    <tr key={m.vehicleId} className="border-b">
                      <td className="px-3 py-2">{m.label}</td>
                      <td className="px-3 py-2 text-right">{m.totalCost.toLocaleString('th-TH')}</td>
                      <td className="px-3 py-2">
                        {m.items.length > 0 ? (
                          <div className="text-xs text-gray-700">
                            {m.items.slice(0,3).map(it => {
                              // normalize date: support Firestore Timestamp (seconds), Timestamp.toDate(), Date or ISO string
                              let dateObj = null;
                              if (it.date && it.date.seconds) {
                                dateObj = new Date(it.date.seconds * 1000);
                              } else if (it.date && typeof it.date.toDate === 'function') {
                                dateObj = it.date.toDate();
                              } else if (it.date) {
                                try { dateObj = new Date(it.date); } catch (e) { dateObj = null; }
                              } else if (it.createdAt && it.createdAt.seconds) {
                                dateObj = new Date(it.createdAt.seconds * 1000);
                              } else if (it.createdAt) {
                                try { dateObj = new Date(it.createdAt); } catch (e) { dateObj = null; }
                              }
                              const dateStr = dateObj ? dateObj.toLocaleDateString('th-TH') : '-';
                              return (<div key={it.id}>{dateStr} - {it.details} ({it.cost} บาท)</div>);
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-500">ไม่มีรายการ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
      <div className="mt-12">
        <VehicleUsageTable />
      </div>
    </div>
  );
}

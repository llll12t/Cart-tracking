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
  const [repairCostsMap, setRepairCostsMap] = useState({});
  const RECENT_COUNT = 2;
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
      const localRepairMap = {};
      for (const vehicle of vehiclesArr) {
        // Total expense (all expenses)
        const expensesSnap = await getDocs(query(collection(db, "expenses"), where("vehicleId", "==", vehicle.id)));
        const totalExpense = expensesSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
        expenseArr.push(totalExpense);

        // classify repair/shop expenses (try several fields: category/type/vendor/payee)
        let repairExpense = 0;
        expensesSnap.docs.forEach(d => {
          const data = d.data() || {};
          const amt = data.amount || 0;
          const vendor = (data.vendor || data.payee || '').toString().toLowerCase();
          const category = (data.category || data.type || '').toString().toLowerCase();
          if (category.includes('repair') || category.includes('ซ่อม') || vendor.includes('อู่') || vendor.includes('repair') || vendor.includes('workshop')) {
            repairExpense += amt;
          }
        });
        localRepairMap[vehicle.id] = repairExpense;

        // Depreciation placeholder (keep for possible future use)
        const depreciationRate = vehicle.depreciationRate || 2;
        const depreciation = (vehicle.currentMileage || 0) * depreciationRate;
        depreciationArr.push(depreciation);
      }
      setExpenseData(expenseArr);
      setDepreciationData(depreciationArr);
      setRepairCostsMap(localRepairMap);
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
        const costVal = Number(m.finalCost ?? m.cost ?? 0) || 0;
        mMap[m.vehicleId].total += costVal;
        mMap[m.vehicleId].items.push({ ...m, _computedCost: costVal });
      });
      // sort items per vehicle by createdAt/date desc so newest appear first
      Object.keys(mMap).forEach(vid => {
        mMap[vid].items.sort((a, b) => {
          const at = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.date ? (a.date.seconds ? a.date.seconds*1000 : new Date(a.date).getTime()) : 0;
          const bt = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.date ? (b.date.seconds ? b.date.seconds*1000 : new Date(b.date).getTime()) : 0;
          return bt - at;
        });
      });
      const mSummary = vehiclesArr.map(v => ({ vehicleId: v.id, label: v.licensePlate || v.id, totalCost: mMap[v.id]?.total || 0, items: mMap[v.id]?.items || [] }));
      setMaintenanceSummary(mSummary);
      // Compute repair costs (ค่าซ่อมอู่) from maintenances records where type === 'garage'
      const repairFromMaint = {};
      mArr.forEach(m => {
        if (m.type === 'garage') {
          const vid = m.vehicleId;
          const cost = Number(m.finalCost ?? m.cost ?? 0) || 0;
          repairFromMaint[vid] = (repairFromMaint[vid] || 0) + cost;
        }
      });
      // Override previous repair map (if any) with maintenance-derived repair costs
      setRepairCostsMap(prev => ({ ...prev, ...repairFromMaint }));
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

  // Aggregate per-vehicle usage: distance, maintenance (ค่าใช้จ่าย), repair (ค่าซ่อมอู่), fuel cost
  const maintenanceMap = {};
  maintenanceSummary.forEach(m => { maintenanceMap[m.vehicleId] = m.totalCost || 0; });

  const fuelCostMap = {};
  fuelLogs.forEach(f => {
    const vid = f.vehicleId || f.vehiclePlate || null;
    if (!vid) return;
    const c = (f.cost || f.amount || f.price) || 0;
    fuelCostMap[vid] = (fuelCostMap[vid] || 0) + c;
  });

  const distanceMap = {};
  bookings.forEach(b => {
    let vid = b.vehicleId || null;
    if (!vid && b.vehicleLicensePlate) {
      const matched = vehicles.find(v => v.licensePlate === b.vehicleLicensePlate);
      vid = matched?.id || null;
    }
    const start = b.startMileage != null ? Number(b.startMileage) : (b.startOdometer != null ? Number(b.startOdometer) : null);
    const end = b.endMileage != null ? Number(b.endMileage) : (b.endOdometer != null ? Number(b.endOdometer) : null);
    if (vid && start != null && end != null && end > start) {
      distanceMap[vid] = (distanceMap[vid] || 0) + (end - start);
    }
  });

  const vehicleUsage = vehicles.map(v => {
    const distance = distanceMap[v.id] || 0;
    const maintenanceTotal = maintenanceMap[v.id] || 0; // ค่าใช้จ่าย = ค่าบำรุง
    const repairCost = repairCostsMap[v.id] || 0; // ค่าซ่อม = ค่าซ่อมอู่
    const fuelCost = fuelCostMap[v.id] || 0;
    const total = maintenanceTotal + repairCost + fuelCost;
    return { vehicleId: v.id, label: v.licensePlate || `${v.brand || ''} ${v.model || ''}`.trim() || v.id, distance, maintenanceTotal, repairCost, fuelCost, total };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-bold mb-6">วิเคราะห์: อัตราสิ้นเปลืองน้ำมัน และ ค่าใช้จ่ายซ่อมบำรุง</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">อัตราสิ้นเปลืองน้ำมัน (กม./ลิตร) ต่อรถ</h2>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="w-full" style={{ height: 260 }}>
              <Bar
                data={{
                  labels: efficiencyData.map(e => e.label),
                  datasets: [{ label: 'เฉลี่ย กม./ลิตร', data: efficiencyData.map(e => e.avg || 0), backgroundColor: '#0ea5e9' }]
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
              />
            </div>

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
            <div className="w-full" style={{ height: 260 }}>
              <Bar
                data={{ labels: maintenanceSummary.map(m => m.label), datasets: [{ label: 'รวมค่าใช้จ่าย (บาท)', data: maintenanceSummary.map(m => m.totalCost), backgroundColor: '#f59e0b' }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
              />
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm table-fixed">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">รถ</th>
                    <th className="px-3 py-2 text-right">รวมค่าใช้จ่าย (บาท)</th>
                    <th className="px-3 py-2 text-left">รายการล่าสุด (แสดง 2)</th>
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
                            {m.items.slice(0, RECENT_COUNT).map(it => {
                              const dateObj = (it.createdAt && it.createdAt.seconds) ? new Date(it.createdAt.seconds * 1000) : (it.date && it.date.seconds ? new Date(it.date.seconds*1000) : (it.date ? new Date(it.date) : null));
                              const dateStr = dateObj ? dateObj.toLocaleDateString('th-TH') : '-';
                              const costDisplay = it._computedCost != null ? it._computedCost : (it.finalCost ?? it.cost ?? '-');
                              return (<div key={it.id}>{dateStr} - {it.vendor ?? it.details ?? '-'} ({costDisplay ? Number(costDisplay).toLocaleString('th-TH') + ' บาท' : '-'})</div>);
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
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">สรุปการใช้งานต่อรถ</h2>
          {/* Desktop/table view (sm and up) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">รถ</th>
                  <th className="px-3 py-2 text-right">ระยะทาง (กม.)</th>
                  <th className="px-3 py-2 text-right">ค่าใช้จ่าย (บาท)</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">ค่าซ่อมอู่ (บาท)</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">ค่าน้ำมัน (บาท)</th>
                  <th className="px-3 py-2 text-right">ยอดทั้งหมด (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {vehicleUsage.map(vu => (
                  <tr key={vu.vehicleId} className="border-b">
                    <td className="px-3 py-2 max-w-[12rem] truncate" title={vu.label}>{vu.label}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{vu.distance ? vu.distance.toLocaleString('th-TH') : '-'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{vu.maintenanceTotal ? vu.maintenanceTotal.toLocaleString('th-TH') : '-'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap hidden sm:table-cell">{vu.repairCost ? vu.repairCost.toLocaleString('th-TH') : '-'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap hidden sm:table-cell">{vu.fuelCost ? vu.fuelCost.toLocaleString('th-TH') : '-'}</td>
                    <td className="px-3 py-2 text-right font-semibold">{vu.total ? vu.total.toLocaleString('th-TH') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/card view (visible on xs) */}
          <div className="block sm:hidden">
            <div className="space-y-3">
              {vehicleUsage.map(vu => (
                <div key={vu.vehicleId} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium truncate" title={vu.label}>{vu.label}</div>
                    <div className="text-sm font-semibold">{vu.total ? vu.total.toLocaleString('th-TH') : '-'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">ระยะทาง</span>
                      <span className="font-medium">{vu.distance ? vu.distance.toLocaleString('th-TH') : '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">ค่าใช้จ่าย</span>
                      <span className="font-medium">{vu.maintenanceTotal ? vu.maintenanceTotal.toLocaleString('th-TH') : '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">ค่าซ่อมอู่</span>
                      <span className="font-medium">{vu.repairCost ? vu.repairCost.toLocaleString('th-TH') : '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">ค่าน้ำมัน</span>
                      <span className="font-medium">{vu.fuelCost ? vu.fuelCost.toLocaleString('th-TH') : '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <VehicleUsageTable />
      </div>
    </div>
  );
}

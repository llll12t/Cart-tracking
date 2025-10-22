"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Bar, Line } from "react-chartjs-2";
import Chart from "chart.js/auto";
import VehicleUsageTable from './VehicleUsageTable';

export default function VehiclesAnalysisPage() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
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

      // 2. Fetch all bookings
      const bSnap = await getDocs(collection(db, 'bookings'));
      const bArr = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      // sort bookings by startDateTime desc
      bArr.sort((a,b) => {
        const at = a.startDateTime?.seconds ? a.startDateTime.seconds * 1000 : 0;
        const bt = b.startDateTime?.seconds ? b.startDateTime.seconds * 1000 : 0;
        return bt - at;
      });
      setBookings(bArr);

      // 3. Fetch all expenses (by bookingId like trip-history does)
      const allExpensesSnap = await getDocs(collection(db, "expenses"));
      const allExpenses = allExpensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Store all expenses for later use
      setExpenseData(allExpenses);

      // Map expenses to vehicles via bookings
      const vehicleExpensesMap = {}; // vehicleId -> { total, fuel, toll, parking, maintenance, other }
      allExpenses.forEach(exp => {
        const booking = bArr.find(b => b.id === exp.bookingId);
        if (!booking || !booking.vehicleId) return;
        
        const vid = booking.vehicleId;
        if (!vehicleExpensesMap[vid]) {
          vehicleExpensesMap[vid] = { total: 0, fuel: 0, toll: 0, parking: 0, maintenance: 0, other: 0 };
        }
        
        const amount = exp.amount || 0;
        vehicleExpensesMap[vid].total += amount;
        
        // Classify by type (same as trip-history)
        const expenseType = exp.type || 'other';
        if (vehicleExpensesMap[vid][expenseType] !== undefined) {
          vehicleExpensesMap[vid][expenseType] += amount;
        } else {
          vehicleExpensesMap[vid].other += amount;
        }
      });

      // Store for later calculation (as window variable for access in render)
      window._vehicleExpensesMap = vehicleExpensesMap;

      // 4. Depreciation (placeholder)
      const depreciationArr = vehiclesArr.map(v => {
        const depreciationRate = v.depreciationRate || 2;
        return (v.currentMileage || 0) * depreciationRate;
      });
      setDepreciationData(depreciationArr);
      
      // 5. Fetch fuel logs for efficiency analysis
      const fSnap = await getDocs(collection(db, 'fuel_logs'));
      let fArr = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      fArr.sort((a, b) => {
        const at = a.date?.seconds ? a.date.seconds * 1000 : a.date ? new Date(a.date).getTime() : 0;
        const bt = b.date?.seconds ? b.date.seconds * 1000 : b.date ? new Date(b.date).getTime() : 0;
        return bt - at;
      });
      setFuelLogs(fArr);
      // compute average efficiency per vehicle from fuel_logs (เฉพาะข้อมูลที่ครบ)
      const effMap = {};
      fArr.forEach(f => {
        const key = f.vehicleId || f.vehiclePlate || 'unknown';
        if (!effMap[key]) effMap[key] = [];
        // เฉพาะกรณีที่มี mileage, previousMileage, liters > 0
        if (f.mileage != null && f.previousMileage != null && f.liters > 0) {
          const km = Number(f.mileage) - Number(f.previousMileage);
          if (km > 0) effMap[key].push(km / Number(f.liters));
        }
      });
      const effArr = vehiclesArr.map(v => {
        const vals = effMap[v.id] || [];
        const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : null;
        // latest: ใช้ค่าล่าสุดที่มีข้อมูลครบ
        const latest = vals.length ? vals[0] : null;
        return { vehicleId: v.id, label: v.licensePlate || v.id, avg, latest, count: vals.length };
      });
      setEfficiencyData(effArr);

      // fetch maintenances and compute total per vehicle
      const mSnap = await getDocs(query(collection(db, 'maintenances')));
      const mArr = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaintenances(mArr);
      // รวม maintenance จาก expenses ด้วย
      const maintenanceExpenses = allExpenses.filter(e => e.type === 'maintenance');
      // สร้าง mMap จาก maintenances
      const mMap = {};
      mArr.forEach(m => {
        if (!mMap[m.vehicleId]) mMap[m.vehicleId] = { total: 0, items: [] };
        const costVal = Number(m.finalCost ?? m.cost ?? 0) || 0;
        mMap[m.vehicleId].total += costVal;
        mMap[m.vehicleId].items.push({ ...m, _computedCost: costVal, _source: 'maintenances' });
      });
      // รวม maintenance จาก expenses (type='maintenance')
      maintenanceExpenses.forEach(e => {
        // หา vehicleId จาก booking
        const booking = bArr.find(b => b.id === e.bookingId);
        if (!booking || !booking.vehicleId) return;
        const vid = booking.vehicleId;
        if (!mMap[vid]) mMap[vid] = { total: 0, items: [] };
        const costVal = Number(e.amount || 0);
        mMap[vid].total += costVal;
        mMap[vid].items.push({
          id: e.id,
          date: e.date,
          createdAt: e.createdAt,
          vendor: e.vendor,
          details: e.details,
          _computedCost: costVal,
          _source: 'expenses',
        });
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

  // สร้าง dropdown เลือกรถ
  const vehicleOptions = vehicles.map(v => ({ id: v.id, label: v.licensePlate || `${v.brand || ''} ${v.model || ''}`.trim() || v.id }));
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  const selectedVehicleIdFinal = selectedVehicle ? selectedVehicle.id : '';

  // กรอง bookings เฉพาะรถที่เลือก
  const bookingsForSelected = bookings.filter(b => b.vehicleId === selectedVehicleIdFinal);

  // Debug
  console.log('Selected Vehicle ID:', selectedVehicleIdFinal);
  console.log('Total bookings:', bookings.length);
  console.log('Filtered bookings for selected vehicle:', bookingsForSelected.length);

  // สร้างข้อมูลรายวัน/รายเดือนย้อนหลัง 1 เดือน จาก bookings + expenses
  const now = new Date();
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  console.log('Date range:', oneMonthAgo.toISOString(), 'to', now.toISOString());
  
  // รายวัน
  const dailyMap = {};
  bookingsForSelected.forEach(b => {
    if (!b.startDateTime) return;
    const dateObj = b.startDateTime.seconds ? new Date(b.startDateTime.seconds * 1000) : new Date(b.startDateTime);
    if (dateObj < oneMonthAgo) return;
    const dayKey = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD
    
    // คำนวณระยะทาง
    const start = b.startMileage != null ? Number(b.startMileage) : (b.startOdometer != null ? Number(b.startOdometer) : null);
    const end = b.endMileage != null ? Number(b.endMileage) : (b.endOdometer != null ? Number(b.endOdometer) : null);
    const km = (start != null && end != null && end > start) ? (end - start) : 0;
    
    // หาค่าน้ำมันจาก expenses
    const fuelExpenses = expenseData.filter(e => e.bookingId === b.id && e.type === 'fuel');
    const fuelPrice = fuelExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    console.log('Processing booking:', { dayKey, bookingId: b.id, km, fuelPrice, start, end });
    
    if (km > 0 && fuelPrice > 0) {
      if (!dailyMap[dayKey]) dailyMap[dayKey] = { km: 0, price: 0 };
      dailyMap[dayKey].km += km;
      dailyMap[dayKey].price += fuelPrice;
    }
  });
  const dailyLabels = Object.keys(dailyMap).sort();
  const dailyAvg = dailyLabels.map(day => {
    const d = dailyMap[day];
    return d.price > 0 ? d.km / d.price : 0;
  });
  console.log('Daily data:', { dailyLabels, dailyAvg, dailyMap });

  // รายเดือน (ย้อนหลัง 1 เดือน)
  const monthlyMap = {};
  bookingsForSelected.forEach(b => {
    if (!b.startDateTime) return;
    const dateObj = b.startDateTime.seconds ? new Date(b.startDateTime.seconds * 1000) : new Date(b.startDateTime);
    if (dateObj < oneMonthAgo) return;
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;
    
    // คำนวณระยะทาง
    const start = b.startMileage != null ? Number(b.startMileage) : (b.startOdometer != null ? Number(b.startOdometer) : null);
    const end = b.endMileage != null ? Number(b.endMileage) : (b.endOdometer != null ? Number(b.endOdometer) : null);
    const km = (start != null && end != null && end > start) ? (end - start) : 0;
    
    // หาค่าน้ำมันจาก expenses
    const fuelExpenses = expenseData.filter(e => e.bookingId === b.id && e.type === 'fuel');
    const fuelPrice = fuelExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    if (km > 0 && fuelPrice > 0) {
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { km: 0, price: 0 };
      monthlyMap[monthKey].km += km;
      monthlyMap[monthKey].price += fuelPrice;
    }
  });
  const monthlyLabels = Object.keys(monthlyMap).sort();
  const monthlyAvg = monthlyLabels.map(month => {
    const d = monthlyMap[month];
    return d.price > 0 ? d.km / d.price : 0;
  });
  console.log('Monthly data:', { monthlyLabels, monthlyAvg, monthlyMap });
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

  // Aggregate per-vehicle usage: distance, maintenance (ค่าบำรุง), repair (ค่าซ่อมอู่), fuel cost
  const maintenanceMap = {};
  maintenanceSummary.forEach(m => { maintenanceMap[m.vehicleId] = m.totalCost || 0; });

  // Calculate expenses by type for each vehicle from expenseData
  const vehicleExpenseSummary = {};
  vehicles.forEach(v => {
    vehicleExpenseSummary[v.id] = { fuel: 0, toll: 0, parking: 0, maintenance: 0, other: 0, total: 0 };
  });

  // Aggregate expenses by vehicle through bookings
  expenseData.forEach(exp => {
    const booking = bookings.find(b => b.id === exp.bookingId);
    if (!booking || !booking.vehicleId) return;
    
    const vid = booking.vehicleId;
    if (!vehicleExpenseSummary[vid]) {
      vehicleExpenseSummary[vid] = { fuel: 0, toll: 0, parking: 0, maintenance: 0, other: 0, total: 0 };
    }
    
    const amount = exp.amount || 0;
    const expenseType = exp.type || 'other';
    
    if (vehicleExpenseSummary[vid][expenseType] !== undefined) {
      vehicleExpenseSummary[vid][expenseType] += amount;
    } else {
      vehicleExpenseSummary[vid].other += amount;
    }
    vehicleExpenseSummary[vid].total += amount;
  });

  // Get fuel costs from fuel_logs and add to fuel expenses
  const fuelCostFromLogs = {};
  fuelLogs.forEach(f => {
    const vid = f.vehicleId || f.vehiclePlate || null;
    if (!vid) return;
    const c = (f.cost || f.amount || f.price) || 0;
    fuelCostFromLogs[vid] = (fuelCostFromLogs[vid] || 0) + c;
  });

  // Combine fuel from expenses + fuel_logs
  const fuelCostMap = {};
  vehicles.forEach(v => {
    const expenseFuel = vehicleExpenseSummary[v.id]?.fuel || 0;
    const logsFuel = fuelCostFromLogs[v.id] || 0;
    fuelCostMap[v.id] = expenseFuel + logsFuel;
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
    // ค่าใช้จ่าย = ค่าบำรุง (maintenances) + ค่าใช้จ่ายอื่นๆจาก expenses (ยกเว้นน้ำมัน)
    const maintenanceTotal = maintenanceMap[v.id] || 0; // จาก maintenances collection
    const otherExpenses = (vehicleExpenseSummary[v.id]?.toll || 0) + 
                          (vehicleExpenseSummary[v.id]?.parking || 0) + 
                          (vehicleExpenseSummary[v.id]?.maintenance || 0) + 
                          (vehicleExpenseSummary[v.id]?.other || 0);
    const totalExpenses = maintenanceTotal + otherExpenses; // รวมค่าใช้จ่ายทั้งหมด (ไม่รวมน้ำมัน)
    
    const repairCost = repairCostsMap[v.id] || 0; // ค่าซ่อมอู่ (จาก maintenances type='garage')
    const fuelCost = fuelCostMap[v.id] || 0; // ค่าน้ำมัน (จาก expenses type='fuel' + fuel_logs)
    const total = totalExpenses + repairCost + fuelCost; // รวมทั้งหมด
    
    return { 
      vehicleId: v.id, 
      label: v.licensePlate || `${v.brand || ''} ${v.model || ''}`.trim() || v.id, 
      distance, 
      maintenanceTotal: totalExpenses, // แสดงเป็น "ค่าใช้จ่าย"
      repairCost, 
      fuelCost, 
      total 
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-bold mb-6">วิเคราะห์การใช้งานรถ</h1>
      {/* เลือกรถ */}
      <div className="mb-6 flex items-center gap-2">
        <span className="font-medium">เลือกรถ:</span>
        <select
          className="border rounded px-2 py-1"
          value={selectedVehicleIdFinal}
          onChange={e => setSelectedVehicleId(e.target.value)}
        >
          {vehicleOptions.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>
      {/* กราฟค่าเฉลี่ยระยะทางต่อลิตร รายวันย้อนหลัง 1 เดือน */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">ค่าเฉลี่ยระยะทางต่อราคาน้ำมัน (กม./บาท) รายวัน (ย้อนหลัง 1 เดือน)</h2>
        {dailyLabels.length > 0 ? (
          <div style={{ height: 260 }}>
            <Line
              data={{
                labels: dailyLabels,
                datasets: [
                  {
                    label: 'กม./บาท',
                    data: dailyAvg,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14,165,233,0.2)',
                    fill: true,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { title: { display: true, text: 'วัน' } }, y: { title: { display: true, text: 'กม./บาท' } } },
              }}
            />
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            ไม่มีข้อมูลทริปสำหรับรถนี้ในช่วง 1 เดือนที่ผ่านมา<br/>
            <span className="text-sm">กรุณาตรวจสอบว่ามีการบันทึกทริป (booking) พร้อมระยะทาง และค่าน้ำมัน (expenses type=fuel)</span>
          </div>
        )}
      </div>
      {/* กราฟค่าเฉลี่ยระยะทางต่อลิตร รายเดือนย้อนหลัง 1 เดือน */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">ค่าเฉลี่ยระยะทางต่อราคาน้ำมัน (กม./บาท) รายเดือน (ย้อนหลัง 1 เดือน)</h2>
        {monthlyLabels.length > 0 ? (
          <div style={{ height: 260 }}>
            <Line
              data={{
                labels: monthlyLabels,
                datasets: [
                  {
                    label: 'กม./บาท',
                    data: monthlyAvg,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14,165,233,0.2)',
                    fill: true,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { title: { display: true, text: 'เดือน' } }, y: { title: { display: true, text: 'กม./บาท' } } },
              }}
            />
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            ไม่มีข้อมูลทริปสำหรับรถนี้ในช่วง 1 เดือนที่ผ่านมา<br/>
            <span className="text-sm">กรุณาตรวจสอบว่ามีการบันทึกทริป (booking) พร้อมระยะทาง และค่าน้ำมัน (expenses type=fuel)</span>
          </div>
        )}
      </div>
      <div className="mt-12">
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">สรุปการใช้งานต่อรถ</h2>
          {/* กราฟ Bar สรุปการใช้งานต่อรถ (ระยะทาง) */}
          <div className="mb-8">
            <Bar
              data={{
                labels: vehicleUsage.map(v => v.label),
                datasets: [
                  {
                    label: 'ระยะทาง (กม.)',
                    data: vehicleUsage.map(v => v.distance),
                    backgroundColor: '#0ea5e9',
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { title: { display: true, text: 'รถ' } }, y: { title: { display: true, text: 'ระยะทาง (กม.)' } } },
              }}
              height={260}
            />
          </div>
          {/* กราฟ Bar สรุปยอดทั้งหมด */}
          <div className="mb-8">
            <Bar
              data={{
                labels: vehicleUsage.map(v => v.label),
                datasets: [
                  {
                    label: 'ยอดทั้งหมด (บาท)',
                    data: vehicleUsage.map(v => v.total),
                    backgroundColor: '#f59e0b',
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { title: { display: true, text: 'รถ' } }, y: { title: { display: true, text: 'ยอดทั้งหมด (บาท)' } } },
              }}
              height={260}
            />
          </div>
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
              {/* กราฟ Bar บน mobile */}
              <div className="mb-4">
                <Bar
                  data={{
                    labels: vehicleUsage.map(v => v.label),
                    datasets: [
                      {
                        label: 'ระยะทาง (กม.)',
                        data: vehicleUsage.map(v => v.distance),
                        backgroundColor: '#0ea5e9',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { title: { display: true, text: 'รถ' } }, y: { title: { display: true, text: 'ระยะทาง (กม.)' } } },
                  }}
                  height={180}
                />
              </div>
              <div className="mb-4">
                <Bar
                  data={{
                    labels: vehicleUsage.map(v => v.label),
                    datasets: [
                      {
                        label: 'ยอดทั้งหมด (บาท)',
                        data: vehicleUsage.map(v => v.total),
                        backgroundColor: '#f59e0b',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { title: { display: true, text: 'รถ' } }, y: { title: { display: true, text: 'ยอดทั้งหมด (บาท)' } } },
                  }}
                  height={180}
                />
              </div>
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

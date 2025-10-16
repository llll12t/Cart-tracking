"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";
import VehicleUsageTable from "./VehicleUsageTable";

export default function VehiclesAnalysisPage() {
  const [vehicles, setVehicles] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [depreciationData, setDepreciationData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // 1. Get all vehicles
      const vehiclesSnap = await getDocs(collection(db, "vehicles"));
      const vehiclesArr = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vehiclesArr);

      // 2. For each vehicle, get usage count, total expense, depreciation
      const usageArr = [];
      const expenseArr = [];
      const depreciationArr = [];
      for (const vehicle of vehiclesArr) {
        // Usage count (number of bookings)
        const bookingsSnap = await getDocs(query(collection(db, "bookings"), where("vehicleId", "==", vehicle.id)));
        usageArr.push(bookingsSnap.size);

        // Total expense
        const expensesSnap = await getDocs(query(collection(db, "expenses"), where("vehicleId", "==", vehicle.id)));
        const totalExpense = expensesSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
        expenseArr.push(totalExpense);

        // Depreciation (simple: currentMileage * depreciationRate)
        // Assume depreciationRate = 2 บาท/กม. (or use vehicle.depreciationRate if exists)
        const depreciationRate = vehicle.depreciationRate || 2;
        const depreciation = (vehicle.currentMileage || 0) * depreciationRate;
        depreciationArr.push(depreciation);
      }
      setUsageData(usageArr);
      setExpenseData(expenseArr);
      setDepreciationData(depreciationArr);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">กำลังโหลดข้อมูล...</div>;
  }

  const labels = vehicles.map(v => v.licensePlate || v.id);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">วิเคราะห์การใช้งานรถแต่ละคัน</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 lg:col-span-1">
          <VehicleUsageTable />
        </div>
        <div className="col-span-1">
          <h2 className="text-lg font-semibold mb-2">จำนวนรอบการใช้งาน</h2>
          <Bar
            data={{
              labels,
              datasets: [{
                label: "จำนวนรอบการใช้งาน",
                data: usageData,
                backgroundColor: "#0ea5e9",
              }],
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>
        <div className="col-span-1">
          <h2 className="text-lg font-semibold mb-2">ค่าใช้จ่ายรวม</h2>
          <Bar
            data={{
              labels,
              datasets: [{
                label: "ค่าใช้จ่าย (บาท)",
                data: expenseData,
                backgroundColor: "#14b8a6",
              }],
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
          <h2 className="text-lg font-semibold mt-8 mb-2">ค่าเสื่อมราคา (ประมาณ)</h2>
          <Bar
            data={{
              labels,
              datasets: [{
                label: "ค่าเสื่อมราคา (บาท)",
                data: depreciationData,
                backgroundColor: "#f59e42",
              }],
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>
      </div>
    </div>
  );
}

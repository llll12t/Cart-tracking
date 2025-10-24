"use client";

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function VehiclesAnalysisPage() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState({
    totalTrips: 0,
    totalDistance: 0,
    totalExpenses: 0,
    totalFuelExpenses: 0,
    fuelRecords: [],
    averageFuelEfficiency: 0,
    costPerKm: 0,
  });

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const vehiclesSnap = await getDocs(collection(db, 'vehicles'));
        const vehiclesList = vehiclesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setVehicles(vehiclesList);
      } catch (error) {
        console.error('Error fetching vehicles:', error);
      }
    };
    fetchVehicles();
  }, []);

  useEffect(() => {
    const fetchAnalysisData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        let startDateTime = new Date();
        let endDateTime = now;

        switch (dateRange) {
          case 'today':
            startDateTime.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDateTime.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDateTime.setMonth(now.getMonth() - 1);
            break;
          case 'custom':
            if (startDate && endDate) {
              startDateTime = new Date(startDate);
              endDateTime = new Date(endDate);
            }
            break;
        }

        let expensesQuery = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
        const expensesSnap = await getDocs(expensesQuery);
        let allExpenses = expensesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
        }));

        if (selectedVehicle !== 'all') {
          allExpenses = allExpenses.filter(exp => exp.vehicleId === selectedVehicle);
        }

        allExpenses = allExpenses.filter(exp => {
          const expDate = exp.timestamp;
          return expDate >= startDateTime && expDate <= endDateTime;
        });

        const fuelExpenses = allExpenses.filter(exp => exp.type === 'fuel' && exp.mileage);
        const sortedFuelExpenses = [...fuelExpenses].sort((a, b) => a.mileage - b.mileage);
        
        const fuelRecords = sortedFuelExpenses.map((exp, index) => {
          let distanceTraveled = 0;
          let fuelEfficiency = null;
          let costPerKm = null;

          if (index > 0) {
            const prevExp = sortedFuelExpenses[index - 1];
            distanceTraveled = exp.mileage - prevExp.mileage;
            
            if (distanceTraveled > 0 && exp.amount > 0) {
              const fuelPrice = 40;
              const liters = exp.amount / fuelPrice;
              fuelEfficiency = distanceTraveled / liters;
              costPerKm = exp.amount / distanceTraveled;
            }
          }

          return { ...exp, distanceTraveled, fuelEfficiency, costPerKm };
        });

        const validEfficiencies = fuelRecords.filter(r => r.fuelEfficiency !== null);
        const avgFuelEfficiency = validEfficiencies.length > 0
          ? validEfficiencies.reduce((sum, r) => sum + r.fuelEfficiency, 0) / validEfficiencies.length
          : 0;

        const totalExpenses = allExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const totalFuelExpenses = fuelExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

        let usageQuery = query(collection(db, 'vehicle-usage'));
        const usageSnap = await getDocs(usageQuery);
        let usageData = usageSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startTime: doc.data().startTime?.toDate ? doc.data().startTime.toDate() : new Date(doc.data().startTime)
        }));

        if (selectedVehicle !== 'all') {
          usageData = usageData.filter(usage => usage.vehicleId === selectedVehicle);
        }

        usageData = usageData.filter(usage => {
          const usageDate = usage.startTime;
          return usageDate >= startDateTime && usageDate <= endDateTime;
        });

        const totalDistance = usageData.reduce((sum, usage) => sum + (usage.totalDistance || 0), 0);
        const costPerKm = totalDistance > 0 ? totalExpenses / totalDistance : 0;

        setAnalysisData({
          totalTrips: usageData.length,
          totalDistance,
          totalExpenses,
          totalFuelExpenses,
          fuelRecords: fuelRecords.reverse(),
          averageFuelEfficiency: avgFuelEfficiency,
          costPerKm,
        });

      } catch (error) {
        console.error('Error fetching analysis data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [selectedVehicle, dateRange, startDate, endDate]);

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

   return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">วิเคราะห์การใช้รถ</h1>
      
      {/* Filters Card */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลือกรถ</label>
            <select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="all">รถทั้งหมด</option>
              {vehicles.map(v => (<option key={v.id} value={v.id}>{v.licensePlate} - {v.brand} {v.model}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลือกช่วงเวลา</label>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="today">วันนี้</option>
              <option value="week">7 วันที่ผ่านมา</option>
              <option value="month">30 วันที่ผ่านมา</option>
              <option value="custom">กำหนดเอง</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <div className="md:col-span-3 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่เริ่มต้น</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สิ้นสุด</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <>
          {/* Usage Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">จำนวนครั้งที่ใช้งาน</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{analysisData.totalTrips}</div>
              <div className="text-xs text-gray-500 mt-1">ครั้ง</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">ระยะทางรวม</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{analysisData.totalDistance.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">กม.</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">ค่าใช้จ่ายรวม</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{analysisData.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-gray-500 mt-1">บาท</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">ต้นทุนต่อ กม.</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{analysisData.costPerKm.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">บาท/กม.</div>
            </div>
          </div>
          
          {/* Fuel Analysis Cards */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold mb-4">การวิเคราะห์น้ำมัน</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">จำนวนครั้งที่เติมน้ำมัน</div>
                <div className="text-3xl font-bold text-blue-600">{analysisData.fuelRecords.length}</div>
                <div className="text-xs text-gray-500 mt-1">ครั้ง</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">อัตราสิ้นเปลืองเฉลี่ย</div>
                <div className="text-3xl font-bold text-green-600">{analysisData.averageFuelEfficiency > 0 ? analysisData.averageFuelEfficiency.toFixed(2) : '-'}</div>
                <div className="text-xs text-gray-500 mt-1">กม./ลิตร</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">ค่าน้ำมันรวม</div>
                <div className="text-3xl font-bold text-purple-600">{analysisData.totalFuelExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs text-gray-500 mt-1">บาท</div>
              </div>
            </div>
          </div>
          
          {/* Fuel History Table */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">ประวัติการเติมน้ำมัน</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่เติม</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขไมล์</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ระยะทางที่วิ่ง</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">จำนวนเงิน</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">อัตราสิ้นเปลือง</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ต้นทุน/กม.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analysisData.fuelRecords.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูลการเติมน้ำมันในช่วงเวลานี้</td>
                    </tr>
                  ) : (
                    analysisData.fuelRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{formatDate(record.timestamp)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.mileage?.toLocaleString() || '-'} กม.</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.distanceTraveled > 0 ? (<span className="text-teal-600 font-medium">{record.distanceTraveled.toLocaleString()} กม.</span>) : (<span className="text-gray-400">-</span>)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท</td>
                        <td className="px-4 py-3 text-sm">{record.fuelEfficiency !== null ? (<span className={`font-medium ${record.fuelEfficiency > 10 ? 'text-green-600' : record.fuelEfficiency >= 7 ? 'text-yellow-600' : 'text-red-600'}`}>{record.fuelEfficiency.toFixed(2)} กม./ลิตร</span>) : (<span className="text-gray-400">-</span>)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.costPerKm !== null ? `${record.costPerKm.toFixed(2)} บาท/กม.` : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{record.note || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

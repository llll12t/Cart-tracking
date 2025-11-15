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
  // ช่องกำหนด threshold
  const [threshold, setThreshold] = useState(10);
  
  // Pagination state for fuel records
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Run analysis after vehicles are loaded
  useEffect(() => {
    if (vehicles.length > 0) {
      setSelectedVehicle('all');
    }
  }, [vehicles]);

  // Always fetch analysis when vehicles are loaded (initial load)
  useEffect(() => {
    if (vehicles.length > 0 && selectedVehicle === 'all') {
      // force analysis fetch for initial load
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
          let totalDistance = vehicles.reduce((sum, v) => {
            const vStartMileage = v.currentMileage !== undefined && v.currentMileage !== null ? Number(v.currentMileage) : null;
            const vFuelRecords = fuelExpenses.filter(r => r.vehicleId === v.id && r.mileage !== undefined && r.mileage !== null);
            if (vFuelRecords.length > 0 && vStartMileage !== null) {
              const maxMileage = Math.max(...vFuelRecords.map(r => Number(r.mileage)));
              return sum + (maxMileage - vStartMileage);
            }
            return sum;
          }, 0);
          const totalTrips = fuelRecords.length;
          const costPerKm = totalDistance > 0 ? totalExpenses / totalDistance : 0;
          setAnalysisData({
            totalTrips,
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
    }
  }, [vehicles, selectedVehicle, dateRange, startDate, endDate]);

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

        let totalDistance = 0;
        let totalTrips = 0;
        if (selectedVehicle !== 'all') {
          // Use vehicles[].currentMileage as starting mileage, and max mileage from fuel records for selected vehicle
          const vehicleObj = vehicles.find(v => v.id === selectedVehicle);
          const startMileage = vehicleObj?.currentMileage !== undefined && vehicleObj?.currentMileage !== null ? Number(vehicleObj.currentMileage) : null;
          const vehicleFuelRecords = fuelExpenses.filter(r => r.vehicleId === selectedVehicle && r.mileage !== undefined && r.mileage !== null);
          if (vehicleFuelRecords.length > 0 && startMileage !== null) {
            const maxMileage = Math.max(...vehicleFuelRecords.map(r => Number(r.mileage)));
            totalDistance = maxMileage - startMileage;
          } else {
            totalDistance = 0;
          }
          totalTrips = vehicleFuelRecords.length;
        } else {
          // For all vehicles, sum up distances for each vehicle using vehicles[].currentMileage as start and max mileage from fuel records as end
          totalDistance = vehicles.reduce((sum, v) => {
            const vStartMileage = v.currentMileage !== undefined && v.currentMileage !== null ? Number(v.currentMileage) : null;
            const vFuelRecords = fuelExpenses.filter(r => r.vehicleId === v.id && r.mileage !== undefined && r.mileage !== null);
            if (vFuelRecords.length > 0 && vStartMileage !== null) {
              const maxMileage = Math.max(...vFuelRecords.map(r => Number(r.mileage)));
              return sum + (maxMileage - vStartMileage);
            }
            return sum;
          }, 0);
          totalTrips = fuelRecords.length;
        }
        const costPerKm = totalDistance > 0 ? totalExpenses / totalDistance : 0;

        setAnalysisData({
          totalTrips,
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
                <span className="text-gray-600 text-sm">ต้นทุนต่อ กม.</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{analysisData.costPerKm.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">บาท/กม.</div>
            </div>
          </div>

          {/* รายชื่อรถที่มีอัตราสิ้นเปลืองต่ำกว่า threshold */}
          <div className="bg-white rounded-xl shadow p-6 mt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
              <h2 className="text-xl font-semibold">รถที่มีอัตราสิ้นเปลืองเฉลี่ยต่ำกว่าเกณฑ์</h2>
              <div className="flex items-center gap-2">
                <label htmlFor="threshold" className="text-sm text-gray-700">กำหนดเกณฑ์ (กม./ลิตร):</label>
                <input
                  id="threshold"
                  type="number"
                  min="1"
                  max="50"
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              {(() => {
                // Filter vehicles below threshold
                const filteredVehicles = vehicles.filter(vehicle => {
                  const vFuelRecords = analysisData.fuelRecords.filter(r => r.vehicleId === vehicle.id && r.fuelEfficiency !== null);
                  const avgEff = vFuelRecords.length > 0 ? (vFuelRecords.reduce((sum, r) => sum + r.fuelEfficiency, 0) / vFuelRecords.length) : 0;
                  return avgEff > 0 && avgEff < threshold;
                });
                if (filteredVehicles.length === 0) {
                  return <div className="text-center text-gray-500 py-8">ไม่มีรถที่มีอัตราสิ้นเปลืองต่ำกว่า {threshold} กม./ลิตร</div>;
                }
                return (
                  <table className="min-w-[400px] w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left">ทะเบียนรถ</th>
                        <th className="px-4 py-2 text-left">ยี่ห้อ/รุ่น</th>
                        <th className="px-4 py-2 text-left">อัตราสิ้นเปลืองเฉลี่ย (กม./ลิตร)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVehicles.map(vehicle => {
                        const vFuelRecords = analysisData.fuelRecords.filter(r => r.vehicleId === vehicle.id && r.fuelEfficiency !== null);
                        const avgEff = vFuelRecords.length > 0 ? (vFuelRecords.reduce((sum, r) => sum + r.fuelEfficiency, 0) / vFuelRecords.length) : 0;
                        return (
                          <tr key={vehicle.id} className="border-b hover:bg-orange-50">
                            <td className="px-4 py-2 font-bold text-red-600">{vehicle.licensePlate}</td>
                            <td className="px-4 py-2">{vehicle.brand} {vehicle.model}</td>
                            <td className="px-4 py-2 font-bold">{avgEff > 0 ? avgEff.toFixed(2) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
          
          {/* Fuel Analysis Cards */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold mb-4">การวิเคราะห์น้ำมัน</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">เลขไมล์ล่าสุดที่เติมน้ำมัน</div>
                <div className="text-3xl font-bold text-orange-600">
                  {analysisData.fuelRecords.length > 0 ? analysisData.fuelRecords[0].mileage?.toLocaleString() : '-'}
                </div>
                <div className="text-xs text-gray-500 mt-1">กม.</div>
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
                    (() => {
                      const totalPages = Math.ceil(analysisData.fuelRecords.length / itemsPerPage);
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const currentRecords = analysisData.fuelRecords.slice(startIndex, endIndex);
                      
                      return currentRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{formatDate(record.timestamp)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{record.mileage?.toLocaleString() || '-'} กม.</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{record.distanceTraveled > 0 ? (<span className="text-teal-600 font-medium">{record.distanceTraveled.toLocaleString()} กม.</span>) : (<span className="text-gray-400">-</span>)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{record.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท</td>
                          <td className="px-4 py-3 text-sm">{record.fuelEfficiency !== null ? (<span className={`font-medium ${record.fuelEfficiency > 10 ? 'text-green-600' : record.fuelEfficiency >= 7 ? 'text-yellow-600' : 'text-red-600'}`}>{record.fuelEfficiency.toFixed(2)} กม./ลิตร</span>) : (<span className="text-gray-400">-</span>)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{record.costPerKm !== null ? `${record.costPerKm.toFixed(2)} บาท/กม.` : '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{record.note || '-'}</td>
                        </tr>
                      ));
                    })()
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {analysisData.fuelRecords.length > 0 && (
              <div className="px-6 py-4 border-t bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    แสดง {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, analysisData.fuelRecords.length)} จาก {analysisData.fuelRecords.length} รายการ
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* First page button */}
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    {/* Previous page button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    {/* Page numbers (max 3 visible) */}
                    <div className="hidden sm:flex items-center gap-1">
                      {(() => {
                        const totalPages = Math.ceil(analysisData.fuelRecords.length / itemsPerPage);
                        let startPage = Math.max(1, currentPage - 1);
                        let endPage = Math.min(totalPages, startPage + 2);
                        
                        if (endPage - startPage < 2) {
                          startPage = Math.max(1, endPage - 2);
                        }
                        
                        const pages = [];
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              className={`min-w-[40px] px-3 py-2 rounded-lg border transition-colors ${
                                currentPage === i
                                  ? 'bg-teal-600 text-white border-teal-600'
                                  : 'border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {i}
                            </button>
                          );
                        }
                        return pages;
                      })()}
                    </div>
                    
                    {/* Next page button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(analysisData.fuelRecords.length / itemsPerPage), prev + 1))}
                      disabled={currentPage === Math.ceil(analysisData.fuelRecords.length / itemsPerPage)}
                      className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    {/* Last page button */}
                    <button
                      onClick={() => setCurrentPage(Math.ceil(analysisData.fuelRecords.length / itemsPerPage))}
                      disabled={currentPage === Math.ceil(analysisData.fuelRecords.length / itemsPerPage)}
                      className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
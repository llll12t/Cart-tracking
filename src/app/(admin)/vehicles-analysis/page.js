"use client";

import { useState, useEffect } from 'react';
import { collection, query, orderBy, doc, setDoc, onSnapshot } from 'firebase/firestore';
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
    // เรียลไทม์ vehicles
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // เรียลไทม์ threshold
    const unsubThreshold = onSnapshot(doc(db, 'settings', 'fuelEfficiencyThreshold'), (docSnap) => {
      if (docSnap.exists()) {
        setThreshold(docSnap.data().value || 10);
      }
    });

    return () => {
      unsubVehicles();
      unsubThreshold();
    };
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
      // เรียลไทม์ expenses
      setLoading(true);
      const expensesQueryRef = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
      const unsubExpenses = onSnapshot(expensesQueryRef, (expensesSnap) => {
        let allExpenses = expensesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
        }));

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

        allExpenses = allExpenses.filter(exp => {
          const expDate = exp.timestamp;
          return expDate >= startDateTime && expDate <= endDateTime;
        });

        const fuelExpenses = allExpenses.filter(exp => exp.type === 'fuel' && exp.mileage);

        // คำนวณ fuelRecords แยกรถแต่ละคัน
        let allFuelRecords = [];
        vehicles.forEach(vehicle => {
          const vFuelRecords = fuelExpenses
            .filter(r => r.vehicleId === vehicle.id && r.mileage !== undefined && r.mileage !== null)
            .sort((a, b) => a.mileage - b.mileage);
          vFuelRecords.forEach((exp, index) => {
            let distanceTraveled = 0;
            let fuelEfficiency = null;
            let costPerKm = null;
            if (index > 0) {
              const prevExp = vFuelRecords[index - 1];
              distanceTraveled = exp.mileage - prevExp.mileage;

              // [แก้ไข] ใช้ prevExp.amount (ยอดเติมครั้งก่อน) มาคำนวณ
              if (distanceTraveled > 0 && prevExp.amount > 0) {
                fuelEfficiency = (distanceTraveled / prevExp.amount) * 1000;
                costPerKm = prevExp.amount / distanceTraveled;
              }
            }
            allFuelRecords.push({ ...exp, distanceTraveled, fuelEfficiency, costPerKm });
          });
        });

        const validEfficiencies = allFuelRecords.filter(r => r.fuelEfficiency !== null);
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
        const totalTrips = allFuelRecords.length;
        // costPerKm รวม (คิดจาก totalExpenses / totalDistance) อาจจะไม่แม่นยำถ้าระยะทางรวมไม่สัมพันธ์กับ expenses ทั้งหมด
        // แต่ในที่นี้คง logic เดิมไว้ หรือจะปรับให้ใช้ avg costPerKm ก็ได้
        const costPerKm = totalDistance > 0 ? totalExpenses / totalDistance : 0;

        setAnalysisData({
          totalTrips,
          totalDistance,
          totalExpenses,
          totalFuelExpenses,
          fuelRecords: allFuelRecords.reverse(),
          averageFuelEfficiency: avgFuelEfficiency,
          costPerKm,
        });
        setLoading(false);
      });
      return () => unsubExpenses();
    }
  }, [vehicles, selectedVehicle, dateRange, startDate, endDate]);

  useEffect(() => {
    // เรียลไทม์ expenses เฉพาะเมื่อเลือกคันเดียว
    if (vehicles.length > 0 && selectedVehicle !== 'all') {
      setLoading(true);
      const expensesQueryRef = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
      const unsubExpenses = onSnapshot(expensesQueryRef, (expensesSnap) => {
        let allExpenses = expensesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
        }));

        if (selectedVehicle !== 'all') {
          allExpenses = allExpenses.filter(exp => exp.vehicleId === selectedVehicle);
        }

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

            // [แก้ไข] ใช้ prevExp.amount (ยอดเติมครั้งก่อน) มาคำนวณ
            if (distanceTraveled > 0 && prevExp.amount > 0) {
              fuelEfficiency = (distanceTraveled / prevExp.amount) * 1000;
              costPerKm = prevExp.amount / distanceTraveled;
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
        setLoading(false);
      });
      return () => unsubExpenses();
    }
  }, [vehicles, selectedVehicle, dateRange, startDate, endDate]);

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

  const saveThreshold = async () => {
    try {
      await setDoc(doc(db, 'settings', 'fuelEfficiencyThreshold'), {
        value: threshold,
        updatedAt: new Date()
      });
      alert('บันทึกเกณฑ์เรียบร้อย');
    } catch (error) {
      console.error('Error saving threshold:', error);
      alert('ไม่สามารถบันทึกเกณฑ์ได้');
    }
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
          <div className="bg-white rounded-xl shadow p-4 sm:p-6 mt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
              <h2 className="text-lg sm:text-xl font-semibold">รถที่มีค่าวิ่งได้เฉลี่ยต่ำกว่าเกณฑ์</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <label htmlFor="threshold" className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">กำหนดเกณฑ์ (กม./1000 บาท):</label>
                <input
                  id="threshold"
                  type="number"
                  min="1"
                  max="1000"
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-16 sm:w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-center text-sm"
                />
                <button
                  onClick={saveThreshold}
                  className="px-3 py-1 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700 transition"
                >
                  บันทึก
                </button>
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
                  return <div className="text-center text-gray-500 py-8">ไม่มีรถที่มีค่าวิ่งได้ต่ำกว่า {threshold} กม./1000 บาท</div>;
                }
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs sm:text-sm">ทะเบียนรถ</th>
                        <th className="px-3 py-2 text-left text-xs sm:text-sm hidden sm:table-cell">ยี่ห้อ/รุ่น</th>
                        <th className="px-3 py-2 text-left text-xs sm:text-sm">ค่าวิ่งได้เฉลี่ย<br className="sm:hidden" /><span className="hidden sm:inline"> (กม./1000 บาท)</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVehicles.map(vehicle => {
                        const vFuelRecords = analysisData.fuelRecords.filter(r => r.vehicleId === vehicle.id && r.fuelEfficiency !== null);
                        const avgEff = vFuelRecords.length > 0 ? (vFuelRecords.reduce((sum, r) => sum + r.fuelEfficiency, 0) / vFuelRecords.length) : 0;
                        return (
                          <tr key={vehicle.id} className="border-b hover:bg-orange-50">
                            <td className="px-3 py-2 text-xs sm:text-sm">
                              <div className="font-bold text-red-600">{vehicle.licensePlate}</div>
                              <div className="text-gray-600 text-xs sm:hidden mt-1">{vehicle.brand} {vehicle.model}</div>
                            </td>
                            <td className="px-3 py-2 text-xs sm:text-sm hidden sm:table-cell">{vehicle.brand} {vehicle.model}</td>
                            <td className="px-3 py-2 text-xs sm:text-sm font-bold">{avgEff > 0 ? avgEff.toFixed(2) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* กราฟค่าวิ่งได้ของรถแต่ละคัน - Multi-Line Chart */}
          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">กราฟค่าวิ่งได้รายคัน (1 เดือนที่ผ่านมา)</h2>
            {(() => {
              // เตรียมข้อมูลสำหรับกราฟ
              const chartData = vehicles.map(vehicle => {
                const vFuelRecords = analysisData.fuelRecords
                  .filter(r => r.vehicleId === vehicle.id && r.fuelEfficiency !== null)
                  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                return {
                  vehicle,
                  records: vFuelRecords,
                  color: `hsl(${Math.random() * 360}, 70%, 50%)`
                };
              }).filter(v => v.records.length > 0);

              if (chartData.length === 0) {
                return <div className="text-center text-gray-500 py-8">ไม่มีข้อมูลรถ</div>;
              }

              // หาค่าสูงสุดและต่ำสุดสำหรับ scale
              const allEfficiencies = chartData.flatMap(v => v.records.map(r => r.fuelEfficiency));
              const maxEff = Math.max(...allEfficiencies, 1000);
              const minEff = Math.min(...allEfficiencies, 0);
              const chartHeight = 400;
              const chartPadding = { top: 20, right: 20, bottom: 60, left: 60 };
              const svgWidth = 1000;

              // สร้าง scale สำหรับแกน Y
              const yScale = (value) => {
                return chartHeight - chartPadding.bottom - ((value - minEff) / (maxEff - minEff)) * (chartHeight - chartPadding.top - chartPadding.bottom);
              };

              // สร้างจุดข้อมูลทั้งหมดเรียงตามวันที่
              const allDates = [...new Set(chartData.flatMap(v =>
                v.records.map(r => new Date(r.timestamp).toLocaleDateString('th-TH'))
              ))].sort();

              const xScale = (index) => {
                return chartPadding.left + (index / (allDates.length - 1 || 1)) * (svgWidth - chartPadding.left - chartPadding.right);
              };

              return (
                <div className="w-full">
                  <svg width="100%" height={chartHeight} viewBox={`0 0 ${svgWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" className="mx-auto">
                    {/* แกน Y */}
                    <line
                      x1={chartPadding.left}
                      y1={chartPadding.top}
                      x2={chartPadding.left}
                      y2={chartHeight - chartPadding.bottom}
                      stroke="#d1d5db"
                      strokeWidth="2"
                    />

                    {/* แกน X */}
                    <line
                      x1={chartPadding.left}
                      y1={chartHeight - chartPadding.bottom}
                      x2={svgWidth - chartPadding.right}
                      y2={chartHeight - chartPadding.bottom}
                      stroke="#d1d5db"
                      strokeWidth="2"
                    />

                    {/* Grid lines และ Y labels */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const value = minEff + (maxEff - minEff) * ratio;
                      const y = yScale(value);
                      return (
                        <g key={ratio}>
                          <line
                            x1={chartPadding.left}
                            y1={y}
                            x2={svgWidth - chartPadding.right}
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                            strokeDasharray="4"
                          />
                          <text
                            x={chartPadding.left - 10}
                            y={y + 5}
                            textAnchor="end"
                            fontSize="12"
                            fill="#6b7280"
                          >
                            {value.toFixed(0)}
                          </text>
                        </g>
                      );
                    })}

                    {/* X labels (วันที่) */}
                    {allDates.map((date, index) => {
                      const x = xScale(index);
                      return (
                        <text
                          key={index}
                          x={x}
                          y={chartHeight - chartPadding.bottom + 20}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#6b7280"
                          transform={`rotate(-45, ${x}, ${chartHeight - chartPadding.bottom + 20})`}
                        >
                          {date}
                        </text>
                      );
                    })}

                    {/* เส้นกราฟของแต่ละคัน */}
                    {chartData.map((vehicleData, vIndex) => {
                      const points = vehicleData.records.map((record, index) => {
                        const dateStr = new Date(record.timestamp).toLocaleDateString('th-TH');
                        const dateIndex = allDates.indexOf(dateStr);
                        const x = xScale(dateIndex);
                        const y = yScale(record.fuelEfficiency);
                        return { x, y, record };
                      });

                      const pathD = points.map((p, i) =>
                        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                      ).join(' ');

                      const colors = [
                        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
                        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
                      ];
                      const lineColor = colors[vIndex % colors.length];

                      return (
                        <g key={vehicleData.vehicle.id}>
                          {/* เส้น */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke={lineColor}
                            strokeWidth="2"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />

                          {/* จุดข้อมูล */}
                          {points.map((point, pIndex) => (
                            <g key={pIndex}>
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r="4"
                                fill={lineColor}
                                stroke="white"
                                strokeWidth="2"
                              />
                              <title>
                                {vehicleData.vehicle.licensePlate}: {point.record.fuelEfficiency.toFixed(2)} กม./1000฿
                              </title>
                            </g>
                          ))}
                        </g>
                      );
                    })}

                    {/* ป้ายแกน Y */}
                    <text
                      x={20}
                      y={chartHeight / 2}
                      textAnchor="middle"
                      fontSize="14"
                      fill="#374151"
                      fontWeight="600"
                      transform={`rotate(-90, 20, ${chartHeight / 2})`}
                    >
                      ค่าวิ่งได้ (กม./1000฿)
                    </text>

                    {/* ป้ายแกน X */}
                    <text
                      x={svgWidth / 2}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      fontSize="14"
                      fill="#374151"
                      fontWeight="600"
                    >
                      วันที่เติมน้ำมัน
                    </text>
                  </svg>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-2 sm:gap-4 justify-center mt-6">
                    {chartData.map((vehicleData, vIndex) => {
                      const colors = [
                        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
                        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
                      ];
                      const lineColor = colors[vIndex % colors.length];
                      const avgEff = vehicleData.records.reduce((sum, r) => sum + r.fuelEfficiency, 0) / vehicleData.records.length;

                      return (
                        <div key={vehicleData.vehicle.id} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: lineColor }}
                          ></div>
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            {vehicleData.vehicle.licensePlate}
                          </span>
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            (เฉลี่ย: {avgEff.toFixed(2)} กม./1000฿)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Fuel Analysis Cards */}
          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">การวิเคราะห์น้ำมัน</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                <div className="text-xs sm:text-sm text-gray-600 mb-2">จำนวนครั้งที่เติมน้ำมัน</div>
                <div className="text-xl sm:text-3xl font-bold text-blue-600">{analysisData.fuelRecords.length}</div>
                <div className="text-xs text-gray-500 mt-1">ครั้ง</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                <div className="text-xs sm:text-sm text-gray-600 mb-2">ค่าวิ่งได้เฉลี่ย</div>
                <div className="text-xl sm:text-3xl font-bold text-green-600">{analysisData.averageFuelEfficiency > 0 ? analysisData.averageFuelEfficiency.toFixed(2) : '-'}</div>
                <div className="text-xs text-gray-500 mt-1">กม./1000 บาท</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
                <div className="text-xs sm:text-sm text-gray-600 mb-2">ค่าน้ำมันรวม</div>
                <div className="text-xl sm:text-3xl font-bold text-purple-600">{analysisData.totalFuelExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs text-gray-500 mt-1">บาท</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg">
                <div className="text-xs sm:text-sm text-gray-600 mb-2">เลขไมล์ล่าสุดที่เติมน้ำมัน</div>
                <div className="text-xl sm:text-3xl font-bold text-orange-600">
                  {analysisData.fuelRecords.length > 0 ? analysisData.fuelRecords[0].mileage?.toLocaleString() : '-'}
                </div>
                <div className="text-xs text-gray-500 mt-1">กม.</div>
              </div>
            </div>
          </div>

          {/* Fuel History Table - Mobile Responsive */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="p-4 sm:p-6 border-b">
              <h2 className="text-lg sm:text-xl font-semibold">ประวัติการเติมน้ำมัน</h2>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ทะเบียนรถ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่เติม</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขไมล์</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ระยะทางที่วิ่ง</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">จำนวนเงิน</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ค่าวิ่งได้</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ต้นทุน/กม.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analysisData.fuelRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูลการเติมน้ำมันในช่วงเวลานี้</td>
                    </tr>
                  ) : (
                    (() => {
                      const totalPages = Math.ceil(analysisData.fuelRecords.length / itemsPerPage);
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const currentRecords = analysisData.fuelRecords.slice(startIndex, endIndex);

                      return currentRecords.map((record) => {
                        const vehicle = vehicles.find(v => v.id === record.vehicleId);
                        return (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{vehicle ? vehicle.licensePlate : '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{formatDate(record.timestamp)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.mileage?.toLocaleString() || '-'} กม.</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.distanceTraveled > 0 ? (<span className="text-teal-600 font-medium">{record.distanceTraveled.toLocaleString()} กม.</span>) : (<span className="text-gray-400">-</span>)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท</td>
                            <td className="px-4 py-3 text-sm">{record.fuelEfficiency !== null ? (<span className={`font-medium ${record.fuelEfficiency > 500 ? 'text-green-600' : record.fuelEfficiency >= 300 ? 'text-yellow-600' : 'text-red-600'}`}>{record.fuelEfficiency.toFixed(2)} กม./1000฿</span>) : (<span className="text-gray-400">-</span>)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.costPerKm !== null ? `${record.costPerKm.toFixed(2)} บาท/กม.` : '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{record.note || '-'}</td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200">
              {analysisData.fuelRecords.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูลการเติมน้ำมันในช่วงเวลานี้</div>
              ) : (
                (() => {
                  const totalPages = Math.ceil(analysisData.fuelRecords.length / itemsPerPage);
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const currentRecords = analysisData.fuelRecords.slice(startIndex, endIndex);

                  return currentRecords.map((record) => {
                    const vehicle = vehicles.find(v => v.id === record.vehicleId);
                    return (
                      <div key={record.id} className="p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold text-gray-900">{vehicle ? vehicle.licensePlate : '-'}</div>
                            <div className="text-xs text-gray-500 mt-1">{formatDate(record.timestamp)}</div>
                          </div>
                          {record.fuelEfficiency !== null && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${record.fuelEfficiency > 500 ? 'bg-green-100 text-green-700' : record.fuelEfficiency >= 300 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {record.fuelEfficiency.toFixed(2)} กม./1000฿
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                          <div>
                            <span className="text-gray-500">เลขไมล์:</span>
                            <span className="ml-1 text-gray-900">{record.mileage?.toLocaleString() || '-'} กม.</span>
                          </div>
                          <div>
                            <span className="text-gray-500">ระยะทาง:</span>
                            <span className="ml-1 text-gray-900">{record.distanceTraveled > 0 ? `${record.distanceTraveled.toLocaleString()} กม.` : '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">จำนวนเงิน:</span>
                            <span className="ml-1 text-gray-900 font-medium">{record.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ฿</span>
                          </div>
                          <div>
                            <span className="text-gray-500">ต้นทุน/กม.:</span>
                            <span className="ml-1 text-gray-900">{record.costPerKm !== null ? `${record.costPerKm.toFixed(2)} ฿` : '-'}</span>
                          </div>
                        </div>
                        {record.note && (
                          <div className="mt-2 text-sm">
                            <span className="text-gray-500">หมายเหตุ:</span>
                            <span className="ml-1 text-gray-700">{record.note}</span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Pagination */}
            {analysisData.fuelRecords.length > 0 && (
              <div className="px-4 sm:px-6 py-4 border-t bg-gray-50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-gray-600">
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
                              className={`min-w-[40px] px-3 py-2 rounded-lg border transition-colors ${currentPage === i
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

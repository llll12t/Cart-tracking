"use client";

import { useEffect, useState, Fragment } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, collectionGroup } from 'firebase/firestore';
import Image from 'next/image';
import { getImageUrl } from '@/lib/imageHelpers';


export default function TripHistoryPage() {
  function formatDateTime(ts) {
    if (!ts) return '-';
    try {
      let d;
      // Firestore timestamp
      if (ts.seconds && typeof ts.seconds === 'number') d = new Date(ts.seconds * 1000);
      // calendar-only string YYYY-MM-DD -> local midnight
      else if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ts)) {
        const parts = ts.split('-');
        d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0);
      } else d = new Date(ts);
      return d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '-';
    }
  }

  // ...existing code...

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  // For delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Delete trip logic
  const handleDeleteTrip = async () => {
    if (!deletingTrip) return;
    setIsDeleting(true);
    try {
      // Delete expenses related to this trip
      const { getDocs, query, collection, where, deleteDoc, doc: docRef } = await import('firebase/firestore');
      const expQ = query(collection(db, 'expenses'), where('usageId', '==', deletingTrip.id));
      const expSnap = await getDocs(expQ);
      for (const expDoc of expSnap.docs) {
        await deleteDoc(expDoc.ref);
      }
      // Delete the trip itself
      await deleteDoc(docRef(db, 'vehicle-usage', deletingTrip.id));
      setShowDeleteModal(false);
      setDeletingTrip(null);
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการลบ');
    }
    setIsDeleting(false);
  };

  useEffect(() => {
    // Load completed vehicle-usage records ordered by endTime desc
    const q = query(
      collection(db, 'vehicle-usage'), 
      where('status', '==', 'completed'), 
      orderBy('endTime', 'desc')
    );
    
    const unsub = onSnapshot(q, async (snap) => {
      const list = [];
      for (const docSnap of snap.docs) {
        const data = { id: docSnap.id, ...docSnap.data() };
        
        // Attach vehicle info
        try {
          if (data.vehicleId) {
            const vRef = doc(db, 'vehicles', data.vehicleId);
            const vSnap = await getDoc(vRef);
            if (vSnap.exists()) data.vehicle = { id: vSnap.id, ...vSnap.data() };
          }
        } catch (e) {
          console.warn('vehicle fetch failed', e);
        }

        // Fetch expenses related to this usage
        try {
          const expQ = query(collection(db, 'expenses'), where('usageId', '==', data.id));
          const snapshot = await (await import('firebase/firestore')).getDocs(expQ);
          data.expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          data.expenses = [];
        }

        list.push(data);
      }
      setTrips(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const loadExpensesFor = async (usage) => {
    try {
      const expQ = query(collection(db, 'expenses'), where('usageId', '==', usage.id));
      const snapshot = await (await import('firebase/firestore')).getDocs(expQ);
      const exps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTrips(prev => prev.map(t => t.id === usage.id ? { ...t, expenses: exps } : t));
    } catch (e) {
      console.warn('loadExpensesFor failed', e);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">กำลังโหลดประวัติการเดินทาง...</div>;

  // Filter trips
  const filteredTrips = trips.filter(trip => {
    // Search term (search in vehicle, user, destination, purpose)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (trip.vehicleLicensePlate?.toLowerCase().includes(search)) ||
        (trip.vehicle?.licensePlate?.toLowerCase().includes(search)) ||
        (trip.vehicle?.brand?.toLowerCase().includes(search)) ||
        (trip.vehicle?.model?.toLowerCase().includes(search)) ||
        (trip.userName?.toLowerCase().includes(search)) ||
        (trip.userId?.toLowerCase().includes(search)) ||
        (trip.destination?.toLowerCase().includes(search)) ||
        (trip.purpose?.toLowerCase().includes(search));
      
      if (!matchesSearch) return false;
    }
    
    // Filter by vehicle
    if (filterVehicle && trip.vehicleLicensePlate !== filterVehicle) {
      return false;
    }
    
    // Filter by user
    if (filterUser && trip.userName !== filterUser) {
      return false;
    }
    
    // Filter by date range
    if (filterDateFrom || filterDateTo) {
      const tripDate = trip.startTime?.seconds ? new Date(trip.startTime.seconds * 1000) : new Date(trip.startTime);
      
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        if (tripDate < fromDate) return false;
      }
      
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (tripDate > toDate) return false;
      }
    }
    
    return true;
  });

  // Get unique vehicles and users for filter dropdowns
  const uniqueVehicles = [...new Set(trips.map(t => t.vehicleLicensePlate).filter(Boolean))];
  const uniqueUsers = [...new Set(trips.map(t => t.userName).filter(Boolean))];

  // Pagination
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTrips = filteredTrips.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  const resetPage = () => setCurrentPage(1);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ประวัติการเดินทาง</h1>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ค้นหา
            </label>
            <input
              type="text"
              placeholder="ค้นหาทะเบียนรถ, ผู้ใช้, จุดหมาย..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Vehicle Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              รถ
            </label>
            <select
              value={filterVehicle}
              onChange={(e) => {
                setFilterVehicle(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ทั้งหมด</option>
              {uniqueVehicles.map((vehicle) => (
                <option key={vehicle} value={vehicle}>{vehicle}</option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ผู้ใช้งาน
            </label>
            <select
              value={filterUser}
              onChange={(e) => {
                setFilterUser(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ทั้งหมด</option>
              {uniqueUsers.map((user) => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ตั้งแต่วันที่
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ถึงวันที่
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {(searchTerm || filterVehicle || filterUser || filterDateFrom || filterDateTo) && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterVehicle('');
                setFilterUser('');
                setFilterDateFrom('');
                setFilterDateTo('');
                setCurrentPage(1);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              ล้างตัวกรอง
            </button>
            <span className="ml-4 text-sm text-gray-600">
              พบ {filteredTrips.length} รายการ
            </span>
          </div>
        )}
      </div>

      {trips.length === 0 && <div className="bg-white rounded p-6 shadow">ไม่พบประวัติการเดินทาง</div>}

      {trips.length > 0 && (
        <>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รถ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้ใช้</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จุดหมาย/วัตถุประสงค์</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ค่าใช้จ่าย</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentTrips.map(t => (
                  <Fragment key={t.id}>
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                            {getImageUrl(t.vehicle) ? (
                              <Image src={getImageUrl(t.vehicle)} alt={`${t.vehicle?.brand} ${t.vehicle?.model}`} width={48} height={48} className="object-cover" unoptimized />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">N/A</div>
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{t.vehicleLicensePlate || t.vehicle?.licensePlate || '-'}</div>
                            <div className="text-xs text-gray-500">{t.vehicle?.brand} {t.vehicle?.model}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{t.userName || t.userId || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDateTime(t.startTime)}</div>
                        <div className="text-xs text-gray-500">{formatDateTime(t.endTime)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{t.destination || '-'}</div>
                        <div className="text-xs text-gray-500">{t.purpose || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {(t.expenses && t.expenses.length) ? `${t.expenses.reduce((s, e) => s + (e.amount||0), 0)} บาท` : '-'}
                        </div>
                        {(t.expenses && t.expenses.length > 0) && (
                          <div className="text-xs text-gray-500">{t.expenses.length} รายการ</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={async () => { 
                              setExpandedId(expandedId === t.id ? null : t.id); 
                              if (!t.expenses || t.expenses.length === 0) await loadExpensesFor(t); 
                            }} 
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {expandedId === t.id ? 'ย่อ' : 'รายละเอียด'}
                          </button>
                          <button
                            onClick={() => { setShowDeleteModal(true); setDeletingTrip(t); }}
                            className="text-red-600 hover:text-red-900"
                          >ลบ</button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === t.id && (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 bg-gray-50">
                          <div className="text-sm font-semibold mb-2">รายละเอียดค่าใช้จ่าย</div>
                          {t.expenses && t.expenses.length > 0 ? (
                            <div className="space-y-2">
                              {t.expenses.map(exp => {
                                const typeMap = {
                                  'fuel': '⛽ เติมน้ำมัน',
                                  'fluid': '🛢️ เปลี่ยนของเหลว',
                                  'toll': '🛣️ ค่าทางด่วน',
                                  'parking': '🅿️ ค่าจอดรถ',
                                  'maintenance': '🔧 ค่าซ่อมบำรุง',
                                  'other': '💰 อื่นๆ'
                                };
                                const displayType = typeMap[exp.type] || exp.type || 'อื่นๆ';
                                return (
                                  <div key={exp.id} className="flex justify-between items-center py-2 border-b border-gray-200">
                                    <div>
                                      <span className="font-medium">{displayType}</span>
                                      {exp.note && <span className="text-gray-500 ml-2">- {exp.note}</span>}
                                      {exp.mileage && <span className="text-xs text-gray-400 ml-2">(ไมล์: {exp.mileage} กม.)</span>}
                                    </div>
                                    <div className="font-medium text-teal-600">{exp.amount || 0} ฿</div>
                                  </div>
                                );
                              })}
                              <div className="pt-2 flex justify-between font-semibold text-base">
                                <div>รวมทั้งหมด</div>
                                <div className="text-teal-600">{t.expenses.reduce((s, e) => s + (e.amount || 0), 0)} ฿</div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500">ไม่มีค่าใช้จ่ายที่บันทึก</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal ลบข้อมูล */}
          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4 text-red-700">ยืนยันการลบประวัติการเดินทาง</h2>
                <p className="mb-6">คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการเดินทางนี้? <br/> <span className="text-red-500 font-semibold">การลบนี้ไม่สามารถย้อนกลับได้</span></p>
                <div className="flex justify-end gap-4">
                  <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
                  <button onClick={handleDeleteTrip} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">{isDeleting ? 'กำลังลบ...' : 'ลบ'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-xl shadow">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ก่อนหน้า
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ถัดไป
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    แสดง <span className="font-medium">{startIndex + 1}</span> ถึง <span className="font-medium">{Math.min(endIndex, trips.length)}</span> จาก{' '}
                    <span className="font-medium">{trips.length}</span> รายการ
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    {/* First Page Button */}
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="หน้าแรก"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Page Numbers (show only 3 pages) */}
                    {(() => {
                      let pages = [];
                      let startPage = Math.max(1, currentPage - 1);
                      let endPage = Math.min(totalPages, startPage + 2);
                      
                      // Adjust if we're near the end
                      if (endPage - startPage < 2) {
                        startPage = Math.max(1, endPage - 2);
                      }
                      
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(i);
                      }
                      
                      return pages.map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ));
                    })()}
                    
                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Last Page Button */}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="หน้าสุดท้าย"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

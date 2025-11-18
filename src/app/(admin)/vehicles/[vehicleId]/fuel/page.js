"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import AddFuelLogForm from '@/components/admin/AddFuelLogForm';
import Image from 'next/image';

function FuelRecord({ record, onSelect, isSelected }) {
    const formatDateTime = (timestamp) => {
        if (!timestamp) return '-';
        let dateObj;
        if (timestamp.seconds) {
            dateObj = new Date(timestamp.seconds * 1000);
        } else {
            dateObj = new Date(timestamp);
        }
        return dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) +
            ' ' + dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };
    const formatCurrency = (number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(number);
    const efficiency = record.previousMileage && record.liters ? ((record.mileage - record.previousMileage) / record.liters).toFixed(2) : 'N/A';
    const pricePerLiter = record.liters > 0 ? (record.cost / record.liters) : 0;

    // แสดง badge แหล่งที่มา
    const sourceBadge = record.source === 'admin' ? (
        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">บันทึกจากพนักงาน</span>
    ) : record.usageId ? (
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">จากทริป</span>
    ) : null;

    // ดึงชื่อผู้เติมน้ำมัน (เฉพาะกรณี expenses)
    const [userName, setUserName] = useState('-');
    useEffect(() => {
        async function fetchUser() {
            const uid = (record.userId || '').toString().trim();
            if (uid) {
                try {
                    const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
                    // ลองค้นด้วย doc id ก่อน
                    const userRef = doc(db, 'users', uid);
                    const snap = await getDoc(userRef);
                    if (snap.exists()) {
                        const data = snap.data();
                        setUserName(data.name || data.fullName || '-');
                        return;
                    }
                    // ถ้าไม่เจอ ให้ค้น users ที่ lineId ตรงกับ userId
                    const q = query(collection(db, 'users'), where('lineId', '==', uid));
                    const qSnap = await getDocs(q);
                    if (!qSnap.empty) {
                        const data = qSnap.docs[0].data();
                        setUserName(data.name || data.fullName || '-');
                        return;
                    }
                    setUserName('-');
                } catch (err) {
                    setUserName('-');
                }
            } else {
                setUserName('-');
            }
        }
        fetchUser();
    }, [record.userId]);

    return (
        <tr className="hover:bg-gray-50">
            <td className="px-4 py-3 text-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(record.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
            </td>
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDateTime(record.date)}</td>
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{userName}</td>
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.mileage ? record.mileage.toLocaleString() + ' กม.' : '-'}</td>
            <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{formatCurrency(record.cost)}</td>
            <td className="px-4 py-3 text-sm text-gray-900">{sourceBadge}</td>
        </tr>
    );
}

export default function FuelPage() {
    const { vehicleId } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [fuelLogs, setFuelLogs] = useState([]);
    const [fuelExpenses, setFuelExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [lastMileage, setLastMileage] = useState(null);
    const [isReloading, setIsReloading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [itemToDelete, setItemToDelete] = useState(null);
    
    // Pagination and Filter states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSource, setFilterSource] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    useEffect(() => {
        if (!vehicleId) return;
        const vehicleRef = doc(db, "vehicles", vehicleId);
        getDoc(vehicleRef).then(docSnap => {
            if (docSnap.exists()) setVehicle({ id: docSnap.id, ...docSnap.data() });
        });

        // ดึง fuel_logs
        const q = query(
            collection(db, "fuel_logs"),
            where("vehicleId", "==", vehicleId),
            orderBy("date", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'fuel_logs' }));
            setFuelLogs(logsData);
        });

        // ดึง expenses ที่ type='fuel' และ vehicleId ตรง (real-time)
        const expensesQuery = query(
            collection(db, 'expenses'),
            where('vehicleId', '==', vehicleId),
            where('type', '==', 'fuel'),
            orderBy('timestamp', 'desc')
        );
        const unsubscribeExpenses = onSnapshot(expensesQuery, (expensesSnap) => {
            const fuelExps = expensesSnap.docs.map(d => ({ id: d.id, ...d.data(), source: 'expenses' }));
            setFuelExpenses(fuelExps);
            setLoading(false);
        }, (e) => {
            console.error('Error listening fuel expenses:', e);
            setLoading(false);
        });

        return () => {
            unsubscribe();
            unsubscribeExpenses();
        };
    }, [vehicleId]);

    // รวมข้อมูลจาก fuel_logs และ expenses
    const allFuelRecords = [
        ...fuelLogs,
        ...fuelExpenses.map(exp => {
            let date = exp.timestamp || exp.bookingData?.startDateTime || exp.createdAt || exp.date;
            // Support Firestore Timestamp and ISO/string
            if (date && typeof date === 'string') date = new Date(date);
            return {
                id: exp.id,
                date,
                cost: exp.amount || 0,
                source: 'expenses',
                note: exp.note || '',
                mileage: exp.mileage || null,
                userId: exp.userId || null
            };
        })
    ].sort((a, b) => {
        const at = a.date?.seconds ? a.date.seconds * 1000 : (a.date ? new Date(a.date).getTime() : 0);
        const bt = b.date?.seconds ? b.date.seconds * 1000 : (b.date ? new Date(b.date).getTime() : 0);
        return bt - at;
    });

    // หาเลขไมล์ล่าสุดที่เติมน้ำมัน
    useEffect(() => {
        if (allFuelRecords.length > 0) {
            // หา record ที่มี mileage มากที่สุด
            const withMileage = allFuelRecords.filter(r => r.mileage);
            if (withMileage.length > 0) {
                const maxMileage = Math.max(...withMileage.map(r => r.mileage));
                setLastMileage(maxMileage);
            } else {
                setLastMileage(null);
            }
        } else {
            setLastMileage(null);
        }
    }, [allFuelRecords]);

    // คำนวณราคารวมทั้งหมด
    const totalCost = allFuelRecords.reduce((sum, rec) => sum + (rec.cost || 0), 0);

    // Filter records
    const filteredRecords = allFuelRecords.filter(record => {
        // Search term (search in note, mileage, userId)
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const matchesSearch = 
                (record.note?.toLowerCase().includes(search)) ||
                (record.mileage?.toString().includes(search)) ||
                (record.userId?.toLowerCase().includes(search));
            
            if (!matchesSearch) return false;
        }
        
        // Filter by source
        if (filterSource && record.source !== filterSource) {
            return false;
        }
        
        // Filter by date range
        if (filterDateFrom || filterDateTo) {
            const recordDate = record.date?.seconds ? new Date(record.date.seconds * 1000) : new Date(record.date);
            
            if (filterDateFrom) {
                const fromDate = new Date(filterDateFrom);
                if (recordDate < fromDate) return false;
            }
            
            if (filterDateTo) {
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999); // End of day
                if (recordDate > toDate) return false;
            }
        }
        
        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentRecords = filteredRecords.slice(startIndex, endIndex);

    // Calculate page numbers to display
    const getPageNumbers = () => {
        const pages = [];
        const maxPagesToShow = 3;
        
        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 2) {
                pages.push(1, 2, 3);
            } else if (currentPage >= totalPages - 1) {
                pages.push(totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(currentPage - 1, currentPage, currentPage + 1);
            }
        }
        
        return pages;
    };

    const handleDeleteSelected = async () => {
        setShowDeleteConfirm(false);
        setIsReloading(true);
        try {
            const { deleteDoc, doc: docRef } = await import('firebase/firestore');
            const idsToDelete = itemToDelete ? [itemToDelete] : selectedItems;
            // Delete selected items (only from expenses, not fuel_logs)
            const deletePromises = idsToDelete.map(id => {
                // Only allow delete for expenses (not fuel_logs)
                const found = allFuelRecords.find(r => r.id === id);
                if (found && found.source === 'expenses') {
                    return deleteDoc(docRef(db, 'expenses', id));
                }
                return Promise.resolve();
            });
            await Promise.all(deletePromises);
            setSelectedItems([]);
            setItemToDelete(null);
            setIsReloading(false);
        } catch (error) {
            console.error('Error deleting fuel records:', error);
            alert('เกิดข้อผิดพลาดในการลบ');
            setIsReloading(false);
        }
    };

    const handleSelectAll = () => {
        // Only select expenses (not fuel_logs)
        const expenseIds = currentRecords.filter(r => r.source === 'expenses').map(r => r.id);
        if (selectedItems.length === expenseIds.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(expenseIds);
        }
    };

    const handleSelectItem = (id) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    if (loading) return <p>Loading fuel logs...</p>;

    return (
        <div>
            {vehicle && (
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center space-x-4">
                        {vehicle.imageUrl && (
                            <Image src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} width={96} height={64} className="object-cover rounded-md shadow" unoptimized />
                        )}
                        <div>
                            <h1 className="text-3xl font-bold">⛽ ประวัติการเติมน้ำมัน</h1>
                            <p className="text-xl text-gray-600">{vehicle.brand} {vehicle.model} ({vehicle.licensePlate})</p>
                            {lastMileage && (
                                <p className="text-md text-blue-700 font-semibold mt-2">เลขไมล์ล่าสุดที่เติมน้ำมัน: {lastMileage.toLocaleString()} กม.</p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {selectedItems.length > 0 && (
                            <button 
                                onClick={() => { setItemToDelete(null); setShowDeleteConfirm(true); }} 
                                className="px-4 py-2 font-bold text-white bg-red-600 rounded-lg hover:bg-red-700"
                            >
                                🗑️ ลบที่เลือก ({selectedItems.length})
                            </button>
                        )}
                        <button onClick={() => setShowForm(true)} className="px-4 py-2 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700">
                            + เพิ่มรายการเติมน้ำมัน
                        </button>
                    </div>
                </div>
            )}
            
            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            ค้นหา
                        </label>
                        <input
                            type="text"
                            placeholder="ค้นหาหมายเหตุ, เลขไมล์..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    
                    {/* Source Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            แหล่งที่มา
                        </label>
                        <select
                            value={filterSource}
                            onChange={(e) => {
                                setFilterSource(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">ทั้งหมด</option>
                            <option value="fuel_logs">เพิ่มด้วยตนเอง</option>
                            <option value="expenses">จากทริป</option>
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
                {(searchTerm || filterSource || filterDateFrom || filterDateTo) && (
                    <div className="mt-4">
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setFilterSource('');
                                setFilterDateFrom('');
                                setFilterDateTo('');
                                setCurrentPage(1);
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            ล้างตัวกรอง
                        </button>
                        <span className="ml-4 text-sm text-gray-600">
                            พบ {filteredRecords.length} รายการ (ค่าใช้จ่ายรวม: {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(filteredRecords.reduce((sum, rec) => sum + (rec.cost || 0), 0))})
                        </span>
                    </div>
                )}
            </div>
            
            <div className="space-y-4">{allFuelRecords.length > 0 && (
                    <div className="bg-gray-100 p-4 rounded-lg grid grid-cols-2 gap-4 font-bold text-gray-800">
                        <p>ราคารวมทั้งหมด</p>
                        <p className="text-right">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(totalCost)}</p>
                    </div>
                )}
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.length === currentRecords.filter(r => r.source === 'expenses').length && currentRecords.filter(r => r.source === 'expenses').length > 0}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่/เวลา</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้เติม</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขไมล์ที่เติม</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ราคา</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">แหล่งที่มา</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {currentRecords.length > 0 ? (
                                currentRecords.map(log => <FuelRecord key={log.id} record={log} onSelect={handleSelectItem} isSelected={selectedItems.includes(log.id)} />)
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        {allFuelRecords.length === 0 ? 'ยังไม่มีประวัติการเติมน้ำมัน' : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredRecords.length > itemsPerPage && (
                    <div className="bg-white rounded-lg shadow p-4 mt-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-700">
                                แสดงรายการที่ {startIndex + 1}-{Math.min(endIndex, filteredRecords.length)} จากทั้งหมด {filteredRecords.length} รายการ
                            </div>
                            <div className="flex items-center space-x-2">
                                {/* First Page Button */}
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded ${
                                        currentPage === 1
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border'
                                    }`}
                                >
                                    หน้าแรก
                                </button>
                                
                                {/* Previous Button */}
                                <button
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded ${
                                        currentPage === 1
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border'
                                    }`}
                                >
                                    ก่อนหน้า
                                </button>

                                {/* Page Numbers */}
                                {getPageNumbers().map(pageNum => (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`px-3 py-1 rounded ${
                                            currentPage === pageNum
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white text-gray-700 hover:bg-gray-100 border'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}

                                {/* Next Button */}
                                <button
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded ${
                                        currentPage === totalPages
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border'
                                    }`}
                                >
                                    ถัดไป
                                </button>

                                {/* Last Page Button */}
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded ${
                                        currentPage === totalPages
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border'
                                    }`}
                                >
                                    หน้าสุดท้าย
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {showForm && <AddFuelLogForm vehicleId={vehicleId} onClose={(success) => {
                setShowForm(false);
                if (success) {
                    setIsReloading(true);
                    setTimeout(() => {
                        window.location.reload();
                    }, 300);
                }
            }} />}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">⚠️ ยืนยันการลบ</h3>
                        <p className="text-gray-700 mb-6">
                            {itemToDelete 
                                ? 'คุณแน่ใจหรือไม่ที่จะลบรายการนี้?' 
                                : `คุณแน่ใจหรือไม่ที่จะลบ ${selectedItems.length} รายการที่เลือก?`
                            }
                            <br />
                            <span className="text-red-500 font-semibold">การกระทำนี้ไม่สามารถย้อนกลับได้</span>
                        </p>
                        <div className="flex justify-end gap-4">
                            <button 
                                onClick={() => { setShowDeleteConfirm(false); setItemToDelete(null); }} 
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                                ยกเลิก
                            </button>
                            <button 
                                onClick={handleDeleteSelected} 
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                ยืนยันลบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isReloading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
                        <p className="mt-4 text-white text-lg font-semibold">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import LogExpenseForm from '@/components/driver/LogExpenseForm';
import { useRouter } from 'next/navigation';

// Component สำหรับ Trip Card 1 ใบ
function TripCard({ trip }) {
    const [startMileage, setStartMileage] = useState('');
    const [endMileage, setEndMileage] = useState('');
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [vehicle, setVehicle] = useState(null);
    const [expenses, setExpenses] = useState([]);

    useEffect(() => {
        const vehicleRef = doc(db, "vehicles", trip.vehicleId);
        const unsubscribe = onSnapshot(vehicleRef, (doc) => {
            if (doc.exists()) {
                const vehicleData = doc.data();
                setVehicle(vehicleData);
                if (!startMileage && vehicleData.currentMileage) {
                    setStartMileage(vehicleData.currentMileage.toString());
                }
            }
        });
        return unsubscribe;
    }, [trip.vehicleId]);

    useEffect(() => {
        const q = query(collection(db, "expenses"), where("bookingId", "==", trip.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setExpenses(expensesData);
        });
        return unsubscribe;
    }, [trip.id]);

    const typeLabels = { fuel: 'น้ำมัน', maintenance: 'ซ่อมบำรุง', toll: 'ทางด่วน', parking: 'ค่าจอดรถ', other: 'อื่นๆ' };

    const formatDate = (timestamp) => {
        if (!timestamp?.seconds) return '-';
        return new Date(timestamp.seconds * 1000).toLocaleString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleStartTrip = async () => {
        if (!startMileage || isNaN(startMileage)) {
            alert('กรุณากรอกเลขไมล์เริ่มต้นให้ถูกต้อง');
            return;
        }

        const tripRef = doc(db, "bookings", trip.id);
        await updateDoc(tripRef, {
            status: "on_trip",
            startMileage: Number(startMileage),
        });
    };

    const handleEndTrip = async () => {
        if (!endMileage || isNaN(endMileage)) {
            alert('กรุณากรอกเลขไมล์สิ้นสุดให้ถูกต้อง');
            return;
        }
        if (Number(endMileage) <= trip.startMileage) {
            alert('เลขไมล์สิ้นสุดต้องมากกว่าเลขไมล์เริ่มต้น');
            return;
        }

        const batch = writeBatch(db);
        const tripRef = doc(db, "bookings", trip.id);
        batch.update(tripRef, {
            status: "completed",
            endMileage: Number(endMileage),
        });

        const vehicleRef = doc(db, "vehicles", trip.vehicleId);
        batch.update(vehicleRef, {
            status: "available",
            currentMileage: Number(endMileage)
        });
        
        await batch.commit();
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
                {/* Vehicle Info Section */}
                <div className="flex p-4 gap-4">
                    {/* Vehicle Image Placeholder */}
                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0"></div>
                    
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-gray-600">ยี่ห้อ</p>
                                <p className="font-semibold">{vehicle?.brand || '-'}</p>
                                <p className="text-sm text-gray-600 mt-1">รุ่น</p>
                                <p className="font-semibold">{vehicle?.model || '-'}</p>
                            </div>
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-300 text-gray-800">
                                {trip.status === 'approved' ? 'รอจ้างงาน' : 'กำลังทำงาน'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                            ทะเบียน <span className="font-semibold">{trip.vehicleLicensePlate || vehicle?.licensePlate || '-'}</span>
                        </p>
                    </div>
                </div>

                {/* Trip Details */}
                <div className="bg-white px-4 pb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="font-semibold">จุดเริ่ม</span>
                        <span className="text-gray-600">{trip.origin || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-semibold">จุดหมาย</span>
                        <span className="text-gray-600">{trip.destination || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-semibold">เลขไมล์</span>
                        <span className="text-gray-600">{vehicle?.currentMileage || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-semibold">กำหนดการเดินทาง</span>
                        <div className="text-right text-gray-600">
                            <div>{formatDate(trip.startDateTime)}</div>
                            {trip.endDateTime && (
                                <div className="text-xs">ถึง {formatDate(trip.endDateTime)}</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Purpose/Notes Section */}
                {trip.purpose && (
                    <div className="px-4 pb-4">
                        <p className="font-semibold text-sm mb-2">วัตถุประสงค์</p>
                        <div className="bg-gray-50 rounded-lg p-3 min-h-[60px] text-sm text-gray-600">
                            {trip.purpose}
                        </div>
                    </div>
                )}

                {/* Trip Actions */}
                {trip.status === 'approved' && (
                    <div className="px-4 pb-4">
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                placeholder="เลขไมล์เริ่มต้น"
                                value={startMileage}
                                onChange={(e) => setStartMileage(e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <button 
                                onClick={handleStartTrip} 
                                className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700"
                            >
                                เริ่มเดินทาง
                            </button>
                        </div>
                    </div>
                )}

                {trip.status === 'on_trip' && (
                    <div className="px-4 pb-4 space-y-3">
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                placeholder="เลขไมล์สิ้นสุด"
                                value={endMileage}
                                onChange={(e) => setEndMileage(e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <button 
                                onClick={handleEndTrip} 
                                className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
                            >
                                จบการเดินทาง
                            </button>
                        </div>
                        
                        <button 
                            onClick={() => setShowExpenseForm(true)} 
                            className="w-full py-3 bg-teal-50 text-teal-700 rounded-lg text-sm font-semibold hover:bg-teal-100 border border-teal-200"
                        >
                            + เพิ่มค่าใช้จ่าย
                        </button>

                        {expenses.length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="font-semibold text-sm mb-2">ค่าใช้จ่ายที่บันทึก ({expenses.length} รายการ)</p>
                                <div className="space-y-1">
                                    {expenses.map(exp => (
                                        <div key={exp.id} className="flex justify-between text-xs text-gray-600">
                                            <span>{typeLabels[exp.type]}</span>
                                            <span className="font-semibold">{exp.amount} บาท</span>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t border-gray-200 flex justify-between font-semibold text-sm">
                                        <span>รวมทั้งหมด</span>
                                        <span className="text-teal-600">{totalExpenses} บาท</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {showExpenseForm && <LogExpenseForm trip={trip} onClose={() => setShowExpenseForm(false)} />}
        </>
    );
}

// Page Component
export default function MyTripsPage() {
    const { user, userProfile } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ongoing'); // 'ongoing' or 'history'
    const router = useRouter();

    useEffect(() => {
        if (!user || !userProfile) {
            setLoading(false);
            return;
        };

        if (userProfile.role !== 'driver') {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "bookings"),
            where("driverId", "==", user.uid),
            where("status", "in", ["approved", "on_trip"]),
            orderBy("startDateTime", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tripsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTrips(tripsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile]);

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <p className="text-gray-500">กำลังโหลด...</p>
        </div>
    );
    
    if (userProfile?.role !== 'driver') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-center text-gray-600">หน้านี้สำหรับพนักงานขับรถเท่านั้น</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Header with User Profile */}
            <div className="bg-gradient-to-b from-[#075b50] to-[#002629] px-6 pt-8 pb-24">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-teal-800 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                            {userProfile?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="text-white">
                            <p className="font-semibold text-lg">{userProfile?.name || 'นายทดสอบการ'}</p>
                            <p className="text-sm text-teal-100">พนักงาน ขับ</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => router.push('/booking')}
                        className="px-6 py-2 bg-white text-teal-700 rounded-full font-semibold text-sm hover:bg-teal-50 transition-all"
                    >
                        จองรถ
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-3">
                    <button 
                        onClick={() => setActiveTab('ongoing')}
                        className={`flex-1 py-3 rounded-full font-semibold transition-all ${
                            activeTab === 'ongoing' 
                                ? 'bg-teal-800 text-white' 
                                : 'bg-teal-500/50 text-teal-100 hover:bg-teal-500/70'
                        }`}
                    >
                        เดินทาง
                    </button>
                    <button 
                        onClick={() => router.push('/my-bookings')}
                        className="flex-1 py-3 rounded-full font-semibold bg-teal-500/50 text-teal-100 hover:bg-teal-500/70 transition-all"
                    >
                        ประวัติการขับ
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-gray-100 p-4 -mt-16">
                {trips.length > 0 ? (
                    <div className="space-y-4 pb-8">
                        {trips.map(trip => <TripCard key={trip.id} trip={trip} />)}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <p className="text-gray-500">ไม่มีทริปที่ได้รับมอบหมายในขณะนี้</p>
                    </div>
                )}
            </div>
        </div>
    );
}
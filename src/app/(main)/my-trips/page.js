"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import LogExpenseForm from '@/components/driver/LogExpenseForm';
import Image from 'next/image';
import { getImageUrl } from '@/lib/imageHelpers';
import { useRouter } from 'next/navigation';
import MainHeader from '@/components/main/MainHeader';
import { createWorker } from 'tesseract.js';

// Component สำหรับ Trip Card 1 ใบ
function TripCard({ trip }) {
    const [startMileage, setStartMileage] = useState('');
    const [endMileage, setEndMileage] = useState('');
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [vehicle, setVehicle] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [scanType, setScanType] = useState(null); // 'start' or 'end'

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
    }, [trip.vehicleId, startMileage]);

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

        // Use a batch to update booking and vehicle atomically
        try {
            const batch = writeBatch(db);
            const tripRef = doc(db, "bookings", trip.id);
            batch.update(tripRef, {
                status: "on_trip",
                startMileage: Number(startMileage),
                startDateTime: serverTimestamp(),
            });

            const vehicleRef = doc(db, "vehicles", trip.vehicleId);
            batch.update(vehicleRef, {
                status: "in_use",
                // update vehicle's currentMileage to reflect start mileage
                currentMileage: Number(startMileage)
            });

            await batch.commit();
        } catch (e) {
            console.error('Failed to start trip batch update', e);
            alert('ไม่สามารถเริ่มทริปได้ในขณะนี้');
        }
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
            endDateTime: serverTimestamp(),
        });

        const vehicleRef = doc(db, "vehicles", trip.vehicleId);
        batch.update(vehicleRef, {
            status: "available",
            currentMileage: Number(endMileage)
        });
        
        try {
            await batch.commit();
        } catch (e) {
            console.error('Failed to commit end-trip batch', e);
            alert('ไม่สามารถบันทึกการคืนรถได้ กรุณาลองอีกครั้ง');
            return;
        }

        // หลัง commit สำเร็จ อัปเดตสถานะ vehicle ใน UI (local) ถ้ามี
        try {
            if (vehicle) {
                // update local state to reflect server-side change
                setVehicle(prev => ({ ...prev, status: 'available', currentMileage: Number(endMileage) }));
            }
        } catch (e) {
            console.warn('Failed to update local vehicle state after commit', e);
        }

        // แจ้งแอดมินเมื่อคืนรถ
        try {
            // ตรวจสอบการตั้งค่าการแจ้งเตือนก่อนส่ง
            const settingsRes = await fetch('/api/notifications/settings');
            const settings = await settingsRes.json().catch(() => ({}));
            const roles = settings.roles || {};
            const adminEnabled = typeof roles.admin?.vehicle_returned === 'boolean' ? roles.admin.vehicle_returned : true;
            if (adminEnabled) {
                // send minimal booking id; server will fetch booking, expenses and build a full summary
                await fetch('/api/notifications/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event: 'vehicle_returned', booking: { id: trip.id } })
                });
            } else {
                console.debug('การแจ้งคืนรถสำหรับ admin ถูกปิดใน settings — ไม่ส่งแจ้งเตือน');
            }
        } catch (e) {
            console.warn('แจ้งแอดมินคืนรถไม่สำเร็จ', e);
        }
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const handleScan = async (type) => {
        setScanType(type);
        setScanning(true);
        
        try {
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            
            // Create video element
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();
            
            // Wait for video to be ready
            await new Promise(resolve => {
                video.onloadedmetadata = resolve;
            });
            
            // Create canvas for capturing
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            // Show camera preview
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
            modal.innerHTML = `
                <div style="color:white;margin-bottom:20px;text-align:center;">
                    <p style="font-size:18px;font-weight:bold;">แสกนเลขไมล์</p>
                    <p style="font-size:14px;margin-top:8px;">วางกล้องให้เห็นเลขไมล์ชัดเจน</p>
                </div>
                <div style="position:relative;">
                    <video id="scanVideo" autoplay playsinline style="max-width:90vw;max-height:60vh;border-radius:8px;"></video>
                </div>
                <div style="margin-top:20px;display:flex;gap:12px;">
                    <button id="captureBtn" style="padding:12px 24px;background:#0d9488;color:white;border:none;border-radius:8px;font-weight:600;">ถ่ายรูป</button>
                    <button id="cancelBtn" style="padding:12px 24px;background:#6b7280;color:white;border:none;border-radius:8px;font-weight:600;">ยกเลิก</button>
                </div>
                <div id="ocrStatus" style="color:white;margin-top:16px;font-size:14px;display:none;">
                    <p>กำลังอ่านเลขไมล์...</p>
                </div>
            `;
            document.body.appendChild(modal);
            
            const modalVideo = document.getElementById('scanVideo');
            modalVideo.srcObject = stream;
            
            // Handle capture button
            document.getElementById('captureBtn').onclick = async () => {
                ctx.drawImage(modalVideo, 0, 0);
                const imageData = canvas.toDataURL('image/jpeg');
                
                // Stop camera
                stream.getTracks().forEach(track => track.stop());
                
                // Show OCR status
                const statusDiv = document.getElementById('ocrStatus');
                statusDiv.style.display = 'block';
                document.getElementById('captureBtn').disabled = true;
                document.getElementById('cancelBtn').disabled = true;
                
                try {
                    // Initialize Tesseract worker
                    const worker = await createWorker('eng', 1, {
                        logger: m => {
                            if (m.status === 'recognizing text') {
                                statusDiv.innerHTML = `<p>กำลังอ่านเลขไมล์... ${Math.round(m.progress * 100)}%</p>`;
                            }
                        }
                    });
                    
                    // Perform OCR
                    const { data: { text } } = await worker.recognize(imageData);
                    await worker.terminate();
                    
                    // Extract numbers from text
                    const numbers = text.match(/\d+/g);
                    let mileageValue = null;
                    
                    if (numbers && numbers.length > 0) {
                        // Find the largest number (likely to be mileage)
                        const sortedNumbers = numbers.map(n => parseInt(n)).sort((a, b) => b - a);
                        mileageValue = sortedNumbers[0];
                        
                        // Validate
                        const minValue = type === 'start' ? (vehicle?.currentMileage || 0) : (trip.startMileage || 0);
                        
                        if (mileageValue < minValue) {
                            alert(`เลขไมล์ที่อ่านได้ (${mileageValue}) น้อยกว่าค่าเดิม (${minValue})\nกรุณาลองใหม่หรือพิมพ์ด้วยตนเอง`);
                            document.body.removeChild(modal);
                            setScanning(false);
                            return;
                        }
                        
                        // Confirm with user
                        const confirmed = confirm(`อ่านเลขไมล์ได้: ${mileageValue}\nต้องการใช้ค่านี้หรือไม่?`);
                        if (confirmed) {
                            if (type === 'start') {
                                setStartMileage(mileageValue.toString());
                            } else {
                                setEndMileage(mileageValue.toString());
                            }
                        }
                    } else {
                        alert('ไม่พบตัวเลขในภาพ กรุณาลองใหม่หรือพิมพ์ด้วยตนเอง');
                    }
                    
                    document.body.removeChild(modal);
                    setScanning(false);
                    
                } catch (err) {
                    console.error('OCR error:', err);
                    alert('ไม่สามารถอ่านเลขได้ กรุณาลองใหม่หรือพิมพ์ด้วยตนเอง');
                    document.body.removeChild(modal);
                    setScanning(false);
                }
            };
            
            // Handle cancel button
            document.getElementById('cancelBtn').onclick = () => {
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(modal);
                setScanning(false);
            };
            
        } catch (err) {
            console.error('Camera error:', err);
            alert('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง');
            setScanning(false);
        }
    };

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
                {/* Vehicle Info Section */}
                <div className="flex p-4 gap-4">
                    {/* Vehicle Image Placeholder / actual image if available */}
                        <div className="w-20 h-20 rounded-lg flex-shrink-0 overflow-hidden bg-gray-200">
                            {getImageUrl(vehicle) ? (
                                <Image src={getImageUrl(vehicle)} alt={`${vehicle?.brand || ''} ${vehicle?.model || ''}`} width={80} height={80} className="object-cover w-full h-full" unoptimized />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">ไม่มีรูป</div>
                            )}
                        </div>
                    
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-gray-600">ยี่ห้อ</p>
                                <p className="font-semibold">{vehicle?.brand || '-'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm text-gray-600">รุ่น</p>
                                    <p className="font-semibold">{vehicle?.model || '-'}</p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                trip.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                                trip.status === 'approved' ? 'bg-blue-100 text-blue-700' : 
                                'bg-green-100 text-green-700'
                            }`}>
                                {trip.status === 'pending' ? 'รอการอนุมัติ' : trip.status === 'approved' ? 'รอดำเนินการ' : 'กำลังเดินทาง'}
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
                {trip.status === 'pending' && (
                    <div className="px-4 pb-4">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                            <p className="text-sm text-orange-700 font-medium">🕐 รอการอนุมัติจากผู้จัดการ</p>
                            <p className="text-xs text-orange-600 mt-1">คุณจะสามารถเริ่มเดินทางได้เมื่อได้รับการอนุมัติแล้ว</p>
                        </div>
                    </div>
                )}

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
                                onClick={() => handleScan('start')} 
                                disabled={scanning}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                                title="แสกนเลขไมล์"
                            >
                                📷
                            </button>
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
                                onClick={() => handleScan('end')} 
                                disabled={scanning}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                                title="แสกนเลขไมล์"
                            >
                                📷
                            </button>
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
    console.log('MyTripsPage - auth user:', user);
    console.log('MyTripsPage - userProfile:', userProfile);
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ongoing'); // 'ongoing' or 'history'
    const router = useRouter();

    useEffect(() => {
        console.log('MyTripsPage useEffect - user change:', user, userProfile);
        if (!user || !userProfile) {
            setLoading(false);
            return;
        };

        // allow drivers and admins to fetch trips; employees should not access driver trip list
        if (userProfile.role !== 'driver' && userProfile.role !== 'admin') {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "bookings"),
            where("driverId", "==", user.uid),
            where("status", "in", ["pending", "approved", "on_trip"])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tripsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort client-side by startDateTime (safely handle missing/ts)
            tripsData.sort((a, b) => {
                const ta = a.startDateTime?.seconds ? a.startDateTime.seconds * 1000 : new Date(a.startDateTime || 0).getTime();
                const tb = b.startDateTime?.seconds ? b.startDateTime.seconds * 1000 : new Date(b.startDateTime || 0).getTime();
                return ta - tb;
            });
            setTrips(tripsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile, setTrips]);

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <p className="text-gray-500">กำลังโหลด...</p>
        </div>
    );
    
    if (userProfile?.role !== 'driver' && userProfile?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-center text-gray-600">หน้านี้สำหรับพนักงานขับรถเท่านั้น</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header with User Profile */}
            <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />
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
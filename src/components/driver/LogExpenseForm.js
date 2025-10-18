"use client";

import { useState } from "react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export default function LogExpenseForm({ trip, onClose }) {
    const { user } = useAuth();
    const [expenseType, setExpenseType] = useState('fuel');
    const [amount, setAmount] = useState('');
    const [details, setDetails] = useState('');
    const [receiptFile, setReceiptFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setReceiptFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount) {
            setMessage("กรุณากรอกจำนวนเงิน");
            return;
        }
        setIsLoading(true);

        let downloadURL = null;
        if (receiptFile) {
            setMessage('กำลังอัปโหลดใบเสร็จ...');
            try {
                // 1. Upload receipt image to Firebase Storage
                const storageRef = ref(storage, `receipts/${trip.id}/${receiptFile.name}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, receiptFile);
                downloadURL = await getDownloadURL(snapshot.ref);
            } catch (error) {
                console.error("Error uploading receipt:", error);
                setMessage('เกิดข้อผิดพลาดในการอัปโหลดใบเสร็จ');
                setIsLoading(false);
                return;
            }
        }
        
        setMessage('กำลังบันทึกข้อมูล...');

        try {
            // 2. Save expense data to Firestore
            const expenseData = {
                bookingId: trip.id,
                vehicleId: trip.vehicleId,
                driverId: user.uid,
                type: expenseType,
                amount: Number(amount),
                details: details,
                expenseDate: serverTimestamp(),
            };
            if (downloadURL) {
                expenseData.receiptImageUrl = downloadURL;
            }
            const docRef = await addDoc(collection(db, "expenses"), expenseData);
            console.log('Expense written with ID:', docRef.id);

            // Try to also create a related record for maintenance or fuel logs so history pages show it
            try {
                // fetch vehicle to get current mileage
                let vehicleMileage = null;
                if (trip?.vehicleId) {
                    const vehicleRef = doc(db, 'vehicles', trip.vehicleId);
                    const vSnap = await getDoc(vehicleRef);
                    if (vSnap.exists()) {
                        vehicleMileage = vSnap.data().currentMileage ?? null;
                    }
                }

                if (expenseType === 'maintenance') {
                    await addDoc(collection(db, 'maintenances'), {
                        vehicleId: trip.vehicleId,
                        date: serverTimestamp(),
                        mileage: vehicleMileage ?? null,
                        details: details || (`ค่าใช้จ่าย: ${amount}`),
                        cost: Number(amount),
                        createdAt: serverTimestamp(),
                    });
                    console.log('Maintenance record created for vehicle', trip.vehicleId);
                } else if (expenseType === 'fuel') {
                    await addDoc(collection(db, 'fuel_logs'), {
                        vehicleId: trip.vehicleId,
                        date: serverTimestamp(),
                        mileage: vehicleMileage ?? null,
                        liters: null,
                        cost: Number(amount),
                        previousMileage: vehicleMileage ?? null,
                    });
                    console.log('Fuel log created for vehicle', trip.vehicleId);
                }
            } catch (innerErr) {
                console.error('Error creating related record:', innerErr);
            }

            setIsLoading(false);
            setMessage('บันทึกค่าใช้จ่ายสำเร็จ!');
            setTimeout(onClose, 1500);

        } catch (error) {
            console.error("Error logging expense:", error);
            setMessage('เกิดข้อผิดพลาดในการบันทึก');
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-2xl">
                <h2 className="mb-6 text-2xl font-bold">บันทึกค่าใช้จ่ายระหว่างทาง</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block mb-1 text-sm">ประเภทค่าใช้จ่าย</label>
                        <select value={expenseType} onChange={(e) => setExpenseType(e.target.value)} className="w-full p-2 border rounded">
                            <option value="fuel">น้ำมัน</option>
                            <option value="maintenance">ซ่อมบำรุง</option>
                            <option value="toll">ทางด่วน</option>
                            <option value="parking">ค่าจอดรถ</option>
                            <option value="other">อื่นๆ</option>
                        </select>
                    </div>
                    <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="จำนวนเงิน (บาท)" required className="w-full p-2 border rounded" />
                    <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="รายละเอียด (ถ้ามี)" className="w-full p-2 border rounded"></textarea>
                    <div>
                        <label className="block mb-1 text-sm">ใบเสร็จ (รูปภาพ) - ไม่บังคับ</label>
                        <input type="file" onChange={handleFileChange} accept="image/*" className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    </div>

                    {message && <p className="text-center text-sm">{message}</p>}

                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">ยกเลิก</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 text-white bg-teal-600 rounded hover:bg-teal-700 disabled:bg-gray-400">
                            {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
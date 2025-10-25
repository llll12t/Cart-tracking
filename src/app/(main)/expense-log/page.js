"use client";
import React from "react";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function ExpenseLogPage() {
  // Modal สำหรับแสดงกล้อง
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  // ฟังก์ชันเปิดกล้อง
  const openCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('ไม่สามารถเปิดกล้องได้');
      setShowCamera(false);
    }
  };
  // ฟังก์ชันถ่ายภาพและ OCR
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    const imageData = canvasRef.current.toDataURL('image/jpeg', 0.95);
    setShowCamera(false);
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    try {
      // OCR ด้วย Tesseract.js
      console.log('เริ่มทำ OCR...');
      const { createWorker } = await import('tesseract.js');
      
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      console.log('กำลังอ่านภาพ...');
      const { data: { text } } = await worker.recognize(imageData);
      await worker.terminate();
      
      console.log('OCR Result:', text);
      
      // Extract all numbers from text
      const numbers = text.match(/\d+/g);
      console.log('Numbers found:', numbers);
      
      if (numbers && numbers.length > 0) {
        // Find the largest number (most likely to be mileage)
        const sortedNumbers = numbers.map(n => parseInt(n)).sort((a, b) => b - a);
        const mileageValue = sortedNumbers[0];
        
        console.log('Detected mileage:', mileageValue);
        
        // Validate
        const minValue = lastFuelMileage || activeUsage?.startMileage || 0;
        if (mileageValue < minValue) {
          alert(`⚠️ เลขไมล์ที่อ่านได้ (${mileageValue.toLocaleString()}) น้อยกว่าค่าปัจจุบัน (${minValue.toLocaleString()})\n\nกรุณาลองใหม่หรือกรอกด้วยตนเอง`);
          return;
        }
        
        // Confirm with user
        const confirmed = confirm(`✅ อ่านเลขไมล์ได้: ${mileageValue.toLocaleString()} กม.\n\nต้องการใช้ค่านี้หรือไม่?`);
        if (confirmed) {
          setMileage(mileageValue.toString());
        }
      } else {
        alert('❌ ไม่พบตัวเลขในภาพ\n\nกรุณาลองใหม่หรือกรอกด้วยตนเอง');
      }
    } catch (error) {
      console.error('OCR Error:', error);
      alert('❌ ไม่สามารถอ่านเลขไมล์ได้\n\nกรุณาลองใหม่หรือกรอกด้วยตนเอง\n\nError: ' + error.message);
    }
  };
  // State สำหรับรายการเติมน้ำมันล่าสุด
  const [latestFuelExpense, setLatestFuelExpense] = useState(null);
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [activeUsage, setActiveUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("fuel");
  const [amount, setAmount] = useState("");
  const [mileage, setMileage] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastFuelMileage, setLastFuelMileage] = useState(null);
  const [otherTitle, setOtherTitle] = useState(""); // State สำหรับชื่อรายการค่าใช้จ่ายอื่นๆ
  const [fluidLatest, setFluidLatest] = useState(null); // State สำหรับรายการเปลี่ยนของเหลวล่าสุด

  // Fetch active vehicle usage
  useEffect(() => {
    if (!user && !userProfile) return;

    const fetchActiveUsage = async () => {
      try {
        const userId = userProfile?.lineId || user?.uid;
        const response = await fetch(`/api/vehicle-usage/active?userId=${userId}`);
        const result = await response.json();

        if (result.success && result.usage) {
          setActiveUsage(result.usage);

          // Fetch expenses ด้วย vehicleId เพื่อให้ได้ประวัติการเติมน้ำมันของรถคันนี้ทั้งหมด
          const expensesResponse = await fetch(`/api/expenses?vehicleId=${result.usage.vehicleId}`);
          const expensesResult = await expensesResponse.json();

          if (expensesResult.success && expensesResult.expenses) {
            // หาเลขไมล์จากการเติมน้ำมันครั้งล่าสุด
            const fuelExpenses = expensesResult.expenses
              .filter(exp => exp.type === 'fuel' && exp.mileage)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (fuelExpenses.length > 0) {
              const lastMileage = fuelExpenses[0].mileage;
              setLastFuelMileage(lastMileage);
              setLatestFuelExpense(fuelExpenses[0]);
            } else if (result.usage.startMileage) {
              // ถ้ายังไม่เคยเติมเลย ใช้เลขไมล์เริ่มต้น
              setLastFuelMileage(result.usage.startMileage);
              setLatestFuelExpense(null);
            }
            // หาเปลี่ยนของเหลวล่าสุด
            const fluidExpenses = expensesResult.expenses
              .filter(exp => exp.type === 'fluid' && exp.mileage)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            if (fluidExpenses.length > 0) {
              setFluidLatest(fluidExpenses[0]);
            } else {
              setFluidLatest(null);
            }
          } else if (result.usage.startMileage) {
            setLastFuelMileage(result.usage.startMileage);
            setMileage(result.usage.startMileage.toString());
            setLatestFuelExpense(null);
          }
        } else {
          // No active usage - redirect back
          setMessage("ไม่พบรถที่กำลังใช้งาน");
          setTimeout(() => router.push('/my-vehicle'), 2000);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching active usage:", error);
        setLoading(false);
      }
    };

    fetchActiveUsage();
  }, [user, userProfile, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      setMessage("กรุณาระบุจำนวนเงินที่ถูกต้อง");
      return;
    }

    if (type === "other" && !otherTitle.trim()) {
      setMessage("กรุณาระบุชื่อรายการค่าใช้จ่าย");
      return;
    }

    // ถ้าเป็นน้ำมันหรือเปลี่ยนถ่ายของเหลว บังคับให้กรอกเลขไมล์
    if ((type === "fuel" || type === "fluid") && (!mileage || Number(mileage) <= 0)) {
      setMessage("กรุณาระบุเลขไมล์ปัจจุบัน");
      return;
    }

    if (!activeUsage) {
      setMessage("ไม่พบข้อมูลการใช้งานรถ");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const userId = userProfile?.lineId || user?.uid;
      const userName = userProfile?.displayName || userProfile?.name || user?.displayName || user?.name || "-";
      // กำหนด type ที่จะส่งไป backend
      let submitType = type;
      if (type === "fluid") submitType = "fluid";
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usageId: activeUsage.id,
          vehicleId: activeUsage.vehicleId,
          userId: userId,
          userName: userName,
          type: submitType,
          amount: Number(amount),
          mileage: mileage ? Number(mileage) : null,
          note: note || '',
          title: type === "other" ? otherTitle : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || 'เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย');
        setIsSubmitting(false);
        return;
      }

      setMessage("บันทึกค่าใช้จ่ายสำเร็จ!");
      // Reset form
      setAmount("");
      setNote("");
      setIsSubmitting(false);

      // Navigate back to my-vehicle page
      setTimeout(() => {
        router.push('/my-vehicle');
      }, 1500);

    } catch (error) {
      console.error("Error submitting expense:", error);
      setMessage("เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-6 pb-24">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/20 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">บันทึกค่าใช้จ่าย</h1>
        </div>
        <p className="text-teal-100 text-sm">บันทึกค่าเติมน้ำมันและค่าใช้จ่ายอื่นๆ</p>
      </div>

      {/* Content */}
      <div className="px-4 -mt-16">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Vehicle Info */}
            {activeUsage && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-teal-700">กำลังใช้งาน</span>
                </div>
                <p className="font-semibold text-teal-900">{activeUsage.vehicleLicensePlate}</p>
                {lastFuelMileage && (
                  <p className="text-sm text-teal-700">
                    เลขไมล์จากการเติมล่าสุด: {lastFuelMileage.toLocaleString()} กม.
                  </p>
                )}
                {/* แสดงรายการเปลี่ยนของเหลวล่าสุด */}
                {fluidLatest && (
                  <div className="mt-2 text-sm text-blue-700">
                    <span className="font-semibold">การเปลี่ยนของเหลวล่าสุด:</span> {fluidLatest.mileage ? fluidLatest.mileage.toLocaleString() + ' กม.' : '-'}
                    {fluidLatest.note && <span className="ml-2 text-gray-500">({fluidLatest.note})</span>}
                  </div>
                )}
              </div>
            )}

            {/* ประเภทค่าใช้จ่าย */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ประเภทค่าใช้จ่าย <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setType("fuel")}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${type === "fuel"
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-300 hover:border-teal-300"
                    }`}
                >
                  <div className="text-3xl mb-2">⛽</div>
                  <div className="text-sm font-medium">เติมน้ำมัน</div>
                </button>
                <button
                  type="button"
                  onClick={() => setType("fluid")}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${type === "fluid"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 hover:border-blue-300"
                    }`}
                >
                  <div className="text-3xl mb-2">🛢️</div>
                  <div className="text-sm font-medium">ของเหลว</div>
                </button>
                <button
                  type="button"
                  onClick={() => setType("other")}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${type === "other"
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-300 hover:border-teal-300"
                    }`}
                >
                  <div className="text-3xl mb-2">💰</div>
                  <div className="text-sm font-medium">อื่นๆ</div>
                </button>
              </div>
            </div>

            {/* จำนวนเงิน */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                จำนวนเงิน (บาท) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="ระบุจำนวนเงิน"
                step="0.01"
                min="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            {/* ชื่อรายการ (เฉพาะค่าใช้จ่ายอื่นๆ) */}
            {type === "other" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อรายการ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={otherTitle}
                  onChange={e => setOtherTitle(e.target.value)}
                  placeholder="ระบุชื่อรายการ เช่น ค่าทางด่วน, ค่าซ่อมแซม"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            )}

            {/* เลขไมล์ (บังคับถ้าเลือกน้ำมัน) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลขไมล์ปัจจุบัน {type === "fuel" && <span className="text-red-500">*</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="ระบุเลขไมล์ปัจจุบัน"
                  className="w-full max-w-xs px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required={type === "fuel" || type === "fluid"}
                />
                <button
                  type="button"
                  onClick={openCamera}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-blue-700 transition-all whitespace-nowrap"
                  title="แสกนเลขไมล์จากรถ"
                >
                   แสกน
                </button>
                {/* Modal กล้องถ่ายเลขไมล์ */}
                {showCamera && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-4 flex flex-col items-center">
                      <video ref={videoRef} width={320} height={240} autoPlay playsInline className="rounded border mb-2" />
                      <canvas ref={canvasRef} width={320} height={240} style={{ display: 'none' }} />
                      <button
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold mt-2"
                        onClick={handleCapture}
                      >ถ่ายภาพเลขไมล์</button>
                      <button
                        className="px-4 py-2 bg-gray-400 text-white rounded-lg font-bold mt-2"
                        onClick={() => {
                          setShowCamera(false);
                          if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
                          setCameraStream(null);
                        }}
                      >ปิด</button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {(type === "fuel") && "บังคับกรอกเมื่อเติมน้ำมัน - กดแสกนเพื่อใช้เลขไมล์จากภาพ"}
                {(type === "fluid") && "บังคับกรอกเลขไมล์เมื่อเปลี่ยนถ่ายของเหลว"}
                {(type === "other") && "ไม่บังคับ - บันทึกเพื่อติดตามค่าใช้จ่ายอื่นๆ"}
              </p>
            </div>

            {/* หมายเหตุ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                หมายเหตุ (ถ้ามี)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม เช่น สถานีน้ำมัน, ประเภทน้ำมัน"
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm text-center ${message.includes('สำเร็จ')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
                }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !amount || ((type === "fuel" || type === "fluid") && !mileage)}
              className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่าย'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

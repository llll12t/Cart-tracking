"use client";
import React from "react";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function ExpenseLogPage() {
  // State สำหรับการแสกน
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const scanIntervalRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  
  // State สำหรับ custom modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ message: '', value: null, onConfirm: null });
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' });
  
  // ฟังก์ชัน custom alert
  const customAlert = (title, message, type = 'info') => {
    setAlertData({ title, message, type });
    setShowAlertModal(true);
  };
  
  // ฟังก์ชัน custom confirm
  const customConfirm = (message, value, onConfirm) => {
    setConfirmData({ message, value, onConfirm });
    setShowConfirmModal(true);
  };
  
  // ฟังก์ชันเปิดกล้องและเริ่มแสกนอัตโนมัติ
  const startAutoScan = async () => {
    setIsScanning(true);
    setScanStatus('กำลังเปิดกล้อง...');
    
    try {
      // เปิดกล้อง
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      // สร้าง video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('autoplay', '');
      video.setAttribute('playsinline', '');
      video.play();
      
      // รอให้ video พร้อม
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });
      
      setScanStatus('📸 กำลังมองหาเลขไมล์...');
      
      // สร้าง canvas สำหรับจับภาพ
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // สร้าง modal แสดงกล้อง
      const modal = document.createElement('div');
      modal.id = 'scanModal';
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
      modal.innerHTML = `
        <div style="color:white;margin-bottom:20px;text-align:center;">
          <p style="font-size:20px;font-weight:bold;margin-bottom:8px;">📸 แสกนเลขไมล์อัตโนมัติ</p>
          <p id="scanStatusText" style="font-size:14px;color:#93c5fd;">กำลังมองหาเลขไมล์...</p>
        </div>
        <div style="position:relative;width:100%;max-width:500px;">
          <video id="scanVideo" autoplay playsinline style="width:100%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);"></video>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border:2px dashed #0d9488;width:80%;height:40%;border-radius:8px;pointer-events:none;"></div>
        </div>
        <div style="margin-top:24px;display:flex;gap:12px;">
          <button id="cancelScanBtn" style="padding:14px 28px;background:#6b7280;color:white;border:none;border-radius:10px;font-weight:600;font-size:16px;cursor:pointer;">✕ ยกเลิก</button>
        </div>
        <div style="color:#93c5fd;margin-top:16px;font-size:12px;text-align:center;">
          <p>💡 วางกล้องให้เห็นเลขไมล์ชัดเจนในกรอบ</p>
        </div>
      `;
      document.body.appendChild(modal);
      
      const modalVideo = document.getElementById('scanVideo');
      const statusText = document.getElementById('scanStatusText');
      modalVideo.srcObject = stream;
      
      // โหลด Tesseract worker
      setScanStatus('⏳ กำลังเตรียมเครื่องมืออ่านข้อความ...');
      statusText.textContent = 'กำลังเตรียมเครื่องมืออ่านข้อความ...';
      
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            statusText.textContent = `กำลังวิเคราะห์ภาพ... ${progress}%`;
          }
        }
      });
      
      let scanCount = 0;
      let isProcessing = false;
      
      // ฟังก์ชันแสกนทุก 2 วินาที
      const scanFrame = async () => {
        if (isProcessing) return;
        
        isProcessing = true;
        scanCount++;
        
        try {
          // จับภาพจาก video
          ctx.drawImage(modalVideo, 0, 0);
          const imageData = canvas.toDataURL('image/jpeg', 0.95);
          
          statusText.textContent = `🔍 กำลังอ่านเลขไมล์... (ครั้งที่ ${scanCount})`;
          
          // ทำ OCR
          const { data: { text } } = await worker.recognize(imageData);
          
          console.log(`Scan ${scanCount}:`, text);
          
          // หาตัวเลขในภาพ
          const numbers = text.match(/\d+/g);
          
          if (numbers && numbers.length > 0) {
            // กรองเฉพาะเลข 5 หลักขึ้นไป
            const validNumbers = numbers
              .map(n => parseInt(n))
              .filter(n => n >= 10000 && n <= 9999999);
            
            if (validNumbers.length > 0) {
              // หาเลขที่ใหญ่ที่สุด
              const mileageValue = Math.max(...validNumbers);
              const minValue = lastFuelMileage || activeUsage?.startMileage || 0;
              
              if (mileageValue >= minValue) {
                // เจอเลขไมล์แล้ว!
                console.log('✅ Found valid mileage:', mileageValue);
                
                // หยุดแสกน
                clearInterval(scanIntervalRef.current);
                await worker.terminate();
                
                // ปิดกล้อง
                stream.getTracks().forEach(track => track.stop());
                
                // แสดง confirmation
                statusText.textContent = '✅ เจอเลขไมล์แล้ว!';
                statusText.style.color = '#10b981';
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                document.body.removeChild(modal);
                setIsScanning(false);
                setScanStatus('');
                
                // ยืนยันกับผู้ใช้ด้วย custom modal
                customConfirm(
                  `อ่านเลขไมล์ได้: ${mileageValue.toLocaleString()} กม.`,
                  mileageValue,
                  (value) => {
                    setMileage(value.toString());
                  }
                );
                
                return;
              }
            }
          }
          
          statusText.textContent = `🔍 กำลังมองหาเลขไมล์... (ครั้งที่ ${scanCount})`;
          
        } catch (error) {
          console.error('Scan error:', error);
        }
        
        isProcessing = false;
      };
      
      // เริ่มแสกนทุก 2 วินาที
      scanIntervalRef.current = setInterval(scanFrame, 2000);
      
      // แสกนครั้งแรกทันที
      setTimeout(scanFrame, 500);
      
      // ปุ่มยกเลิก
      document.getElementById('cancelScanBtn').onclick = () => {
        clearInterval(scanIntervalRef.current);
        worker.terminate();
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
        setIsScanning(false);
        setScanStatus('');
      };
      
    } catch (err) {
      console.error('Camera error:', err);
      customAlert('ไม่สามารถเข้าถึงกล้อง', 'กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์', 'error');
      setIsScanning(false);
      setScanStatus('');
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
    if (!user && !userProfile) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let hasFetched = false;

    const fetchActiveUsage = async () => {
      if (hasFetched) return;
      hasFetched = true;
      try {
        const userId = userProfile?.lineId || user?.uid;
        const response = await fetch(`/api/vehicle-usage/active?userId=${userId}`);
        const result = await response.json();

        if (!isMounted) return;

        if (result.success && result.usage) {
          setActiveUsage(result.usage);

          // ดึงข้อมูล vehicle และ expenses พร้อมกัน (parallel)
          const [vehicleResponse, expensesResponse] = await Promise.all([
            fetch(`/api/vehicles/${result.usage.vehicleId}`),
            fetch(`/api/expenses?vehicleId=${result.usage.vehicleId}`)
          ]);

          let vehicleCurrentMileage = null;
          if (vehicleResponse.ok) {
            const vehicleData = await vehicleResponse.json();
            if (vehicleData.currentMileage) {
              vehicleCurrentMileage = vehicleData.currentMileage;
            }
          }

          const expensesResult = await expensesResponse.json();

          if (!isMounted) return;

          if (expensesResult.success && expensesResult.expenses) {
            // ประมวลผล expenses ครั้งเดียว (optimize)
            const expensesByType = {
              all: [],
              fuel: [],
              fluid: []
            };

            // แยก expenses ตามประเภทในรอบเดียว
            expensesResult.expenses.forEach(exp => {
              if (exp.mileage) {
                expensesByType.all.push(exp);
                if (exp.type === 'fuel') expensesByType.fuel.push(exp);
                if (exp.type === 'fluid') expensesByType.fluid.push(exp);
              }
            });

            // เรียง all expenses ตามเวลา
            expensesByType.all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // ตั้งค่า state ตามลำดับความสำคัญ: expenses > vehicle.currentMileage > usage.startMileage
            if (expensesByType.all.length > 0) {
              const latestMileage = expensesByType.all[0].mileage;
              setLastFuelMileage(latestMileage);
            } else if (vehicleCurrentMileage) {
              setLastFuelMileage(vehicleCurrentMileage);
            } else if (result.usage.startMileage) {
              setLastFuelMileage(result.usage.startMileage);
            }

            // ตั้งค่า fuel และ fluid expenses
            if (expensesByType.fuel.length > 0) {
              expensesByType.fuel.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              setLatestFuelExpense(expensesByType.fuel[0]);
            } else {
              setLatestFuelExpense(null);
            }

            if (expensesByType.fluid.length > 0) {
              expensesByType.fluid.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              setFluidLatest(expensesByType.fluid[0]);
            } else {
              setFluidLatest(null);
            }
          } else if (vehicleCurrentMileage) {
            // ถ้าไม่มี expenses เลย หรือ fetch ไม่สำเร็จ ใช้ currentMileage จาก vehicle
            setLastFuelMileage(vehicleCurrentMileage);
            setLatestFuelExpense(null);
            setFluidLatest(null);
          } else if (result.usage.startMileage) {
            // ถ้าไม่มี currentMileage ใช้ startMileage
            setLastFuelMileage(result.usage.startMileage);
            setLatestFuelExpense(null);
            setFluidLatest(null);
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

    return () => {
      isMounted = false;
    };
  }, [user, userProfile]);

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

    if ((type === "fuel" || type === "fluid")) {
      if (!mileage || Number(mileage) <= 0) {
        setMessage("กรุณาระบุเลขไมล์ปัจจุบัน");
        return;
      }
      // ตรวจสอบว่าเลขไมล์ใหม่ต้องไม่ต่ำกว่าเลขไมล์ล่าสุด
      const minMileage = lastFuelMileage || activeUsage?.startMileage || 0;
      if (Number(mileage) < minMileage) {
        setMessage(`เลขไมล์ต้องไม่ต่ำกว่า ${minMileage.toLocaleString()} กม.`);
        return;
      }
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
      <div className="gradient-bg text-white p-6 pb-24">
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
      <div className="px-6 -mt-16">
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
                    เลขไมล์ล่าสุด: {lastFuelMileage.toLocaleString()} กม.
                  </p>
                )}
                {/* แสดงรายการเปลี่ยนของเหลวล่าสุด */}
                {fluidLatest && (
                  <div className="text-sm text-blue-700">
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
                  onClick={startAutoScan}
                  disabled={isScanning}
                  className="px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  title="แสกนเลขไมล์อัตโนมัติ"
                >
                  {isScanning ? '⏳ กำลังแสกน...' : '📷 แสกน'}
                </button>
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
      
      {/* Custom Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-scale-in">
            <div className={`p-6 rounded-t-2xl ${
              alertData.type === 'error' ? 'bg-red-50' : 
              alertData.type === 'success' ? 'bg-green-50' : 
              'bg-blue-50'
            }`}>
              <div className="flex items-center justify-center mb-3">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  alertData.type === 'error' ? 'bg-red-100' : 
                  alertData.type === 'success' ? 'bg-green-100' : 
                  'bg-blue-100'
                }`}>
                  <span className="text-4xl">
                    {alertData.type === 'error' ? '❌' : 
                     alertData.type === 'success' ? '✅' : 
                     'ℹ️'}
                  </span>
                </div>
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${
                alertData.type === 'error' ? 'text-red-700' : 
                alertData.type === 'success' ? 'text-green-700' : 
                'text-blue-700'
              }`}>
                {alertData.title}
              </h3>
              <p className="text-center text-gray-600">{alertData.message}</p>
            </div>
            <div className="p-4">
              <button
                onClick={() => setShowAlertModal(false)}
                className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                  alertData.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 
                  alertData.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-scale-in">
            <div className="p-6 bg-teal-50 rounded-t-2xl">
              <div className="flex items-center justify-center mb-3">
                <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                  <span className="text-4xl">✅</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-center mb-2 text-teal-700">
                เจอเลขไมล์แล้ว!
              </h3>
              <p className="text-center text-gray-700 text-lg font-semibold">
                {confirmData.message}
              </p>
              <p className="text-center text-gray-500 text-sm mt-2">
                ต้องการใช้ค่านี้หรือไม่?
              </p>
            </div>
            <div className="p-4 flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  if (confirmData.onConfirm) {
                    confirmData.onConfirm(confirmData.value);
                  }
                  setShowConfirmModal(false);
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-all"
              >
                ใช้ค่านี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

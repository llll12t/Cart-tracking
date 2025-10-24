"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function ExpenseLogPage() {
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
          
          // Fetch expenses to get last fuel mileage
          const expensesResponse = await fetch(`/api/expenses?usageId=${result.usage.id}`);
          const expensesResult = await expensesResponse.json();
          
          if (expensesResult.success && expensesResult.expenses) {
            // หาเลขไมล์จากการเติมน้ำมันครั้งล่าสุด
            const fuelExpenses = expensesResult.expenses
              .filter(exp => exp.type === 'fuel' && exp.mileage)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            if (fuelExpenses.length > 0) {
              const lastMileage = fuelExpenses[0].mileage;
              setLastFuelMileage(lastMileage);
              setMileage(lastMileage.toString());
            } else if (result.usage.startMileage) {
              // ถ้ายังไม่เคยเติมเลย ใช้เลขไมล์เริ่มต้น
              setLastFuelMileage(result.usage.startMileage);
              setMileage(result.usage.startMileage.toString());
            }
          } else if (result.usage.startMileage) {
            setLastFuelMileage(result.usage.startMileage);
            setMileage(result.usage.startMileage.toString());
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

    // ถ้าเป็นน้ำมัน บังคับให้กรอกเลขไมล์
    if (type === "fuel" && (!mileage || Number(mileage) <= 0)) {
      setMessage("กรุณาระบุเลขไมล์ปัจจุบันเมื่อเติมน้ำมัน");
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
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usageId: activeUsage.id,
          vehicleId: activeUsage.vehicleId,
          userId: userId,
          type,
          amount: Number(amount),
          mileage: mileage ? Number(mileage) : null,
          note: note || '',
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
              </div>
            )}

            {/* ประเภทค่าใช้จ่าย */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ประเภทค่าใช้จ่าย <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("fuel")}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    type === "fuel"
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-300 hover:border-teal-300"
                  }`}
                >
                  <div className="text-3xl mb-2">⛽</div>
                  <div className="font-medium">เติมน้ำมัน</div>
                </button>
                <button
                  type="button"
                  onClick={() => setType("other")}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    type === "other"
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-300 hover:border-teal-300"
                  }`}
                >
                  <div className="text-3xl mb-2">💰</div>
                  <div className="font-medium">ค่าใช้จ่ายอื่นๆ</div>
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required={type === "fuel"}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (lastFuelMileage) {
                      setMileage(lastFuelMileage.toString());
                    } else if (activeUsage?.startMileage) {
                      setMileage(activeUsage.startMileage.toString());
                    }
                  }}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all whitespace-nowrap"
                  title="แสกนเลขไมล์จากรถ"
                >
                  📸 แสกน
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {type === "fuel" 
                  ? "บังคับกรอกเมื่อเติมน้ำมัน - กดแสกนเพื่อใช้เลขไมล์จากการเติมล่าสุด"
                  : "ไม่บังคับ - บันทึกเพื่อติดตามการใช้น้ำมัน"
                }
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
              <div className={`p-3 rounded-lg text-sm text-center ${
                message.includes('สำเร็จ') 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !amount || (type === "fuel" && !mileage)}
              className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่าย'}
            </button>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">คำแนะนำ:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>บันทึกค่าใช้จ่ายทันทีหลังจากจ่ายเงิน</li>
                <li>เลขไมล์ไม่บังคับ แต่แนะนำให้บันทึก</li>
                <li>สามารถบันทึกได้หลายครั้งระหว่างการใช้งาน</li>
                <li>ข้อมูลจะแสดงในหน้ารถที่กำลังใช้งาน</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

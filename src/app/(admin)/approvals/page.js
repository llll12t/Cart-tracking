"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, getDoc, doc, getDocs } from "firebase/firestore";
import ApprovalCard from "@/components/admin/ApprovalCard";

export default function ApprovalsPage() {
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query bookings with status 'pending'
    const q = query(
      collection(db, "bookings"),
      where("status", "==", "pending"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const bookings = [];
      querySnapshot.forEach((docSnap) => {
        bookings.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Fetch admin users for role check
      const adminQuery = query(collection(db, "users"), where("role", "==", "admin"));
      const adminSnaps = await getDocs(adminQuery);
      const adminIds = adminSnaps.docs.map(d => d.id);
      const adminEmails = adminSnaps.docs.map(d => d.data().email).filter(Boolean);

      // Validate each booking and attach issues array
      const enhanced = await Promise.all(bookings.map(async b => {
        const issues = [];

        // Required fields: accept userId/userEmail as valid requester info too
        if (!b.requesterName && !b.requesterId && !b.userId && !b.userEmail) issues.push('ไม่มีข้อมูลผู้ขอ');
        if (!b.vehicleId) issues.push('ไม่ได้เลือกรถ');
        if (!b.startDate && !b.startCalendarDate && !b.startDateTime) issues.push('ไม่มีวันที่เริ่มต้น (วันที่จะใช้รถ)');

        // Date sanity
        try {
          const s = b.startDate?.seconds ? new Date(b.startDate.seconds*1000) : b.startDate ? new Date(b.startDate) : null;
          const e = b.endDate?.seconds ? new Date(b.endDate.seconds*1000) : b.endDate ? new Date(b.endDate) : null;
          if (s && e && s > e) issues.push('วันที่เริ่มต้น มากกว่าวันที่สิ้นสุด');
        } catch (e) {
          issues.push('วันที่ไม่ถูกต้อง');
        }

        // Vehicle existence and status
        if (b.vehicleId) {
          try {
            const vRef = doc(db, 'vehicles', b.vehicleId);
            const vSnap = await getDoc(vRef);
            if (!vSnap.exists()) {
              issues.push('ข้อมูลรถไม่พบในระบบ');
            } else {
              const v = vSnap.data();
              if (v.status === 'maintenance') issues.push('รถอยู่ระหว่างซ่อม (maintenance)');
            }
          } catch (e) {
            issues.push('ไม่สามารถตรวจสอบสถานะรถ');
          }
        }

        // Overlapping approved bookings: only check when this booking includes both start and end dates
        if (b.vehicleId && (b.startDate || b.startCalendarDate || b.startDateTime) && (b.endDate || b.endCalendarDate || b.endDateTime)) {
          try {
            const colRef = collection(db, 'bookings');
            const q2 = query(colRef, where('vehicleId','==',b.vehicleId), where('status','in',['approved','in_use','on_trip']));
            const snap2 = await getDocs(q2);
            const s = b.startDate?.seconds ? b.startDate.seconds*1000 : b.startCalendarDate ? new Date(b.startCalendarDate).getTime() : b.startDateTime ? (b.startDateTime.seconds ? b.startDateTime.seconds*1000 : new Date(b.startDateTime).getTime()) : new Date(b.startDate).getTime();
            const e = b.endDate?.seconds ? b.endDate.seconds*1000 : b.endCalendarDate ? new Date(b.endCalendarDate).getTime() : b.endDateTime ? (b.endDateTime.seconds ? b.endDateTime.seconds*1000 : new Date(b.endDateTime).getTime()) : new Date(b.endDate).getTime();
            snap2.forEach(d2 => {
              const other = d2.data();
              const os = other.startDate?.seconds ? other.startDate.seconds*1000 : other.startDate ? new Date(other.startDate).getTime() : null;
              const oe = other.endDate?.seconds ? other.endDate.seconds*1000 : other.endDate ? new Date(other.endDate).getTime() : null;
              if (os && oe && !(e < os || s > oe)) {
                issues.push(`ชนกับการจองที่อนุมัติแล้ว (id: ${d2.id})`);
              }
            });
          } catch (e) {
            // ignore query errors but don't block
          }
        }

        // Mark as admin booking if requester is admin
        b.isAdminBooking = false;
        if (
          (b.userId && adminIds.includes(b.userId)) ||
          (b.userEmail && adminEmails.includes(b.userEmail)) ||
          (b.requesterId && adminIds.includes(b.requesterId)) ||
          (b.requesterEmail && adminEmails.includes(b.requesterEmail))
        ) {
          b.isAdminBooking = true;
        }

        return { ...b, issues };
      }));

      setPendingBookings(enhanced);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        รายการคำขอที่รอดำเนินการ
      </h1>

      {loading && <p>กำลังโหลดคำขอ...</p>}

      {!loading && pendingBookings.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">ไม่มีคำขอที่รอดำเนินการในขณะนี้</p>
        </div>
      )}

      {!loading && pendingBookings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {pendingBookings.map((booking) => (
            <ApprovalCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}
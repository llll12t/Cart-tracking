"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import ApprovalCard from "@/components/admin/ApprovalCard";

export default function ApprovalsPage() {
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query เพื่อดึงเฉพาะ booking ที่มี status เป็น 'pending'
    const q = query(
      collection(db, "bookings"),
      where("status", "==", "pending"),
      orderBy("createdAt", "asc") // เรียงตามรายการที่เก่าที่สุดก่อน
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const bookings = [];
      querySnapshot.forEach((doc) => {
        bookings.push({ id: doc.id, ...doc.data() });
      });
      setPendingBookings(bookings);
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
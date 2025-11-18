"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DataContext = createContext();

export const DataProvider = ({ children, userId }) => {
  const [bookings, setBookings] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // Setup real-time listener
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Real-time listener สำหรับ bookings
      const bookingsRef = collection(db, 'bookings');
      const bookingsQuery = query(
        bookingsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        bookingsQuery,
        (snapshot) => {
          const bookingsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          setBookings(bookingsData);

          // แยก trips (approved + in-progress + completed)
          const tripsData = bookingsData.filter(b => 
            b.status === 'approved' || 
            b.status === 'in-progress' || 
            b.status === 'completed'
          );
          setTrips(tripsData);

          setLastFetch(new Date());
          setLoading(false);
          
          console.log(`🔄 Real-time update: ${bookingsData.length} bookings, ${tripsData.length} trips`);
        },
        (err) => {
          console.error('Error in real-time listener:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      // Cleanup listener เมื่อ component unmount หรือ userId เปลี่ยน
      return () => {
        console.log('🔌 Unsubscribing from real-time updates');
        unsubscribe();
      };
    } catch (err) {
      console.error('Error setting up real-time listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [userId]);

  // ฟังก์ชัน refresh (ไม่จำเป็นสำหรับ real-time แต่เก็บไว้ให้ backward compatible)
  // Real-time จะอัปเดตอัตโนมัติ ดังนั้นฟังก์ชันนี้แค่ update lastFetch timestamp
  const refreshData = useCallback(() => {
    console.log('🔄 Manual refresh requested (real-time is already active)');
    setLastFetch(new Date());
    return Promise.resolve();
  }, []);

  // เพิ่ม booking ใหม่โดยไม่ต้อง refetch ทั้งหมด
  const addBooking = useCallback((newBooking) => {
    setBookings(prev => [newBooking, ...prev]);
    if (newBooking.status === 'approved') {
      setTrips(prev => [newBooking, ...prev]);
    }
  }, []);

  // อัปเดต booking (เช่น เปลี่ยน status)
  const updateBooking = useCallback((bookingId, updates) => {
    setBookings(prev => prev.map(b => 
      b.id === bookingId ? { ...b, ...updates } : b
    ));
    setTrips(prev => prev.map(t => 
      t.id === bookingId ? { ...t, ...updates } : t
    ));
  }, []);

  // คำนวณข้อมูลสถิติ (memoized)
  const stats = useMemo(() => {
    const pending = bookings.filter(b => b.status === 'pending').length;
    const approved = bookings.filter(b => b.status === 'approved').length;
    const inProgress = trips.filter(t => t.status === 'in-progress').length;
    const completed = trips.filter(t => t.status === 'completed').length;

    return {
      totalBookings: bookings.length,
      pendingBookings: pending,
      approvedBookings: approved,
      totalTrips: trips.length,
      inProgressTrips: inProgress,
      completedTrips: completed
    };
  }, [bookings, trips]);

  const contextValue = useMemo(() => ({
    bookings,
    trips,
    loading,
    error,
    lastFetch,
    stats,
    refreshData,
    addBooking,
    updateBooking
  }), [bookings, trips, loading, error, lastFetch, stats, refreshData, addBooking, updateBooking]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

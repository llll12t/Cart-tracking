// src/context/AuthContext.js
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // 1. Import db เข้ามา
import { doc, getDoc } from 'firebase/firestore'; // 2. Import ฟังก์ชัน firestore

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // 3. สร้าง state เก็บข้อมูล user จาก firestore
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => { // 4. เปลี่ยนเป็น async function
      if (user) {
        setUser(user);
        // 5. ดึงข้อมูลเพิ่มเติมจาก Firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data()); // เก็บข้อมูลทั้งหมด (รวม role)
        } else {
          console.log("No such user document!");
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    // 6. ส่ง userProfile ไปใน value ด้วย
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
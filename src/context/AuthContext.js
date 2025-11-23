// src/context/AuthContext.js
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore'; // ตัด collection, query, where, getDocs ออก เพราะไม่ได้ใช้แล้ว

const AuthContext = createContext();

export const AuthProvider = ({ children, initialUserProfile = null }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(initialUserProfile);
  const [loading, setLoading] = useState(true);

  // ฟังก์ชันสำหรับ set userProfile จากภายนอก (จาก useLiffAuth)
  const setUserProfileFromAuth = useCallback((profile) => {
    setUserProfile(profile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("onAuthStateChanged triggered. firebaseUser:", firebaseUser);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // -------------------------------------------------------
        // ส่วนที่แก้ไข: เปลี่ยนจากการค้นหาด้วย Email เป็น UID
        // -------------------------------------------------------
        try {
          // ใช้ UID ค้นหาเอกสารใน collection 'users' โดยตรง
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            console.log("User profile found via UID:", firebaseUser.uid);
            setUserProfile({ uid: userDocSnap.id, ...userDocSnap.data() });
          } else {
            console.warn("No user profile found in Firestore for UID:", firebaseUser.uid);
            // กรณีนี้อาจจะเกิดขึ้นถ้า User Auth มีอยู่ แต่ยังไม่มีข้อมูลใน Firestore
            setUserProfile(null);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setUserProfile(null);
        }
        // -------------------------------------------------------

      } else {
        console.log("No firebaseUser found, logging out.");
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); 

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      console.log("User logged out successfully.");
    } catch (err) {
      console.error('Logout error', err);
    }
  }, []);

  const contextValue = useMemo(() => ({
    user,
    userProfile,
    loading,
    logout,
    setUserProfileFromAuth
  }), [user, userProfile, loading, logout, setUserProfileFromAuth]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
        
        // [OPTIMIZATION] ตรวจสอบก่อนว่ามี userProfile อยู่แล้วหรือไม่ (จากการ Login ผ่าน LIFF)
        // ถ้ามีอยู่แล้วและ uid ตรงกัน ไม่ต้องดึงใหม่จาก Firestore ให้เสียเวลา
        if (userProfile && (userProfile.uid === firebaseUser.uid || userProfile.id === firebaseUser.uid)) {
             console.log("Using existing user profile from LIFF/State, skipping Firestore fetch.");
             setLoading(false);
             return; 
        }

        // ถ้ายังไม่มี Profile ถึงค่อยไปดึงจาก Firestore
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            console.log("User profile found via UID:", firebaseUser.uid);
            setUserProfile({ uid: userDocSnap.id, ...userDocSnap.data() });
          } else {
            console.warn("No user profile found in Firestore for UID:", firebaseUser.uid);
            setUserProfile(null);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setUserProfile(null);
        }

      } else {
        console.log("No firebaseUser found, logging out.");
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]); // เพิ่ม userProfile ใน dependency เพื่อให้ check state ล่าสุดได้ถูกต้อง

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

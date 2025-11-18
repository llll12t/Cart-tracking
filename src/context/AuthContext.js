// src/context/AuthContext.js
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

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
        
        // ถ้ามี userProfile อยู่แล้ว (จาก login response) ไม่ต้องดึงใหม่
        if (userProfile) {
          console.log("userProfile already exists, skipping Firestore query");
          setLoading(false);
          return;
        }
        
        console.log(`Attempting to find user profile with UID: ${firebaseUser.uid}`);

        // ใช้ email ใน firebaseUser แทน UID (เหมือน payment flow)
        let userEmail = firebaseUser.email;
        if (!userEmail && firebaseUser.providerData && firebaseUser.providerData.length > 0) {
          userEmail = firebaseUser.providerData[0].email;
        }
        if (userEmail) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', userEmail));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            console.log("User document found with email:", userEmail);
            setUserProfile({ uid: userDoc.id, ...userDoc.data() });
          } else {
            console.log("No user document found for email:", userEmail);
            // ไม่สร้างผู้ใช้อัตโนมัติที่นี่แล้ว - ย้ายไปทำที่ Backend
            setUserProfile(null);
          }
        } else {
          console.error("No email found in firebaseUser. Cannot query user profile.");
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
  }, []); // ลบ userProfile ออกจาก dependency เพื่อป้องกัน infinite loop

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

  // ใช้ useMemo เพื่อป้องกัน context value object ถูกสร้างใหม่ทุกครั้ง
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

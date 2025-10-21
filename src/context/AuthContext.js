// src/context/AuthContext.js
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("onAuthStateChanged triggered. firebaseUser:", firebaseUser);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // --- LOG ที่เพิ่มเข้ามา ---
        console.log(`Attempting to find user profile with UID: ${firebaseUser.uid}`);
        // -----------------------

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
            // ถ้าไม่พบ user document ให้สร้างใหม่อัตโนมัติ
            try {
              const newUser = {
                email: userEmail,
                name: firebaseUser.displayName || userEmail.split('@')[0],
                role: 'admin', // หรือกำหนด logic อื่นตามต้องการ
                createdAt: new Date(),
              };
              const usersRef = collection(db, 'users');
              const docRef = await (await import('firebase/firestore')).addDoc(usersRef, newUser);
              setUserProfile({ uid: docRef.id, ...newUser });
              console.log('Created new user document for', userEmail);
            } catch (err) {
              console.error('Failed to auto-create user document:', err);
              setUserProfile(null);
            }
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
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      console.log("User logged out successfully.");
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

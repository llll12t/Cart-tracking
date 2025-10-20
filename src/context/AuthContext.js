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

        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          console.log("User document found with UID:", firebaseUser.uid);
          setUserProfile({ uid: userDocSnap.id, ...userDocSnap.data() });
        } else {
          console.error(`CRITICAL: No user document found for authenticated UID: ${firebaseUser.uid}. This should not happen in a correct custom token flow.`);
          
          let lineId = null;
          if (firebaseUser.providerData && firebaseUser.providerData.length > 0) {
            const lineProvider = firebaseUser.providerData.find(p => p.providerId === 'line.me');
            if (lineProvider) {
              lineId = lineProvider.uid;
            }
          }
          
          if (lineId) {
            console.log("Fallback initiated: Attempting to find user by lineId:", lineId);
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('lineId', '==', lineId));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              console.log("Fallback successful. Found user doc via lineId:", userDoc.id);
              setUserProfile({ uid: userDoc.id, ...userDoc.data() });
            } else {
              console.error("Fallback failed: No user found with lineId:", lineId);
              setUserProfile(null);
            }
          } else {
             console.error("Fallback failed: Could not determine lineId from the firebaseUser object.");
             setUserProfile(null);
          }
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

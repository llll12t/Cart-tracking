// src/context/AuthContext.js
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // 1. Import db เข้ามา
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'; // 2. Import ฟังก์ชัน firestore

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // 3. สร้าง state เก็บข้อมูล user จาก firestore
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check LIFF_MOCK in localStorage or development mode
    let isMock = false;
    try {
      if (typeof window !== 'undefined') {
        const mockFlag = window.localStorage.getItem('LIFF_MOCK');
        isMock = mockFlag === '1' || mockFlag === 'true';
      }
    } catch (e) {}
    if (isMock || process.env.NODE_ENV === 'development') {
      // Mock user for LIFF mock mode (ค้นหาจาก lineId เป็นหลัก)
      const mockUser = {
        uid: 'line:U_TEST_1234567890ABCDEF',
        displayName: 'คุณ ทดสอบ',
        email: 'mockuser@example.com',
        providerData: [{ uid: 'U8d286780c70cf7d60a0ff5704dcf2319' }],
      };
      setUser(mockUser);
      // ตรวจสอบ Firestore ว่ามี user ที่ field lineId ตรงกับ mockUser.providerData[0].uid หรือไม่
      (async () => {
        try {
          const usersCol = collection(db, 'users');
          const q = query(usersCol, where('lineId', '==', mockUser.providerData[0].uid));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            setUserProfile(qSnap.docs[0].data());
          } else {
            setUserProfile(null);
          }
        } catch (e) {
          setUserProfile(null);
        }
        setLoading(false);
      })();
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => { // 4. เปลี่ยนเป็น async function
      if (user) {
        setUser(user);
        // 5. ดึงข้อมูลเพิ่มเติมจาก Firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          // We found a user document at the auth.uid. However for LINE sign-ins
          // this doc is often the auto-upserted minimal profile (uid = `line:{id}`).
          // If that doc doesn't contain a meaningful `role`, try to find an
          // admin-created user doc that has the same `lineId` and use that one
          // instead (so admins can pre-create driver accounts and set role).
          const data = docSnap.data();
          if (data && data.role) {
            setUserProfile(data);
          } else {
            // attempt lookup by lineId (either from the doc or from auth uid)
            let lineId = data?.lineId || null;
            if (!lineId && user.uid && user.uid.startsWith('line:')) {
              lineId = user.uid.split(':')[1];
            }

            if (lineId) {
              try {
                const usersCol = collection(db, 'users');
                const q = query(usersCol, where('lineId', '==', lineId));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) {
                  // prefer a doc whose id is not the auto-upserted `line:{id}`
                  let matchedDoc = qSnap.docs.find(d => d.id !== user.uid) || qSnap.docs[0];
                  const matched = matchedDoc.data();
                  setUserProfile(matched);
                } else {
                  // no other doc found, fall back to the minimal doc
                  setUserProfile(data);
                }
              } catch (err) {
                console.error('Error looking up user by lineId', err);
                setUserProfile(data);
              }
            } else {
              setUserProfile(data);
            }
          }
        } else {
          // No document at this auth UID. This can happen when users sign in with LINE
          // and their application user record lives under a different UID (admin-created).
          // Try to find a user doc that has a matching lineId field.
          console.log("No user doc for uid, attempting lineId lookup...");
          try {
            // If auth uid was created as `line:{lineUserId}` we can parse the line id
            let lineId = null;
            if (user.uid && user.uid.startsWith('line:')) {
              lineId = user.uid.split(':')[1];
            } else if (user.providerData && user.providerData.length) {
              // try providerData for possible identifiers
              const pd = user.providerData[0];
              if (pd && pd.uid) lineId = pd.uid;
            }

            if (lineId) {
              const usersCol = collection(db, 'users');
              const q = query(usersCol, where('lineId', '==', lineId));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                const matched = qSnap.docs[0].data();
                setUserProfile(matched);
              } else {
                setUserProfile(null);
              }
            } else {
              setUserProfile(null);
            }
          } catch (err) {
            console.error('Error looking up user by lineId', err);
            setUserProfile(null);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      // auth check finished — stop showing the global loading indicator
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  return (
    // 6. ส่ง userProfile และ logout ไปใน value ด้วย
    <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
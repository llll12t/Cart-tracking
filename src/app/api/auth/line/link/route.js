import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

/**
 * POST /api/auth/line/link
 * Link a LINE account to an existing user by phone number
 * 
 * Body: { lineId: string, phone: string }
 * Response: { customToken: string }
 */
export async function POST(request) {
  try {
    const { lineId, phone } = await request.json();

    if (!lineId || !phone) {
      return NextResponse.json(
        { error: 'Missing lineId or phone' },
        { status: 400 }
      );
    }

    const db = admin.firestore();
    const usersRef = db.collection('users');

    // Find user by phone
    const phoneSnapshot = await usersRef.where('phone', '==', phone).limit(1).get();

    if (phoneSnapshot.empty) {
      // สร้างผู้ใช้ใหม่อัตโนมัติถ้าไม่พบในระบบ
      console.log('No user found with phone:', phone, '- creating new user');
      
      try {
        const newUserData = {
          phone: phone,
          lineId: lineId,
          role: 'driver', // กำหนด role เริ่มต้นเป็น driver สำหรับผู้ใช้ใหม่
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLogin: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const newUserRef = await usersRef.add(newUserData);
        const newUid = newUserRef.id;
        
        // Create Firebase Auth user
        await admin.auth().createUser({
          uid: newUid,
          phoneNumber: phone,
          disabled: false
        });
        
        // Create custom token for new user
        const customToken = await admin.auth().createCustomToken(newUid);
        
        return NextResponse.json({ 
          customToken,
          userProfile: {
            uid: newUid,
            ...newUserData,
            createdAt: new Date() // convert for JSON
          },
          message: 'Successfully created and linked new user'
        });
        
      } catch (error) {
        console.error('Error creating new user:', error);
        return NextResponse.json(
          { error: 'Failed to create new user', details: error.message },
          { status: 500 }
        );
      }
    }

    const userDoc = phoneSnapshot.docs[0];
    const uid = userDoc.id;
    const userData = userDoc.data();

    // Check if this LINE ID is already linked to another user
    const lineSnapshot = await usersRef.where('lineId', '==', lineId).limit(1).get();
    if (!lineSnapshot.empty && lineSnapshot.docs[0].id !== uid) {
      return NextResponse.json(
        { error: 'This LINE account is already linked to another user' },
        { status: 409 }
      );
    }

    // Check if user already has a different LINE ID
    if (userData.lineId && userData.lineId !== lineId) {
      return NextResponse.json(
        { error: 'This user is already linked to another LINE account' },
        { status: 409 }
      );
    }

    // Link the LINE ID to the user
    await userDoc.ref.update({
      lineId: lineId,
      linkedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create Firebase Auth user if it doesn't exist
    let authUser;
    try {
      authUser = await admin.auth().getUser(uid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create Firebase Auth user
        authUser = await admin.auth().createUser({
          uid: uid,
          phoneNumber: userData.phone,
          displayName: userData.displayName || userData.name,
          disabled: false
        });
      } else {
        throw error;
      }
    }

    // Create custom token
    const customToken = await admin.auth().createCustomToken(uid);

    // ดึงข้อมูล user ล่าสุดหลังจาก update
    const updatedUserDoc = await userDoc.ref.get();
    const updatedUserData = updatedUserDoc.data();

    return NextResponse.json({ 
      customToken,
      userProfile: {
        uid: uid,
        ...updatedUserData
      },
      message: 'Successfully linked LINE account'
    });

  } catch (error) {
    console.error('Link error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

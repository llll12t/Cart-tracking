import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// ตรวจสอบให้แน่ใจว่าคุณได้ดาวน์โหลดไฟล์ serviceAccountKey.json
// จาก Firebase Console > Project Settings > Service Accounts
// และวางไว้ที่ root ของโปรเจกต์
// **สำคัญ: อย่าลืมเพิ่มไฟล์นี้ใน .gitignore เพื่อความปลอดภัย**
try {
  const serviceAccount = require('../../../../serviceAccountKey.json');

  // Initialize Firebase Admin SDK (ถ้ายังไม่ได้ทำ)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('Service Account Key not found or invalid. Please check your serviceAccountKey.json file.', error);
}


export async function POST(request) {
  // ตรวจสอบว่า admin SDK พร้อมใช้งานหรือไม่
  if (!admin.apps.length) {
    return NextResponse.json({ error: 'Firebase Admin SDK not initialized.' }, { status: 500 });
  }

  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password || !name || !role) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    // 1. สร้างผู้ใช้ใน Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
    });

    // 2. สร้างโปรไฟล์ผู้ใช้ใน Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      name: name,
      email: email,
      role: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ message: 'User created successfully', uid: userRecord.uid }, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 409 });
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' }, { status: 500 });
  }
}
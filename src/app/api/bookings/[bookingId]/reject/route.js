// src/app/api/bookings/[bookingId]/reject/route.js
import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import fetch from 'node-fetch';

const db = admin.firestore();

async function verifyLineIdToken(idToken) {
  // Simple verify: call LINE verify endpoint (id token) - optional, fallback to decode
  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: process.env.NEXT_PUBLIC_LIFF_CLIENT_ID || process.env.NEXT_PUBLIC_LIFF_ID })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sub || data.userId || null;
  } catch (err) {
    console.error('verifyLineIdToken error', err);
    return null;
  }
}

export async function POST(req, { params }) {
  try {
    const bookingId = params.bookingId;
    if (!bookingId) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 });
    const body = await req.json();
    const { idToken } = body || {};

    let lineUserId = null;
    if (idToken) {
      lineUserId = await verifyLineIdToken(idToken);
    }

    if (!lineUserId) return NextResponse.json({ ok: false, error: 'invalid line token' }, { status: 401 });

    const usersSnap = await db.collection('users').where('role', '==', 'admin').where('lineId', '==', lineUserId).get();
    if (usersSnap.empty) return NextResponse.json({ ok: false, error: 'not authorized' }, { status: 403 });

    const bookingRef = db.collection('bookings').doc(bookingId);
    await bookingRef.update({ status: 'rejected', rejectedAt: admin.firestore.FieldValue.serverTimestamp(), rejectedByLineId: lineUserId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/bookings/[id]/reject error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
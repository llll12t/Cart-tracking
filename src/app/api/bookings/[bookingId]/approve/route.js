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
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { /* not json */ }
    if (!res.ok) {
      console.error('LINE verify failed', { status: res.status, body: text });
      return { error: text, status: res.status };
    }
    return { sub: data?.sub || data?.userId || null };
  } catch (err) {
    console.error('verifyLineIdToken error', err);
    return { error: String(err) };
  }
}

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    // pathname ... /api/bookings/{bookingId}/approve
    const bookingId = parts.length >= 3 ? parts[parts.length - 2] : parts[parts.length - 1];
    if (!bookingId) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 });
    const body = await req.json();
    const { idToken } = body || {};

    let lineVerify = null;
    let lineUserId = null;
    if (idToken) {
      lineVerify = await verifyLineIdToken(idToken);
      if (lineVerify && lineVerify.sub) lineUserId = lineVerify.sub;
    }

    // if verification failed, return diagnostic to help debug
    if (!lineUserId) {
      const diag = (lineVerify && lineVerify.error) ? `LINE verify failed: ${lineVerify.error}` : 'invalid line token';
      console.error('Approve rejected -', diag);
      return NextResponse.json({ ok: false, error: diag }, { status: 401 });
    }

    // check if lineUserId belongs to an admin
    const usersSnap = await db.collection('users').where('role', '==', 'admin').where('lineId', '==', lineUserId).get();
    if (usersSnap.empty) return NextResponse.json({ ok: false, error: 'not authorized' }, { status: 403 });

    // update booking doc
    const bookingRef = db.collection('bookings').doc(bookingId);
    await bookingRef.update({ status: 'approved', approvedAt: admin.firestore.FieldValue.serverTimestamp(), approvedByLineId: lineUserId });

    // trigger notification to driver and requester
    const bookingSnap = await bookingRef.get();
    const booking = bookingSnap.exists ? bookingSnap.data() : {};
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'booking_approved', booking })
      });
    } catch (err) {
      console.error('notify after approve error', err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/bookings/[id]/approve error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

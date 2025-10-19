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

    // if no lineUserId, try to read from request (not secure) -> reject
    if (!lineUserId) return NextResponse.json({ ok: false, error: 'invalid line token' }, { status: 401 });

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

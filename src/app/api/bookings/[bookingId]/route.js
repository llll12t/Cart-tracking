import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

const db = admin.firestore();

export async function GET(req) {
  try {
    const url = new URL(req.url);
    // last segment should be bookingId
    const parts = url.pathname.split('/').filter(Boolean);
    const bookingId = parts[parts.length - 1];
    if (!bookingId) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 });
    const snap = await db.collection('bookings').doc(bookingId).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    const data = snap.data();
    // include id for convenience
    return NextResponse.json({ ...data, id: bookingId });
  } catch (err) {
    console.error('GET /api/bookings/[id] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

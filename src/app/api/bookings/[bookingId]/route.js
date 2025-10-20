// src/app/api/bookings/[bookingId]/route.js
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(req, context) {
  const params = await context.params;
  const bookingId = params?.bookingId;
  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Missing bookingId' }), { status: 400 });
  }
  try {
    const ref = doc(db, 'bookings', bookingId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }
    return new Response(JSON.stringify({ id: snap.id, ...snap.data() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

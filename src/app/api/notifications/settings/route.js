import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

const db = admin.firestore();

const DEFAULTS = {
  roles: {
    admin: { booking_created: true, vehicle_returned: true },
    driver: { booking_created: true, booking_approved: true, vehicle_returned: true },
    employee: { booking_created: true, vehicle_returned: true }
  }
  ,
  vehicleTypes: ['รถ SUV', 'รถเก๋ง', 'รถกระบะ', 'รถตู้', 'รถบรรทุก', 'มอเตอร์ไซค์', 'อื่นๆ'],
  usageLimits: {
    storageMB: 512,
    firestoreDocs: 10000
  }
};

export async function GET() {
  try {
    const ref = db.collection('appConfig').doc('notifications');
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json(DEFAULTS);
    return NextResponse.json(snap.data());
  } catch (err) {
    console.error('GET /api/notifications/settings error', err);
    return NextResponse.json(DEFAULTS, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const ref = db.collection('appConfig').doc('notifications');
    await ref.set(body, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/notifications/settings error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

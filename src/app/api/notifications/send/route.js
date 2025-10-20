import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import fetch from 'node-fetch';
import { bookingCreatedAdmin } from '@/lib/lineFlexMessages';

const db = admin.firestore();
const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.NEXT_PUBLIC_LINE_CHANNEL_ACCESS_TOKEN || '';

function normalizeBooking(b) {
  if (!b) return null;
  return {
    id: b.id || b.bookingId || b._id || '',
    requesterName: b.requesterName || b.requester || b.userName || '',
    userEmail: b.userEmail || b.requesterEmail || b.requester?.email || '',
    vehicleLicensePlate: b.vehicleLicensePlate || b.vehicle?.licensePlate || b.vehicleId || '',
    startDate: b.startDate || b.from || null,
    endDate: b.endDate || b.to || null,
    returnedAt: b.returnedAt || null
  };
}

async function sendPushMessage(to, message) {
  if (!ACCESS_TOKEN) throw new Error('LINE channel access token not configured');
  // Ensure message is in correct LINE format (type: 'flex' or 'text')
  let payload;
  if (Array.isArray(message)) {
    payload = message.map(m => {
      if (m.contents) {
        return { type: 'flex', altText: m.altText || '', contents: m.contents };
      } else if (m.text || m.altText) {
        return { type: 'text', text: m.text || m.altText || '' };
      } else {
        return m;
      }
    });
  } else if (message.contents) {
    payload = [{ type: 'flex', altText: message.altText || '', contents: message.contents }];
  } else if (message.text || message.altText) {
    payload = [{ type: 'text', text: message.text || message.altText || '' }];
  } else {
    payload = [message];
  }
  const body = { to, messages: payload };
  // DEBUG LOG: แสดง payload ที่จะส่งไป LINE API
  console.error('[LINE_PUSH] payload:', JSON.stringify(body, null, 2));
  const resp = await fetch(LINE_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => 'no body');
    const err = new Error('line_push_failed');
    err.status = resp.status;
    err.body = txt;
    throw err;
  }
  return true;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { event, booking } = body;
    if (!booking) return NextResponse.json({ ok: false, error: 'missing booking' }, { status: 400 });

    const b = normalizeBooking(booking);

    // build messages depending on event (admin only)
    let adminMsg = null;
    switch (event) {
      case 'booking_created':
      case 'booking_approval_request':
      case 'booking_approved':
      case 'vehicle_sent':
      case 'vehicle_returned':
      default:
        adminMsg = bookingCreatedAdmin(b);
    }

    const results = { sent: [], skipped: [], errors: [] };

    // find recipients: admins and employees
    let usersSnapshot;
    try {
      usersSnapshot = await db.collection('users').where('role', 'in', ['admin', 'employee']).get();
    } catch (e) {
      console.error('Error querying users for notifications', e);
      return NextResponse.json({ ok: false, error: 'user lookup failed' }, { status: 500 });
    }

    // For each user, send only to admin
    for (const doc of usersSnapshot.docs) {
      const ud = doc.data();
      const lineId = ud?.lineId;
      const role = ud?.role;
      if (role !== 'admin') continue;
      if (!lineId) {
        results.skipped.push({ uid: doc.id, reason: 'no_lineId' });
        continue;
      }
      let msgToSend = adminMsg;
      if (!msgToSend) {
        results.skipped.push({ uid: doc.id, reason: 'no_message' });
        continue;
      }
      try {
        // Always send as Flex Message
        const messages = [{ type: 'flex', altText: msgToSend.altText || '', contents: msgToSend.contents }];
        await sendPushMessage(lineId, messages);
        results.sent.push({ uid: doc.id, lineId });
      } catch (err) {
        console.error('Error sending push message to', lineId, err);
        results.errors.push({ uid: doc.id, lineId, error: String(err) });
      }
    }

    // (งด notify requester โดยตรง)

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('POST /api/notifications/send error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
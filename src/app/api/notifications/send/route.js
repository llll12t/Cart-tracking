import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import fetch from 'node-fetch';
import {
  bookingCreatedAdmin,
  bookingCreatedEmployee,
  bookingApprovalRequest,
  bookingApprovedDriver,
  vehicleSentDriver,
  vehicleReturnedAdmin,
  vehicleReturnedEmployee
} from '@/lib/lineFlexMessages';

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
  const payload = Array.isArray(message) ? message : [message];
  const body = { to, messages: payload };
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

    // build messages depending on event
    let adminMsg = null;
    let userMsg = null;
    switch (event) {
      case 'booking_created':
        adminMsg = bookingCreatedAdmin(b);
        userMsg = bookingCreatedEmployee(b);
        break;
      case 'booking_approval_request':
        adminMsg = bookingApprovalRequest(b);
        break;
      case 'booking_approved':
        adminMsg = bookingApprovedDriver(b);
        break;
      case 'vehicle_sent':
        adminMsg = vehicleSentDriver(b);
        break;
      case 'vehicle_returned':
        adminMsg = vehicleReturnedAdmin(b);
        userMsg = vehicleReturnedEmployee(b);
        break;
      default:
        // fallback: try booking created payloads
        adminMsg = bookingCreatedAdmin(b);
        userMsg = bookingCreatedEmployee(b);
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

    // For each user, send either adminMsg (admins) or userMsg (employees when matches requester)
    for (const doc of usersSnapshot.docs) {
      const ud = doc.data();
      const lineId = ud?.lineId;
      const role = ud?.role;
      if (!lineId) {
        results.skipped.push({ uid: doc.id, reason: 'no_lineId' });
        continue;
      }

      // decide which message to send
      let msgToSend = null;
      if (role === 'admin') msgToSend = adminMsg;
      else if (role === 'employee') {
        // if the employee is the requester, send user message; otherwise admins cover it
        if (ud?.email && ud.email === b.userEmail) msgToSend = userMsg || adminMsg;
        else msgToSend = adminMsg;
      } else {
        msgToSend = adminMsg;
      }

      if (!msgToSend) {
        results.skipped.push({ uid: doc.id, reason: 'no_message' });
        continue;
      }

      try {
        // msgToSend can be { altText, contents } where contents is Flex bubble or array
        const messages = msgToSend.contents ? (Array.isArray(msgToSend.contents) ? msgToSend.contents : [msgToSend.contents]) : [{ type: 'text', text: msgToSend.altText || String(msgToSend) }];
        await sendPushMessage(lineId, messages);
        results.sent.push({ uid: doc.id, lineId });
      } catch (err) {
        console.error('Error sending push message to', lineId, err);
        results.errors.push({ uid: doc.id, lineId, error: String(err) });
      }
    }

    // also attempt to notify the requester directly if they have a lineId
    try {
      if (b.userEmail) {
        const q = await db.collection('users').where('email', '==', b.userEmail).limit(1).get();
        if (!q.empty) {
          const ud = q.docs[0].data();
          if (ud?.lineId && userMsg) {
            try {
              const messages = userMsg.contents ? (Array.isArray(userMsg.contents) ? userMsg.contents : [userMsg.contents]) : [{ type: 'text', text: userMsg.altText || '' }];
              await sendPushMessage(ud.lineId, messages);
              results.sent.push({ requester: q.docs[0].id, lineId: ud.lineId });
            } catch (err) {
              results.errors.push({ requester: q.docs[0].id, error: String(err) });
            }
          }
        }
      }
    } catch (err) {
      console.error('requester lookup error', err);
      results.errors.push({ requesterLookupError: String(err) });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('POST /api/notifications/send error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
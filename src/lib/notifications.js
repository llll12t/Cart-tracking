import admin from '@/lib/firebaseAdmin';
import fetch from 'node-fetch';
import {
  bookingCreatedAdmin,
  bookingApprovalRequestAdmin,
  bookingApprovedAdmin,
  bookingRejectedAdmin,
  vehicleSentAdmin,
  vehicleReturnedAdmin,
  bookingCreatedDriver,
  bookingApprovedDriver,
  bookingRejectedDriver,
  vehicleSentDriver,
  vehicleReturnedDriver,
  bookingCreatedEmployee
} from './lineFlexMessages';

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
  let payload;
  if (Array.isArray(message)) {
    payload = message.map(m => {
      if (m.contents) return { type: 'flex', altText: m.altText || '', contents: m.contents };
      if (m.text || m.altText) return { type: 'text', text: m.text || m.altText || '' };
      return m;
    });
  } else if (message.contents) {
    payload = [{ type: 'flex', altText: message.altText || '', contents: message.contents }];
  } else if (message.text || message.altText) {
    payload = [{ type: 'text', text: message.text || message.altText || '' }];
  } else {
    payload = [message];
  }
  const body = { to, messages: payload };
  const resp = await fetch(LINE_PUSH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
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

export async function sendNotificationsForEvent(event, booking) {
  const b = normalizeBooking(booking);
  // Load settings
  let notifSettings = { roles: {} };
  try {
    const cfgSnap = await db.collection('appConfig').doc('notifications').get();
    if (cfgSnap.exists) notifSettings = cfgSnap.data();
  } catch (e) {
    console.error('Failed to load notification settings, using defaults', e);
  }

  // Build templates
  const templates = {
    admin: {
      booking_created: bookingCreatedAdmin(b),
      booking_approval_request: bookingApprovalRequestAdmin(b),
      booking_approved: bookingApprovedAdmin(b),
      booking_rejected: bookingRejectedAdmin(b),
      vehicle_sent: vehicleSentAdmin(b),
      vehicle_returned: vehicleReturnedAdmin(b)
    },
    driver: {
      booking_created: bookingCreatedDriver(b),
      booking_approved: bookingApprovedDriver(b),
      booking_rejected: bookingRejectedDriver(b),
      vehicle_sent: vehicleSentDriver(b),
      vehicle_returned: vehicleReturnedDriver(b)
    },
    employee: {
      booking_created: bookingCreatedEmployee(b),
      booking_rejected: bookingRejectedAdmin(b),
      vehicle_returned: vehicleReturnedAdmin(b)
    }
  };

  const results = { sent: [], skipped: [], errors: [] };

  // Query all possible recipients (admins, employees, drivers)
  let usersSnapshot;
  try {
    usersSnapshot = await db.collection('users').where('role', 'in', ['admin', 'employee', 'driver']).get();
  } catch (e) {
    console.error('Error querying users for notifications', e);
    throw e;
  }

  for (const doc of usersSnapshot.docs) {
    const ud = doc.data();
    const lineId = ud?.lineId;
    const role = ud?.role;
    if (!['admin', 'employee', 'driver'].includes(role)) continue;
    const roleSettings = (notifSettings.roles && notifSettings.roles[role]) || {};
    const enabled = typeof roleSettings[event] === 'boolean' ? roleSettings[event] : true;
    if (!enabled) {
      results.skipped.push({ uid: doc.id, reason: 'setting_disabled' });
      continue;
    }
    if (!lineId) {
      results.skipped.push({ uid: doc.id, reason: 'no_lineId' });
      continue;
    }
    const msgToSend = templates[role] ? templates[role][event] : null;
    if (!msgToSend) {
      results.skipped.push({ uid: doc.id, reason: 'no_message' });
      continue;
    }
    try {
      const messages = [{ type: 'flex', altText: msgToSend.altText || '', contents: msgToSend.contents }];
      await sendPushMessage(lineId, messages);
      results.sent.push({ uid: doc.id, lineId });
    } catch (err) {
      console.error('Error sending push message to', lineId, err);
      results.errors.push({ uid: doc.id, lineId, error: String(err) });
    }
  }

  return results;
}

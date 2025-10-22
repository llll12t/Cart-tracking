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
    // who will drive / who was assigned
    driverId: b.driverId || b.driver?.id || b.driverUid || b.userId || null,
    driverName: b.driverName || b.driver?.name || b.driver?.displayName || null,
    vehicleLicensePlate: b.vehicleLicensePlate || b.vehicle?.licensePlate || b.vehicleId || '',
    // Canonical fields introduced: startDateTime (instant), startCalendarDate (YYYY-MM-DD)
    startDateTime: b.startDateTime || b.startDate || b.from || null,
    startCalendarDate: b.startCalendarDate || b.startDate || null,
    // end may be stored as endDateTime or endDate
    endDateTime: b.endDateTime || b.endDate || b.to || null,
    endCalendarDate: b.endCalendarDate || b.endDate || null,
    // timestamps / lifecycle
    sentAt: b.sentAt || null,
    returnedAt: b.returnedAt || b.endDateTime || null
    ,
    // mileage and expenses (may be attached when server fetched full booking)
    startMileage: b.startMileage || null,
    endMileage: b.endMileage || null,
    totalExpenses: typeof b.totalExpenses === 'number' ? b.totalExpenses : null,
    expenses: b.expenses || null
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
  // If caller provided only a booking id or partial booking data, fetch
  // the authoritative booking record and related expenses from Firestore
  // so notifications can include server-side timestamps, mileage and totals.
  let fullBooking = booking || {};
  try {
    if (booking && booking.id) {
      const snap = await db.collection('bookings').doc(booking.id).get();
      if (snap.exists) {
        fullBooking = { ...(booking || {}), ...snap.data(), id: booking.id };
      }
      try {
        const expSnap = await db.collection('expenses').where('bookingId', '==', booking.id).get();
        const exps = expSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
        fullBooking.expenses = exps;
        fullBooking.totalExpenses = exps.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      } catch (e) {
        console.warn('Failed to load expenses for booking', booking.id, e);
      }
    }
  } catch (e) {
    console.warn('Failed to load full booking record for notifications, proceeding with provided payload', e);
  }

  const b = normalizeBooking(fullBooking);
  // Load settings
  let notifSettings = { roles: {} };
  try {
    const cfgSnap = await db.collection('appConfig').doc('notifications').get();
    if (cfgSnap.exists) notifSettings = cfgSnap.data();
  } catch (e) {
    console.error('Failed to load notification settings, using defaults', e);
  }

  // Quick fail if no LINE token configured
  if (!ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN not configured — skipping sends');
    const res = { sent: [], skipped: [], errors: [{ reason: 'no_access_token' }] };
    return res;
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

  // Collect issues for optional admin alert
  const issues = [];

  // Build recipient list. For vehicle_returned we only notify admins + the returning driver
  let recipientDocs = [];
  try {
    if (event === 'vehicle_returned') {
      // admins
      const adminSnaps = await db.collection('users').where('role', '==', 'admin').get();
      recipientDocs.push(...adminSnaps.docs);
      // returning driver (if assigned)
      if (fullBooking && fullBooking.driverId) {
        try {
          const drv = await db.collection('users').doc(fullBooking.driverId).get();
          if (drv.exists) recipientDocs.push(drv);
        } catch (e) {
          console.warn('Failed to fetch driver user for notifications', fullBooking.driverId, e);
        }
      }
    } else {
      const usersSnapshot = await db.collection('users').where('role', 'in', ['admin', 'employee', 'driver']).get();
      recipientDocs.push(...usersSnapshot.docs);
    }
  } catch (e) {
    console.error('Error querying users for notifications', e);
    throw e;
  }

  // dedupe recipients by uid
  const seen = new Set();
  for (const doc of recipientDocs) {
    const ud = doc.data();
    const lineId = ud?.lineId;
    const role = ud?.role;
    const uid = doc.id;
    if (seen.has(uid)) continue;
    seen.add(uid);
    if (!['admin', 'employee', 'driver'].includes(role)) continue;
    const roleSettings = (notifSettings.roles && notifSettings.roles[role]) || {};
    const enabled = typeof roleSettings[event] === 'boolean' ? roleSettings[event] : true;
    // Debug log per-recipient decision
    console.debug(`notif: user=${doc.id} role=${role} event=${event} enabled=${enabled} hasLineId=${!!lineId}`);
    if (!enabled) {
      results.skipped.push({ uid: doc.id, reason: 'setting_disabled' });
      issues.push({ uid: doc.id, reason: 'setting_disabled', role });
      continue;
    }
    if (!lineId) {
      results.skipped.push({ uid: doc.id, reason: 'no_lineId' });
      issues.push({ uid: doc.id, reason: 'no_lineId', role });
      continue;
    }
    const msgToSend = templates[role] ? templates[role][event] : null;
    if (!msgToSend) {
      results.skipped.push({ uid: doc.id, reason: 'no_message' });
      issues.push({ uid: doc.id, reason: 'no_message', role });
      console.warn(`notif: no message template for role=${role} event=${event}`);
      continue;
    }
    try {
      const messages = [{ type: 'flex', altText: msgToSend.altText || '', contents: msgToSend.contents }];
      await sendPushMessage(lineId, messages);
      results.sent.push({ uid: doc.id, lineId });
    } catch (err) {
      console.error('Error sending push message to', lineId, err);
      const errBody = err && err.body ? err.body : String(err);
      results.errors.push({ uid: doc.id, lineId, error: errBody });
      issues.push({ uid: doc.id, reason: 'send_error', role, details: errBody });
    }
  }

  // Optionally notify admins if there were skipped recipients or errors
  try {
    const alertAdmins = notifSettings.alertAdminOnIssues === true;
    if (alertAdmins && (issues.length > 0)) {
      // build a concise summary
  const counts = { skipped: results.skipped.length, errors: results.errors.length, totalRecipients: recipientDocs.length };
      const topReasons = {};
      for (const it of issues) topReasons[it.reason] = (topReasons[it.reason] || 0) + 1;
      const reasonList = Object.entries(topReasons).map(([r, c]) => `${r}:${c}`).join(', ');
      const summary = `Notifications for event ${event} had issues. recipients=${counts.totalRecipients} sent=${counts.sent || results.sent.length} skipped=${counts.skipped} errors=${counts.errors} reasons=${reasonList}`;

      // find admins with lineId
      const adminSnaps = await db.collection('users').where('role', '==', 'admin').get();
      const admins = adminSnaps.docs.map(d => ({ uid: d.id, ...d.data() })).filter(a => a.lineId);
      if (admins.length > 0) {
        for (const a of admins) {
          try {
            await sendPushMessage(a.lineId, { text: summary });
          } catch (e) {
            console.error('Failed to send admin alert', a.id, e);
            results.errors.push({ uid: a.id, reason: 'admin_alert_failed', error: String(e) });
          }
        }
        results.adminAlertsSent = true;
      } else {
        console.warn('No admin recipients with lineId to send notification issues summary');
      }
    }
  } catch (e) {
    console.error('Error while attempting to send admin alerts about notification issues', e);
    results.errors.push({ reason: 'admin_alert_error', error: String(e) });
  }

  return results;
}

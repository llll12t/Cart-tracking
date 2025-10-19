import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import {
  bookingCreatedAdmin,
  bookingCreatedEmployee,
  bookingApprovedDriver,
  vehicleSentDriver,
  vehicleReturnedAdmin,
  vehicleReturnedEmployee
} from '@/lib/lineFlexMessages';

const db = admin.firestore();

// simple helper to call LINE Messaging API push message, supports Flex messages
async function pushLineMessage(targetUserId, payload) {
  const cfgRef = db.collection('appConfig').doc('line');
  const cfgSnap = await cfgRef.get();
  // prefer server env var token for security; fall back to Firestore-stored token
  const envToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (envToken) {
    var token = envToken;
  } else {
    if (!cfgSnap.exists) throw new Error('LINE config not found and no env token');
    const cfg = cfgSnap.data();
    var token = cfg?.channelAccessToken;
    if (!token) throw new Error('LINE channelAccessToken missing');
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  const body = {
    to: targetUserId,
    messages: messages.map(m => {
      if (m.contents) return { type: 'flex', altText: m.altText || 'notification', contents: m.contents };
      // fallback text
      return { type: 'text', text: m.text || m };
    })
  };

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('LINE API push failed', { status: res.status, body: text, to: targetUserId, payload });
    // Try fallback: send a simple text message with altText if available
    try {
      const fallbackText = Array.isArray(payload) ? (payload[0].altText || 'มีการแจ้งเตือน') : (payload.altText || (payload.text || 'มีการแจ้งเตือน'));
      const fbRes = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ to: targetUserId, messages: [{ type: 'text', text: fallbackText }] })
      });
      if (!fbRes.ok) {
        const fbText = await fbRes.text();
        console.error('LINE fallback text push also failed', { status: fbRes.status, body: fbText, to: targetUserId });
        return { ok: false, status: res.status, detail: text };
      }
      return { ok: true, fallback: true };
    } catch (err) {
      console.error('LINE fallback push error', err);
      return { ok: false, status: res.status, detail: text };
    }
  }

  return { ok: true };
}

export async function POST(req) {
  try {
    const body = await req.json();
    // expected body: { event: 'booking_created'|'booking_approved'|'vehicle_returned'|'vehicle_sent', booking: {...} }
    const { event, booking } = body;
    if (!event || !booking) return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });

    // load notification settings
    const settingsRef = db.collection('appConfig').doc('notifications');
    const settingsSnap = await settingsRef.get();
    const settings = settingsSnap.exists ? settingsSnap.data() : null;

    // helper to decide if notify role
    function shouldNotify(role, key) {
      if (!settings) return true; // default allow
      return !!(settings.roles && settings.roles[role] && settings.roles[role][key]);
    }

    // Compose messages and targets
    const messagesToSend = [];

    // helper: extract first uri found in a Flex contents object
    function extractUriFromFlex(flex) {
      if (!flex || !flex.contents) return '';
      const seen = new Set();
      function walk(obj) {
        if (!obj || typeof obj !== 'object' || seen.has(obj)) return '';
        seen.add(obj);
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const r = walk(item);
            if (r) return r;
          }
          return '';
        }
        // check for action.uri
        if (obj.action && obj.action.uri) return obj.action.uri;
        for (const k of Object.keys(obj)) {
          try {
            const r = walk(obj[k]);
            if (r) return r;
          } catch (e) {}
        }
        return '';
      }
      return walk(flex.contents);
    }

    // Notify admin when booking created or vehicle returned
    if (event === 'booking_created' && shouldNotify('admin', 'booking_created')) {
      // find admin targets from config; if none, query users collection for admins with lineId
      const cfgRef = db.collection('appConfig').doc('notifications');
      const cfgSnap = await cfgRef.get();
      const cfg = cfgSnap.exists ? cfgSnap.data() : {};
      let adminTargets = cfg?.adminTargets || [];
      if (!adminTargets || adminTargets.length === 0) {
        // fallback to query users with role 'admin' and a lineId
        const usersSnap = await db.collection('users').where('role', '==', 'admin').get();
        adminTargets = usersSnap.docs.map(d => d.data()?.lineId).filter(Boolean);
      }
      const flex = bookingCreatedAdmin(booking);
      for (const t of adminTargets) {
        const computedUri = extractUriFromFlex(flex) || '';
        messagesToSend.push({ to: t, payload: flex, computedUri });
      }
    }

    if (event === 'booking_created' && shouldNotify('driver', 'booking_created')) {
      // notify assigned driver if exists (booking.vehicleDriverId)
      if (booking.driverLineId) {
        const flex = bookingCreatedEmployee(booking);
        messagesToSend.push({ to: booking.driverLineId, payload: flex, computedUri: extractUriFromFlex(flex) || '' });
      }
    }

    if (event === 'booking_approved' && shouldNotify('driver', 'booking_approved')) {
      if (booking.driverLineId) {
        const flex = bookingApprovedDriver(booking);
        messagesToSend.push({ to: booking.driverLineId, payload: flex, computedUri: extractUriFromFlex(flex) || '' });
      }
    }

    if (event === 'vehicle_sent' && shouldNotify('driver', 'vehicle_sent')) {
      if (booking.driverLineId) {
        const flex = vehicleSentDriver(booking);
        messagesToSend.push({ to: booking.driverLineId, payload: flex, computedUri: extractUriFromFlex(flex) || '' });
      }
    }

    if (['vehicle_returned', 'booking_returned'].includes(event)) {
      // notify admin and employee
      if (shouldNotify('admin', 'vehicle_returned')) {
        const cfgRef = db.collection('appConfig').doc('notifications');
        const cfgSnap = await cfgRef.get();
        const cfg = cfgSnap.exists ? cfgSnap.data() : {};
        let adminTargets = cfg?.adminTargets || [];
        if (!adminTargets || adminTargets.length === 0) {
          const usersSnap = await db.collection('users').where('role', '==', 'admin').get();
          adminTargets = usersSnap.docs.map(d => d.data()?.lineId).filter(Boolean);
        }
        const flex = vehicleReturnedAdmin(booking);
        for (const t of adminTargets) messagesToSend.push({ to: t, payload: flex, computedUri: extractUriFromFlex(flex) || '' });
      }
      if (shouldNotify('employee', 'vehicle_returned') && booking.requesterLineId) {
        const flex = vehicleReturnedEmployee(booking);
        messagesToSend.push({ to: booking.requesterLineId, payload: flex, computedUri: extractUriFromFlex(flex) || '' });
      }
    }

    // send all messages sequentially (could be parallel)
    const results = [];
    for (const m of messagesToSend) {
      try {
        console.log('Sending LINE message', { to: m.to, computedUri: m.computedUri || '' });
        const r = await pushLineMessage(m.to, m.payload || m.text || m);
        results.push({ to: m.to, ok: !!r.ok, info: r, computedUri: m.computedUri || '' });
      } catch (err) {
        console.error('Failed to send LINE message', err, m);
        results.push({ to: m.to, ok: false, error: String(err), computedUri: m.computedUri || '' });
      }
    }

    const sentCount = results.filter(x => x.ok).length;
    return NextResponse.json({ ok: true, sent: sentCount, results });
  } catch (err) {
    console.error('POST /api/notifications/send error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

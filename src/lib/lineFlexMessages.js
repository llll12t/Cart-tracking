// src/lib/lineFlexMessages.js

function fmtDate(d) {
  if (!d && d !== 0) return '-';
  try {
    let dt;
    // Firestore Timestamp-like object with toDate()
    if (d && typeof d.toDate === 'function') {
      dt = d.toDate();
      // Firestore plain object with seconds/nanoseconds
    } else if (d && typeof d.seconds === 'number') {
      const ms = (d.seconds * 1000) + Math.floor((d.nanoseconds || 0) / 1e6);
      dt = new Date(ms);
      // numeric timestamp (seconds or milliseconds) or ISO string
    } else if (typeof d === 'number') {
      // Heuristic: if it's seconds (10 digits), convert to ms
      dt = d > 1e12 ? new Date(d) : new Date(d * 1000);
    } else {
      dt = new Date(d);
    }

    if (isNaN(dt.getTime())) return String(d);
    // Show date and time (Thai format)
    return dt.toLocaleString('th-TH', { 
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch (e) {
    return String(d);
  }
}

function baseBubble(title, fields = [], footerText = '', actions = []) {
  const bubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [{ type: 'text', text: title, weight: 'bold', size: 'lg', color: '#0f766e' }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: fields.map(f => ({ type: 'text', text: f, wrap: true, size: 'sm', color: '#263238' }))
    }
  };

  if (footerText) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [{ type: 'text', text: footerText, size: 'xs', color: '#9ca3af' }]
    };
  }

  if (actions && actions.length > 0) {
    bubble.footer = bubble.footer || { type: 'box', layout: 'vertical', contents: [] };
    const buttons = actions.map(action => ({
      type: 'button',
      action: { type: 'uri', label: action.label, uri: action.uri },
      style: action.style || 'primary',
      color: action.color,
      height: 'sm'
    }));
    bubble.footer.contents.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: buttons
    });
  }

  return bubble;
}


// แจ้งเตือน "ยืมรถ" (จองรถใหม่)
export function bookingCreatedFlex(booking) {
  const title = 'มีการขอยืมรถ';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)}`
  ];
  return { altText: `ขอยืมรถ ${booking.vehicleLicensePlate || ''}`, contents: baseBubble(title, fields) };
}

// แจ้งเตือน "ส่งรถ" (รถถูกส่งให้ผู้ขอ)
export function vehicleSentFlex(booking) {
  const title = 'รถถูกส่งให้ผู้ขอแล้ว';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `ส่งเมื่อ: ${fmtDate(booking.sentAt || booking.startDateTime || booking.startCalendarDate || Date.now())}`
  ];
  return { altText: `รถ ${booking.vehicleLicensePlate || ''} ถูกส่งแล้ว`, contents: baseBubble(title, fields) };
}

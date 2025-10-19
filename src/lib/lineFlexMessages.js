// Utility functions that build LINE Flex message payloads (bubble contents)

function fmtDate(d) {
  try {
    const dt = new Date(d);
    return dt.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return String(d);
  }
}

function baseBubble(title, fields = [], footerText = '', actions = null) {
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

  if (actions && actions.uri) {
    // add action button area
    bubble.footer = bubble.footer || { type: 'box', layout: 'vertical', contents: [] };
    bubble.footer.contents.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: actions.label || 'ยืนยัน', uri: actions.uri },
          style: 'primary',
          color: '#0f766e'
        }
      ]
    });
  }

  return bubble;
}

function buildConfirmUri(base, bookingId) {
  if (!base || !bookingId) return '';
  const b = base.replace(/\/$/, '');
  // if base already includes the confirm path, just append the id
  if (b.includes('/confirm/booking')) {
    return `${b.replace(/\/$/, '')}/${bookingId}`;
  }
  return `${b}/confirm/booking/${bookingId}`;
}

export function bookingCreatedAdmin(booking) {
  const title = 'คำขอจองรถใหม่';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'} (${booking.userEmail || '-'})`,
    `รถ: ${booking.vehicleLicensePlate || (booking.vehicleLicensePlate) || '-'}`,
    `วันที่: ${fmtDate(booking.startDate)} → ${fmtDate(booking.endDate)}`
  ];
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || '';
  const confirmLiffId = process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID || '';
  const bookingId = booking.id || booking.bookingId || booking._id || '';
  let uri = base ? buildConfirmUri(base, bookingId) : '';
  // fallback to LIFF deep link (https) if base URL not configured but LIFF id is available
  if (!uri && confirmLiffId && bookingId) uri = `https://liff.line.me/${confirmLiffId}?bookingId=${bookingId}`;
  const actions = uri && /^https?:\/\//i.test(uri) ? { uri, label: 'ยืนยัน' } : null;
  return { altText: `คำขอจองรถจาก ${booking.requesterName || ''}`, contents: baseBubble(title, fields, '', actions) };
}

export function bookingCreatedEmployee(booking) {
  const title = 'ส่งคำขอจองรถเรียบร้อย';
  const fields = [
    `สำหรับ: ${booking.vehicleLicensePlate || '-'}`,
    `วันที่: ${fmtDate(booking.startDate)} → ${fmtDate(booking.endDate)}`
  ];
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || '';
  const confirmLiffId = process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID || '';
  const bookingId = booking.id || booking.bookingId || booking._id || '';
  let uri = base ? buildConfirmUri(base, bookingId) : '';
  if (!uri && confirmLiffId && bookingId) uri = `https://liff.line.me/${confirmLiffId}?bookingId=${bookingId}`;
  const actions = uri && /^https?:\/\//i.test(uri) ? { uri, label: 'ดูคำขอ / ยืนยัน' } : null;
  return { altText: 'คำขอจองของคุณถูกส่งแล้ว', contents: baseBubble(title, fields, '', actions) };
}

export function bookingApprovedDriver(booking) {
  const title = 'การจองได้รับการอนุมัติ';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `วันที่: ${fmtDate(booking.startDate)} → ${fmtDate(booking.endDate)}`
  ];
  return { altText: 'การจองได้รับการอนุมัติ', contents: baseBubble(title, fields) };
}

export function vehicleSentDriver(booking) {
  const title = 'กรุณาส่งรถให้ผู้ขอ';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`
  ];
  return { altText: 'โปรดส่งรถ', contents: baseBubble(title, fields) };
}

export function vehicleReturnedAdmin(booking) {
  const title = 'รถได้ถูกคืนแล้ว';
  const fields = [
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `คืนโดย: ${booking.requesterName || '-'}`
  ];
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || '';
  const confirmLiffId = process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID || '';
  const bookingId = booking.id || booking.bookingId || booking._id || '';
  let uri = base ? buildConfirmUri(base, bookingId) : '';
  if (!uri && confirmLiffId && bookingId) uri = `https://liff.line.me/${confirmLiffId}?bookingId=${bookingId}`;
  const actions = uri && /^https?:\/\//i.test(uri) ? { uri, label: 'ยืนยันการคืน' } : null;
  return { altText: 'รถถูกคืนแล้ว', contents: baseBubble(title, fields, '', actions) };
}

export function vehicleReturnedEmployee(booking) {
  const title = 'การคืนรถของคุณถูกบันทึก';
  const fields = [
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `วันที่คืน: ${fmtDate(booking.returnedAt || new Date())}`
  ];
  return { altText: 'คืนรถเรียบร้อย', contents: baseBubble(title, fields) };
}

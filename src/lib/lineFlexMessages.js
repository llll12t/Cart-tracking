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

export function bookingCreatedAdmin(booking) {
  const title = 'คำขอจองรถใหม่';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
  // Show only the usage start date (no end date)
  `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)}`
  ];
  const confirmLiffId = process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID || '';
  const bookingId = booking.id || booking.bookingId || booking._id || '';

  // ปุ่มเดียว: ยืนยันการจอง (ลิงก์ไปหน้ารายละเอียดจอง)
  const actions = [];
  if (confirmLiffId && bookingId) {
    // Use liff.state to open the LIFF app and navigate to the confirm page for the booking
    const detailUri = `https://liff.line.me/${process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID}?liff.state=/confirm/${bookingId}`;

    actions.push({ uri: detailUri, label: 'ยืนยันการจอง', style: 'primary', color: '#06574d' });
  }

  return { altText: `คำขอจองรถจาก ${booking.requesterName || ''}`, contents: baseBubble(title, fields, '', actions) };
}

export function bookingApprovalRequestAdmin(booking) {
  const title = 'คำขออนุมัติการจองรถ';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
  `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)}`
  ];
  const bookingId = booking.id || booking.bookingId || booking._id || '';
  const confirmLiffId = process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID || '';
  const actions = [];
  if (confirmLiffId && bookingId) {
    // Use liff.state so LIFF opens and navigates to the confirm page with bookingId
    const detailUri = `https://liff.line.me/${process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID}?liff.state=/confirm/${bookingId}`;
    actions.push({ uri: detailUri, label: 'ตรวจสอบและอนุมัติ', style: 'primary', color: '#06574d' });
  }
  return { altText: `ขออนุมัติการจองจาก ${booking.requesterName || ''}`, contents: baseBubble(title, fields, '', actions) };
}

export function bookingApprovedAdmin(booking) {
  const title = 'การจองได้รับการอนุมัติ';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
  `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)}`
  ];
  return { altText: `การจอง ${booking.id || ''} ได้รับการอนุมัติ`, contents: baseBubble(title, fields) };
}

export function vehicleSentAdmin(booking) {
  const title = 'รถถูกส่งให้ผู้ขอแล้ว';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    // sentAt preferred, otherwise use startDateTime or calendar date
    `ส่งเมื่อ: ${fmtDate(booking.sentAt || booking.startDateTime || booking.startCalendarDate || Date.now())}`
  ];
  return { altText: `รถ ${booking.vehicleLicensePlate || ''} ถูกส่งแล้ว`, contents: baseBubble(title, fields) };
}

export function vehicleReturnedAdmin(booking) {
  const title = 'รถได้ถูกคืนแล้ว';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `คืนเมื่อ: ${fmtDate(booking.returnedAt || booking.endDateTime || booking.endCalendarDate || Date.now())}`,
    booking.startMileage ? `เริ่มต้น (km): ${booking.startMileage}` : null,
    booking.endMileage ? `สิ้นสุด (km): ${booking.endMileage}` : null,
    typeof booking.totalExpenses === 'number' ? `รวมค่าใช้จ่าย: ${booking.totalExpenses} บาท` : null
  ].filter(Boolean);
  return { altText: `รถ ${booking.vehicleLicensePlate || ''} ถูกคืนแล้ว`, contents: baseBubble(title, fields) };
}

// Driver-focused messages
export function bookingCreatedDriver(booking) {
  const title = 'มีการจองรอรับผิดชอบ';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
  `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)}`
  ];
  return { altText: `ขอจองรถ ${booking.id || ''}`, contents: baseBubble(title, fields) };
}

export function bookingApprovedDriver(booking) {
  const title = 'คำขอของคุณได้รับการอนุมัติ';
  const fields = [
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
  `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)}`
  ];
  return { altText: `การจองของคุณได้รับการอนุมัติ`, contents: baseBubble(title, fields) };
}

export function vehicleSentDriver(booking) {
  const title = 'รถถูกส่งให้แล้ว';
  const fields = [
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `ส่งเมื่อ: ${fmtDate(booking.sentAt || booking.startDateTime || booking.startCalendarDate || Date.now())}`
  ];
  return { altText: `รถ ${booking.vehicleLicensePlate || ''} ถูกส่งแล้ว`, contents: baseBubble(title, fields) };
}

export function vehicleReturnedDriver(booking) {
  const title = 'รถได้รับการคืนเรียบร้อย';
  const fields = [
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `คืนเมื่อ: ${fmtDate(booking.returnedAt || booking.endDateTime || booking.endCalendarDate || Date.now())}`,
    booking.startMileage ? `เริ่มต้น (km): ${booking.startMileage}` : null,
    booking.endMileage ? `สิ้นสุด (km): ${booking.endMileage}` : null,
    typeof booking.totalExpenses === 'number' ? `รวมค่าใช้จ่าย: ${booking.totalExpenses} บาท` : null
  ].filter(Boolean);
  return { altText: `รถ ${booking.vehicleLicensePlate || ''} ถูกคืนแล้ว`, contents: baseBubble(title, fields) };
}

// Employee messages (simpler)
export function bookingCreatedEmployee(booking) {
  const title = 'มีการขอจองรถ';
  const fields = [
    `ผู้ขอ: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)} → ${fmtDate(booking.endDateTime || booking.endCalendarDate || booking.endDate)}`
  ];
  return { altText: `มีการขอจองรถจาก ${booking.requesterName || ''}`, contents: baseBubble(title, fields) };
}

export function bookingRejectedAdmin(booking) {
  const title = 'คำขอถูกปฏิเสธ';
  const fields = [
    `คำขอโดย: ${booking.requesterName || '-'}`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)} → ${fmtDate(booking.endDateTime || booking.endCalendarDate || booking.endDate)}`
  ];
  return { altText: `คำขอ ${booking.id || ''} ถูกปฏิเสธ`, contents: baseBubble(title, fields) };
}

export function bookingRejectedDriver(booking) {
  const title = 'คำขอของคุณถูกปฏิเสธ';
  const fields = [
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `วันที่: ${fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate)} → ${fmtDate(booking.endDateTime || booking.endCalendarDate || booking.endDate)}`
  ];
  return { altText: `คำขอของคุณถูกปฏิเสธ`, contents: baseBubble(title, fields) };
}

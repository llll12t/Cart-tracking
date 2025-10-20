// src/lib/lineFlexMessages.js

function fmtDate(d) {
  try {
    const dt = new Date(d);
    return dt.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
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
    `ผู้ขอ: ${booking.requesterName || '-'} (${booking.userEmail || '-'})`,
    `รถ: ${booking.vehicleLicensePlate || '-'}`,
    `วันที่: ${fmtDate(booking.startDate)} → ${fmtDate(booking.endDate)}`
  ];
  const confirmLiffId = process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID || '';
  const bookingId = booking.id || booking.bookingId || booking._id || '';

  // ปุ่มเดียว: ยืนยันการจอง (ลิงก์ไปหน้ารายละเอียดจอง)
  const actions = [];
  if (confirmLiffId && bookingId) {
    const detailUri = `https://liff.line.me/${confirmLiffId}?bookingId=${encodeURIComponent(bookingId)}`;
    actions.push({ uri: detailUri, label: 'ยืนยันการจอง', style: 'primary', color: '#0ea5e9' });
  }

  return { altText: `คำขอจองรถจาก ${booking.requesterName || ''}`, contents: baseBubble(title, fields, '', actions) };
}

// ... other functions
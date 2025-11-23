// src/lib/lineFlexMessages.js

function fmtDate(d) {
  if (!d && d !== 0) return '-';
  try {
    let dt;
    // Firestore Timestamp-like object with toDate()
    if (d && typeof d.toDate === 'function') {
      dt = d.toDate();
    } 
    // Firestore plain object with seconds/nanoseconds
    else if (d && typeof d.seconds === 'number') {
      const ms = (d.seconds * 1000) + Math.floor((d.nanoseconds || 0) / 1e6);
      dt = new Date(ms);
    } 
    // numeric timestamp or ISO string
    else if (typeof d === 'number') {
      dt = d > 1e12 ? new Date(d) : new Date(d * 1000);
    } else {
      dt = new Date(d);
    }

    if (isNaN(dt.getTime())) return String(d);
    
    // [FIX] ระบุ timeZone เป็น Asia/Bangkok เพื่อให้เวลาตรงกับไทย (UTC+7)
    return dt.toLocaleString('th-TH', { 
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch (e) {
    return String(d);
  }
}

// Helper สร้างแถวข้อมูล (Label : Value) ให้ดูสวยงามเป็นระเบียบ
function createRow(label, value) {
  return {
    type: 'box',
    layout: 'baseline',
    margin: 'md',
    contents: [
      {
        type: 'text',
        text: label,
        color: '#8C8C8C',
        size: 'xs',
        flex: 2
      },
      {
        type: 'text',
        text: value || '-',
        color: '#111111',
        size: 'sm',
        flex: 4,
        wrap: true
      }
    ]
  };
}

// Main Bubble Structure ที่สวยงามขึ้น (Clean Design)
function createBubble(title, rows = [], highlightColor = '#06C755') {
  return {
    type: 'bubble',
    size: 'mega', // [FIX] ลดขนาดจาก giga เป็น mega
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'xl',
      contents: [
        {
          type: 'text',
          text: title,
          weight: 'bold',
          size: 'lg', // [FIX] ลดขนาด Title จาก xl เป็น lg
          color: highlightColor,
          wrap: true
        },
        {
          type: 'separator',
          margin: 'lg',
          color: '#F0F0F0'
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          contents: rows
        }
      ]
    },
    styles: {
      footer: {
        separator: true
      }
    }
  };
}

// 1. แจ้งเตือน "ยืมรถ" (จองรถใหม่)
export function bookingCreatedFlex(booking) {
  const rows = [
    createRow('ผู้ขอ', booking.requesterName),
    createRow('รถ', booking.vehicleLicensePlate),
    createRow('วันที่ใช้', fmtDate(booking.startDateTime || booking.startCalendarDate || booking.startDate))
  ];
  return { 
    altText: 'มีการขอยืมรถใหม่', 
    contents: createBubble('มีการขอยืมรถ', rows, '#00B900') 
  };
}

// 2. แจ้งเตือน "ส่งรถ" (รถถูกส่งให้ผู้ขอ)
export function vehicleSentFlex(booking) {
  const rows = [
    createRow('ผู้ขอ', booking.requesterName),
    createRow('รถ', booking.vehicleLicensePlate),
    createRow('ส่งเมื่อ', fmtDate(booking.sentAt || Date.now()))
  ];
  return { 
    altText: 'รถถูกส่งให้ผู้ขอแล้ว', 
    contents: createBubble('รถถูกส่งแล้ว', rows, '#10b981') 
  };
}

// 3. แจ้งเตือน "เริ่มใช้งาน" (คนขับกดเริ่มงาน)
export function vehicleBorrowedFlex(usage) {
  const userName = usage.userName || usage.requesterName || '-';
  const rows = [
    createRow('ผู้ยืม', userName),
    createRow('รถ', usage.vehicleLicensePlate),
    createRow('เริ่มใช้', fmtDate(usage.startTime || Date.now())),
    createRow('จุดหมาย', usage.destination),
    createRow('วัตถุประสงค์', usage.purpose)
  ];
  return { 
    altText: 'เริ่มการใช้งานรถ', 
    contents: createBubble('เริ่มการใช้งาน', rows, '#06C755') // [FIX] เปลี่ยนเป็นสีเขียว (LINE Green)
  };
}

// 4. แจ้งเตือน "คืนรถ" (ส่งคืนรถแล้ว)
export function vehicleReturnedFlex(usage) {
  const userName = usage.userName || usage.requesterName || '-';
  const rows = [
    createRow('ผู้ยืม', userName),
    createRow('รถ', usage.vehicleLicensePlate),
    createRow('คืนเมื่อ', fmtDate(usage.endTime || Date.now()))
  ];

  if (usage.totalDistance !== null && usage.totalDistance !== undefined) {
    rows.push(createRow('ระยะทาง', `${usage.totalDistance} กม.`));
  }
  
  // แสดงค่าใช้จ่ายรวมแบบไม่มี Emoji
  if (usage.totalExpenses !== null && usage.totalExpenses !== undefined && usage.totalExpenses > 0) {
    rows.push(createRow('ค่าใช้จ่ายรวม', `${usage.totalExpenses.toLocaleString()} บาท`));
  }

  return { 
    altText: 'มีการคืนรถแล้ว', 
    contents: createBubble('คืนรถเรียบร้อย', rows, '#06C755') // [FIX] เปลี่ยนเป็นสีเขียว (LINE Green)
  };
}

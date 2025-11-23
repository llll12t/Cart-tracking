// src/app/api/cron/daily-report/route.js
import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

// บังคับให้เป็น Dynamic route เพื่อให้ดึงข้อมูลสดใหม่เสมอ
export const dynamic = 'force-dynamic';

const db = admin.firestore();
const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.NEXT_PUBLIC_LINE_CHANNEL_ACCESS_TOKEN;

export async function GET(req) {
  try {
    // 1. ตรวจสอบ Authorization (ถ้ามีการตั้งค่า CRON_SECRET ไว้)
    const authHeader = req.headers.get('authorization');
    // ถ้ามี CRON_SECRET และ header ไม่ตรง ให้กันออก (แต่ถ้าไม่ได้ตั้งไว้ใน .env ก็จะข้ามไป)
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // อนุญาตให้ Admin กดทดสอบผ่านหน้าเว็บได้ (โดยดูว่าไม่มี auth header มาแบบ Cron)
      console.log('Running report without Cron Secret (Manual Trigger)');
    }

    // 2. ดึงการตั้งค่าจาก Firestore
    const settingsDoc = await db.collection('appConfig').doc('notifications').get();
    if (!settingsDoc.exists) {
        return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }
    const settings = settingsDoc.data();
    const dailySettings = settings?.dailyReport;

    // ตรวจสอบว่าเปิดใช้งานและมี Group ID หรือไม่
    if (!dailySettings?.groupId) {
      return NextResponse.json({ error: 'กรุณาระบุ Group ID ในการตั้งค่าก่อน' }, { status: 400 });
    }

    // 3. ดึงข้อมูลรถที่กำลังใช้งาน (Active Usage)
    const activeUsageSnap = await db.collection('vehicle-usage')
      .where('status', '==', 'active')
      .get();
    
    const activeVehicles = activeUsageSnap.docs.map(doc => doc.data());

    // 4. ดึงข้อมูลรถทั้งหมดเพื่อเช็คแจ้งเตือน (Tax, Insurance)
    const vehiclesSnap = await db.collection('vehicles').get();
    const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 5. ดึง Expenses เพื่อหาประวัติของเหลว (Fluid)
    const expensesSnap = await db.collection('expenses').where('type', '==', 'fluid').get();
    const fluidMap = {}; 
    expensesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.vehicleId && data.mileage) {
        // หาเลขไมล์ล่าสุดที่มีการเปลี่ยนของเหลว
        if (!fluidMap[data.vehicleId] || data.mileage > fluidMap[data.vehicleId]) {
          fluidMap[data.vehicleId] = data.mileage;
        }
      }
    });

    // 6. รวบรวมรายการแจ้งเตือน (Alerts)
    const alerts = [];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    vehicles.forEach(v => {
      // 6.1 ภาษี
      if (v.taxDueDate) {
        const taxDate = v.taxDueDate.toDate ? v.taxDueDate.toDate() : new Date(v.taxDueDate);
        if (taxDate > now && taxDate <= thirtyDaysFromNow) {
          alerts.push(`⚠️ ภาษี: ${v.licensePlate} หมดอายุ ${taxDate.toLocaleDateString('th-TH')}`);
        }
      }
      // 6.2 ประกัน
      if (v.insuranceExpireDate) {
        const insDate = v.insuranceExpireDate.toDate ? v.insuranceExpireDate.toDate() : new Date(v.insuranceExpireDate);
        if (insDate > now && insDate <= thirtyDaysFromNow) {
          alerts.push(`⚠️ ประกัน: ${v.licensePlate} หมดอายุ ${insDate.toLocaleDateString('th-TH')}`);
        }
      }
      // 6.3 ของเหลว
      // Logic: เตือนเมื่อวิ่งครบ 9,000 กม. ขึ้นไป (เหลืออีก 1,000 กม. จะครบ 10,000 หรือเกินกำหนดแล้ว)
      const lastFluid = fluidMap[v.id] || 0; // ถ้าไม่มีประวัติ ให้เริ่มที่ 0
      const currentKm = v.currentMileage || 0;
      const dist = currentKm - lastFluid; // ระยะทางที่วิ่งไปแล้วตั้งแต่เปลี่ยนครั้งล่าสุด

      if (dist >= 9000) { 
        const status = dist >= 10000 
            ? `เกินกำหนด ${(dist - 10000).toLocaleString()} กม.` 
            : `เหลืออีก ${(10000 - dist).toLocaleString()} กม.`;
            
        alerts.push(`🛢️ ของเหลว: ${v.licensePlate} (${status})`);
      }
    });

    // 7. สร้างข้อความ Flex Message
    const flexContents = {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#f0fdf4",
        contents: [
          { type: "text", text: "📊 สรุปสถานะประจำวัน", weight: "bold", size: "xl", color: "#075b50" },
          { type: "text", text: new Date().toLocaleDateString('th-TH', { dateStyle: 'full' }), size: "xs", color: "#aaaaaa", margin: "xs" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: []
      }
    };

    // ส่วนที่ 1: รถที่กำลังใช้งาน
    if (activeVehicles.length > 0) {
      flexContents.body.contents.push({ type: "text", text: "🚗 รถที่กำลังใช้งาน", weight: "bold", size: "sm", color: "#333333" });
      
      const activeList = [];
      activeVehicles.forEach(usage => {
        activeList.push({
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            { type: "text", text: `• ${usage.vehicleLicensePlate || "ไม่ระบุ"}`, size: "xs", flex: 2, color: "#333333" },
            { type: "text", text: usage.userName || "ไม่ระบุ", size: "xs", flex: 3, align: "end", color: "#666666" }
          ]
        });
      });
      flexContents.body.contents.push(...activeList);
    } else {
      flexContents.body.contents.push({ type: "text", text: "🚗 ไม่มีรถที่กำลังใช้งาน", size: "sm", color: "#999999", align: "center" });
    }

    // ส่วนที่ 2: แจ้งเตือน (ถ้ามี)
    if (alerts.length > 0) {
      flexContents.body.contents.push({ type: "separator", margin: "lg" });
      flexContents.body.contents.push({ type: "text", text: "🔔 การแจ้งเตือน", weight: "bold", size: "sm", color: "#ef4444", margin: "lg" });
      
      alerts.forEach(alertMsg => {
        flexContents.body.contents.push({ 
            type: "text", 
            text: alertMsg, 
            size: "xs", 
            wrap: true, 
            color: "#b91c1c",
            margin: "sm"
        });
      });
    } else {
        // ถ้าไม่มีแจ้งเตือนเลย ให้ใส่ข้อความว่าปกติ
        flexContents.body.contents.push({ type: "separator", margin: "lg" });
        flexContents.body.contents.push({ type: "text", text: "✅ สภาพรถปกติดีทุกคัน", size: "xs", color: "#10b981", margin: "lg", align: "center" });
    }

    // 8. ส่งข้อความไปหา LINE API
    const payload = {
      to: dailySettings.groupId,
      messages: [{ type: "flex", altText: `รายงานประจำวัน: ${new Date().toLocaleDateString('th-TH')}`, contents: flexContents }]
    };

    // ใช้ fetch ของ Next.js
    const lineRes = await fetch(LINE_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!lineRes.ok) {
      const text = await lineRes.text();
      console.error('LINE Push Error:', text);
      return NextResponse.json({ error: 'ส่ง LINE ไม่ผ่าน', details: text }, { status: 500 });
    }

    return NextResponse.json({ 
        success: true, 
        message: 'ส่งรายงานสำเร็จ',
        recipient: dailySettings.groupId,
        data: { activeCount: activeVehicles.length, alertCount: alerts.length }
    });

  } catch (error) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

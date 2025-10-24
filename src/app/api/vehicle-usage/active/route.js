// API: ดึงข้อมูลรถที่กำลังใช้งานของ user
import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ userId' },
        { status: 400 }
      );
    }

    // Query active vehicle usage for this user
    const usageSnapshot = await admin.firestore()
      .collection('vehicle-usage')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    console.log('[DEBUG] Active vehicle query:', { userId, foundDocs: usageSnapshot.size });

    if (usageSnapshot.empty) {
      console.log('[DEBUG] No active vehicle found for user:', userId);
      return NextResponse.json({
        success: true,
        usage: null,
        message: 'ไม่มีรถที่กำลังใช้งาน',
      });
    }

    const usageDoc = usageSnapshot.docs[0];
    const usageData = { id: usageDoc.id, ...usageDoc.data() };
    console.log('[DEBUG] Found active vehicle:', usageData.id, usageData.vehicleLicensePlate);

    // Convert Firestore timestamps to ISO strings
    if (usageData.startTime?.toDate) {
      usageData.startTime = usageData.startTime.toDate().toISOString();
    }
    if (usageData.createdAt?.toDate) {
      usageData.createdAt = usageData.createdAt.toDate().toISOString();
    }
    if (usageData.updatedAt?.toDate) {
      usageData.updatedAt = usageData.updatedAt.toDate().toISOString();
    }

    return NextResponse.json({
      success: true,
      usage: usageData,
    });
  } catch (error) {
    console.error('[ERROR] Error fetching active vehicle usage:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล', details: error.message },
      { status: 500 }
    );
  }
}

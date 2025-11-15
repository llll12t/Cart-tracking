// API: ส่งคืนรถ
import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import { sendNotificationsForEvent } from '@/lib/notifications';

export async function POST(request) {
  try {
    const body = await request.json();
  const { usageId, endMileage } = body;

    // Validate required fields
    if (!usageId) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อมูลให้ครบถ้วน: usageId' },
        { status: 400 }
      );
    }

    // Get usage record
    const usageRef = admin.firestore().collection('vehicle-usage').doc(usageId);
    const usageDoc = await usageRef.get();

    if (!usageDoc.exists) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลการใช้งานรถ' }, { status: 404 });
    }

    const usageData = usageDoc.data();

    if (usageData.status !== 'active') {
      return NextResponse.json(
        { error: 'การใช้งานรถนี้ได้จบไปแล้ว' },
        { status: 400 }
      );
    }

    let updateUsageData = {
      endTime: new Date(),
      status: 'completed',
      updatedAt: new Date(),
    };
    let updateVehicleData = {
      status: 'available',
      currentUserId: null,
      currentUsageId: null,
      updatedAt: new Date(),
    };
    let totalDistance = null;
    if (endMileage !== undefined && endMileage !== null && endMileage !== "") {
      const endMileageNum = Number(endMileage);
      if (usageData.startMileage !== undefined && endMileageNum < usageData.startMileage) {
        return NextResponse.json(
          { error: 'เลขไมล์สิ้นสุดต้องมากกว่าหรือเท่ากับเลขไมล์เริ่มต้น' },
          { status: 400 }
        );
      }
      totalDistance = usageData.startMileage !== undefined ? endMileageNum - usageData.startMileage : null;
      updateUsageData.endMileage = endMileageNum;
      updateUsageData.totalDistance = totalDistance;
      updateVehicleData.currentMileage = endMileageNum;
    }
    await usageRef.update(updateUsageData);
    const vehicleRef = admin.firestore().collection('vehicles').doc(usageData.vehicleId);
    await vehicleRef.update(updateVehicleData);

    // Fetch expenses for this usage to include in notification
    let totalExpenses = 0;
    let expenses = [];
    try {
      const expensesSnap = await admin.firestore()
        .collection('expenses')
        .where('usageId', '==', usageId)
        .get();
      
      expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
      console.log('Expenses for notification:', { count: expenses.length, totalExpenses });
    } catch (expErr) {
      console.error('Failed to fetch expenses for notification:', expErr);
    }

    // Send notification for vehicle returned
    try {
      const notificationData = {
        id: usageId,
        userId: usageData.userId,
        userName: usageData.userName || 'ไม่ระบุชื่อ',
        vehicleId: usageData.vehicleId,
        vehicleLicensePlate: usageData.vehicleLicensePlate,
        startTime: usageData.startTime,
        endTime: updateUsageData.endTime,
        totalDistance: totalDistance,
        totalExpenses: totalExpenses,
        expenses: expenses
      };
      console.log('Sending notification with data:', notificationData);
      await sendNotificationsForEvent('vehicle_returned', notificationData);
    } catch (notifErr) {
      console.error('Failed to send vehicle returned notifications:', notifErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งคืนรถสำเร็จ',
      totalDistance,
    });
  } catch (error) {
    console.error('Error returning vehicle:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการส่งคืนรถ' },
      { status: 500 }
    );
  }
}

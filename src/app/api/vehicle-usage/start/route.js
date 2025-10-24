// API: เริ่มใช้งานรถ
import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const body = await request.json();
  const { userId, userName, vehicleId, vehicleLicensePlate, startMileage, destination, purpose } = body;

    // Validate required fields
    if (!userId || !vehicleId) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อมูลให้ครบถ้วน: userId, vehicleId' },
        { status: 400 }
      );
    }

    // Check if vehicle is available
  const vehicleRef = admin.firestore().collection('vehicles').doc(vehicleId);
  const vehicleDoc = await vehicleRef.get();
    
    if (!vehicleDoc.exists) {
      return NextResponse.json({ error: 'ไม่พบรถคันนี้ในระบบ' }, { status: 404 });
    }

    const vehicleData = vehicleDoc.data();
    if (vehicleData.status !== 'available') {
      return NextResponse.json(
        { error: 'รถคันนี้ไม่พร้อมใช้งาน' },
        { status: 400 }
      );
    }

    // Create vehicle-usage record
    const usageData = {
      vehicleId,
      vehicleLicensePlate: vehicleLicensePlate || vehicleData.licensePlate,
      userId,
      userName: userName || 'ไม่ระบุชื่อ',
      startTime: new Date(),
      endTime: null,
      startMileage: startMileage !== undefined ? Number(startMileage) : null,
      endMileage: null,
      destination: destination || '',
      purpose: purpose || '',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

  const usageRef = await admin.firestore().collection('vehicle-usage').add(usageData);

    // Update vehicle status to 'in-use'
    const updateData = {
      status: 'in-use',
      currentUserId: userId,
      currentUsageId: usageRef.id,
      updatedAt: new Date(),
    };
    if (startMileage !== undefined) {
      updateData.currentMileage = Number(startMileage);
    }
    await vehicleRef.update(updateData);

    return NextResponse.json({
      success: true,
      usageId: usageRef.id,
      message: 'เริ่มใช้งานรถสำเร็จ',
    });
  } catch (error) {
    console.error('Error starting vehicle usage:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเริ่มใช้งานรถ' },
      { status: 500 }
    );
  }
}

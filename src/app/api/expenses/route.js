// DELETE: ลบค่าใช้จ่าย
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing expense id' }, { status: 400 });
    }
    await admin.firestore().collection('expenses').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// API: จัดการค่าใช้จ่าย (บันทึก, ดึงข้อมูล)
import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

// POST: สร้างรายการค่าใช้จ่าย
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      usageId, 
      vehicleId, 
      userId, 
      type, 
      amount, 
      mileage, 
      note, 
      receiptUrl 
    } = body;

    // Validate required fields
    if (!usageId || !vehicleId || !userId || !type || !amount) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อมูลให้ครบถ้วน: usageId, vehicleId, userId, type, amount' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['fuel', 'fluid', 'other'].includes(type)) {
      return NextResponse.json(
        { error: 'ประเภทค่าใช้จ่ายไม่ถูกต้อง (fuel, fluid หรือ other)' },
        { status: 400 }
      );
    }

    // Create expense record
    const expenseData = {
      usageId,
      vehicleId,
      userId,
      type,
      amount: Number(amount),
      mileage: mileage ? Number(mileage) : null,
      note: note || '',
      receiptUrl: receiptUrl || null,
      timestamp: new Date(),
      createdAt: new Date(),
    };

  const expenseRef = await admin.firestore().collection('expenses').add(expenseData);

    return NextResponse.json({
      success: true,
      expenseId: expenseRef.id,
      message: 'บันทึกค่าใช้จ่ายสำเร็จ',
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย' },
      { status: 500 }
    );
  }
}

// GET: ดึงรายการค่าใช้จ่าย
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const usageId = searchParams.get('usageId');
    const vehicleId = searchParams.get('vehicleId');
    const userId = searchParams.get('userId');

  let query = admin.firestore().collection('expenses');

    if (usageId) {
      query = query.where('usageId', '==', usageId);
    } else if (vehicleId) {
      query = query.where('vehicleId', '==', vehicleId);
    } else if (userId) {
      query = query.where('userId', '==', userId);
    }

    query = query.orderBy('timestamp', 'desc');

    const snapshot = await query.get();
    const expenses = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore timestamps
      if (data.timestamp?.toDate) {
        data.timestamp = data.timestamp.toDate().toISOString();
      }
      if (data.createdAt?.toDate) {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      expenses.push({ id: doc.id, ...data });
    });

    return NextResponse.json({
      success: true,
      expenses,
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลค่าใช้จ่าย' },
      { status: 500 }
    );
  }
}

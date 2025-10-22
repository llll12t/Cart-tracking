import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold text-teal-700 mb-4">404</h1>
      <p className="text-lg text-gray-600 mb-2">ไม่พบหน้าที่คุณต้องการ</p>
      <p className="text-sm text-gray-500">กรุณาตรวจสอบ URL หรือกลับไปหน้าแรก</p>
      <Link href="/" className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700">
        กลับหน้าแรก
      </Link>
    </div>
  );
}

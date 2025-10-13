// src/app/booking/page.js
import BookingForm from "@/components/booking/BookingForm";
import Link from "next/link";

export default function BookingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
       <nav className="absolute top-4 left-4">
         <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800">
           &larr; กลับหน้า Dashboard
         </Link>
       </nav>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">
        สร้างคำขอจองรถ
      </h1>
      
      <BookingForm />
    </div>
  );
}
"use client";

import BookingForm from "@/components/booking/BookingForm";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MainHeader from '@/components/main/MainHeader';

export default function BookingPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('booking');

  return (
    <div className="min-h-screen ">
      <MainHeader userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Content Area */}
      <div className="bg-gray-100 p-4 -mt-16 pb-8">
        <BookingForm />
      </div>
    </div>
  );
}
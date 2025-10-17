"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export default function MainHeader({ userProfile, activeTab, setActiveTab }) {
  const router = useRouter();

  return (
    <div className="bg-gradient-to-b from-[#075b50] to-[#002629] px-6 pt-8 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-teal-800 rounded-full flex items-center justify-center text-white font-semibold text-xl">
            {userProfile?.name?.charAt(0) || 'U'}
          </div>
          <div className="text-white">
            <p className="font-semibold text-lg">{userProfile?.name || 'นายทดสอบการ'}</p>
            <p className="text-sm text-teal-100">พนักงาน ขับ</p>
          </div>
        </div>
        <button 
          onClick={() => router.push('/booking')}
          className="px-6 py-2 bg-white text-teal-700 rounded-full font-semibold text-sm hover:bg-teal-50 transition-all"
        >
          จองรถ
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button 
          onClick={() => {
            router.push('/my-trips');
            if (typeof setActiveTab === 'function') setActiveTab('ongoing');
          }}
          className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              activeTab === 'ongoing' 
                  ? 'bg-teal-800 text-white' 
                  : 'bg-teal-500/50 text-teal-100 hover:bg-teal-500/70'
          }`}
        >
          เดินทาง
        </button>
        <button 
          onClick={() => router.push('/my-bookings')}
          className="flex-1 py-3 rounded-full font-semibold bg-teal-500/50 text-teal-100 hover:bg-teal-500/70 transition-all"
        >
          ข้อมุลการจอง
        </button>
      </div>
    </div>
  );
}

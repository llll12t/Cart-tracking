"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

export default function MainHeader({ userProfile, activeTab, setActiveTab }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!setActiveTab) return;
    if (pathname?.startsWith('/my-bookings')) {
      setActiveTab('bookings');
    } else if (pathname?.startsWith('/my-trips')) {
      setActiveTab('ongoing');
    }
  }, [pathname, setActiveTab]);

  return (
    <div className="bg-gradient-to-b from-emerald-600 to-emerald-950 px-6 pt-8 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden border">
            {userProfile?.imageUrl || userProfile?.photoURL ? (
              <Image
                src={userProfile.imageUrl || userProfile.photoURL}
                alt={userProfile?.name || 'user'}
                width={56}
                height={56}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <div className="bg-teal-800 w-full h-full flex items-center justify-center text-white font-semibold text-xl">
                {userProfile?.name?.charAt(0) || 'U'}
              </div>
            )}
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
          className={`flex-1 py-3 rounded-full font-semibold transition-all shadow-sm border-0 focus:outline-none ${
            activeTab === 'ongoing'
              ? 'bg-teal-900 text-white ring-2 ring-teal-200/20' // stronger active color
              : 'bg-teal-500/40 text-teal-100 hover:bg-teal-500/70'
          }`}
        >
          เดินทาง
        </button>
        <button
          onClick={() => {
            router.push('/my-bookings');
            if (typeof setActiveTab === 'function') setActiveTab('bookings');
          }}
          className={`flex-1 py-3 rounded-full font-semibold transition-all shadow-sm border-0 focus:outline-none ${
            activeTab === 'bookings'
              ? 'bg-teal-900 text-white ring-2 ring-teal-200/20'
              : 'bg-teal-500/40 text-teal-100 hover:bg-teal-500/70'
          }`}
        >
          ข้อมุลการจอง
        </button>
      </div>
    </div>
  );
}

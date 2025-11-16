"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

export default function MainHeader({ userProfile, activeTab, setActiveTab }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!setActiveTab) return;
    if (pathname?.startsWith('/my-vehicle')) {
      setActiveTab('vehicle');
    } else if (pathname?.startsWith('/vehicle-selection')) {
      setActiveTab('selection');
    } else if (pathname?.startsWith('/my-trips')) {
      setActiveTab('trips');
    }
  }, [pathname, setActiveTab]);

  return (
    <div className="gradient-bg px-6 pt-8 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md overflow-hidden border border-white">
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
            <p className="text-sm text-teal-100">{userProfile?.position || 'พนักงาน'}</p>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            router.push('/my-vehicle');
            if (typeof setActiveTab === 'function') setActiveTab('vehicle');
          }}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all shadow-sm border-0 focus:outline-none ${
            activeTab === 'vehicle'
              ? 'bg-teal-900 text-white ring-2 ring-teal-200/20'
              : 'bg-teal-500/40 text-teal-100 hover:bg-teal-500/70'
          }`}
        >
           รถของฉัน
        </button>
        <button
          onClick={() => {
            router.push('/my-trips');
            if (typeof setActiveTab === 'function') setActiveTab('trips');
          }}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all shadow-sm border-0 focus:outline-none ${
            activeTab === 'trips'
              ? 'bg-teal-900 text-white ring-2 ring-teal-200/20'
              : 'bg-teal-500/40 text-teal-100 hover:bg-teal-500/70'
          }`}
        >
           ประวัติ
        </button>
      </div>
    </div>
  );
}

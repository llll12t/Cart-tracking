"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfirmIndex() {
  const router = useRouter();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let s = params.get('liff.state');
      if (!s) return;

      // decode repeatedly up to 3 times
      for (let i = 0; i < 3; i++) {
        try { const prev = s; s = decodeURIComponent(s); if (s === prev) break; } catch (e) { break; }
      }

      // if contains nested liff.state=, extract
      const nested = s.match(/liff\.state=([^&]+)/);
      if (nested && nested[1]) {
        try { s = decodeURIComponent(nested[1]); } catch (e) { }
      }

      // strip query part
      s = s.split('?')[0].trim();
      if (!s) return;

      // normalize to path
      if (!s.startsWith('/')) s = '/' + s;

      const segments = s.split('/').filter(Boolean);
      let target = s;
      if (segments.length === 1) {
        // assume id -> /confirm/<id>
        target = `/confirm/${segments[0]}`;
      } else if (segments[0] !== 'confirm') {
        // only allow /confirm paths
        console.warn('Ignoring liff.state outside /confirm', s);
        return;
      }

      // navigate (replace so back button is clean)
      router.replace(target);
    } catch (e) {
      console.warn('Error handling liff.state on /confirm index', e);
    }
  }, [router]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold">กำลังเปิดหน้าการยืนยัน...</h2>
      <p className="text-sm text-gray-600 mt-2">โปรดรอสักครู่ ขณะกำลังนำทางไปยังหน้ารายละเอียดการจอง</p>
    </div>
  );
}

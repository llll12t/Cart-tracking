"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from 'next/navigation';

export default function PageTransition() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname/search changes, show a short transition
  useEffect(() => {
    // start
    setLoading(true);
    setProgress(10);
    const timers = [];
    // simulate progress
    timers.push(setTimeout(() => setProgress(40), 80));
    timers.push(setTimeout(() => setProgress(65), 180));
    timers.push(setTimeout(() => setProgress(90), 320));
    // finish after small delay
    timers.push(setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 160);
    }, 420));

    return () => timers.forEach(t => clearTimeout(t));
  }, [pathname, search]);

  return (
    <div aria-hidden>
      <div className="fixed left-0 top-0 h-0.5 bg-transparent w-full pointer-events-none z-50">
        <div style={{ transform: `scaleX(${progress / 100})`, transformOrigin: 'left' }} className={`h-0.5 bg-sky-500 transition-transform duration-150`} />
      </div>

      <div className={`fixed inset-0 bg-white/60 backdrop-blur-sm transition-opacity duration-300 z-40 ${loading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
    </div>
  );
}

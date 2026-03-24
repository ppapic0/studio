'use client';

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';

export function StickyConsultCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 transition-all duration-300 sm:bottom-8 sm:left-auto sm:right-8 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <a
        href="#consult"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14295F] px-5 py-3.5 text-[13px] font-black text-white shadow-lg transition-all active:scale-95 hover:bg-[#1c3580] sm:w-auto"
      >
        <MessageSquare className="h-4 w-4" />
        상담 신청
      </a>
    </div>
  );
}

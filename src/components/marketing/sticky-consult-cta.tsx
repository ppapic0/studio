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
      className={`fixed inset-x-0 z-50 flex justify-center px-3 transition-all duration-300 sm:inset-x-auto sm:bottom-8 sm:right-8 sm:px-0 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <a
        href="#consult"
        className="flex w-full max-w-[20.5rem] items-center justify-center gap-2 rounded-[1.05rem] bg-[#14295F] px-5 py-3 text-[12.5px] font-black text-white shadow-lg transition-all active:scale-95 hover:bg-[#1c3580] sm:w-auto sm:max-w-none sm:rounded-2xl sm:px-5 sm:py-3.5 sm:text-[13px]"
      >
        <MessageSquare className="h-4 w-4" />
        상담 신청
      </a>
    </div>
  );
}

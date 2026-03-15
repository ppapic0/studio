'use client';

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';

export function AcademyFloatingCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Desktop: bottom-right floating button */}
      <div
        className={`fixed bottom-7 right-6 z-50 hidden sm:block transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <a
          href="#class-consult"
          className="flex items-center gap-2 rounded-2xl bg-[#14295F] px-5 py-3.5 text-[13px] font-black text-white shadow-lg transition-all hover:bg-[#1c3580] active:scale-95"
          style={{ boxShadow: '0 4px 16px rgba(20,41,95,0.35)' }}
        >
          <MessageSquare className="h-4 w-4" />
          수업 상담 신청
        </a>
      </div>

      {/* Mobile: fixed bottom bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 sm:hidden transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
        }`}
        style={{
          background: 'rgba(10,20,50,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex gap-2.5 px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <a
            href="#class-consult"
            className="premium-cta premium-cta-primary h-11 flex-1 text-[13.5px]"
          >
            수업 상담 신청
          </a>
          <a
            href="#class-consult"
            className="premium-cta premium-cta-ghost h-11 flex-1 text-[13.5px]"
          >
            문의 남기기
          </a>
        </div>
      </div>
    </>
  );
}

import Link from 'next/link';

import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/lib/legal-documents';

type AuthFormWrapperProps = {
  children: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
};

export function AuthFormWrapper({
  children,
  title,
  subtitle,
}: AuthFormWrapperProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,#ffe0c3_0%,#f5f8ff_42%,#edf3ff_100%)] lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-0 h-52 w-52 rounded-full bg-[#ffd2aa]/55 blur-3xl" />
        <div className="absolute bottom-10 right-[-3rem] h-56 w-56 rounded-full bg-[#9bbcff]/28 blur-3xl" />
      </div>

      <div className="relative flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="auth-panel-surface mx-auto grid w-full max-w-[430px] gap-7 rounded-[2.15rem] p-6 sm:p-8">
          <div className="grid gap-3 text-center">
            <div className="auth-rise-in parent-entry-delay-1 mb-1">{title}</div>
            {subtitle.trim() ? (
              <p className="auth-rise-in parent-entry-delay-2 text-balance text-sm font-semibold leading-6 text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="auth-rise-in parent-entry-delay-2">{children}</div>
          <div className="auth-rise-in parent-entry-delay-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-[#14295F]/8 pt-4 text-xs font-black text-[#14295F]/56">
            <Link href={TERMS_ROUTE} className="transition hover:text-[#FF7A16]">
              이용약관
            </Link>
            <Link href={PRIVACY_ROUTE} className="transition hover:text-[#FF7A16]">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-[#14295F] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(255,122,22,0.36),transparent_32%),radial-gradient(circle_at_78%_78%,rgba(255,255,255,0.18),transparent_28%)]" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80 mix-blend-screen"
          style={{ backgroundImage: "url('/login-fireworks.png')" }}
        />
        <div className="auth-rise-in parent-entry-delay-3 absolute bottom-10 left-10 right-10 rounded-[2rem] border border-white/12 bg-white/10 p-7 text-white backdrop-blur-md">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">APP EXPERIENCE</p>
          <h2 className="mt-3 text-[1.9rem] font-black leading-tight tracking-[-0.04em]">
            로그인 후
            <br />
            역할에 맞는 대시보드가 바로 이어집니다
          </h2>
          <p className="mt-4 max-w-md text-sm font-semibold leading-7 text-white/78">
            학생, 학부모, 선생님, 센터관리자 화면을 앱처럼 빠르고 안정적으로 이어서 보여줍니다.
          </p>
        </div>
      </div>
    </div>
  );
}

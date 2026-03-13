'use client';

import Link from 'next/link';
import { BarChart3, Bell, CalendarDays, CheckCircle2, ChevronLeft, CreditCard, LayoutDashboard, MessageCircle, Smartphone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

type DemoMode = 'student' | 'parent';
type StudentView = 'desktop' | 'mobile';

function SelectorLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-black transition',
        active
          ? 'bg-[#14295F] text-white shadow-[0_10px_24px_rgba(20,41,95,0.24)]'
          : 'border border-[#14295F]/15 bg-white text-[#14295F] hover:bg-[#F6F9FF]'
      )}
    >
      {label}
    </Link>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[2.4rem] border-[10px] border-[#14295F] bg-[#F7F9FE] p-3 shadow-[0_28px_80px_rgba(20,41,95,0.22)]">
      <div className="overflow-hidden rounded-[1.8rem] border border-[#14295F]/10 bg-white">{children}</div>
    </div>
  );
}

function StudentDesktopDemo() {
  return (
    <div className="rounded-[2rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_20px_50px_rgba(20,41,95,0.12)]">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[1.6rem] bg-[linear-gradient(145deg,#12295E,#1A3E8A)] p-6 text-white">
          <p className="text-xs font-black tracking-[0.2em] text-[#FFCA95]">STUDENT WEB MODE</p>
          <h2 className="font-display mt-3 text-3xl font-bold">오늘의 계획과 실행을 한 화면에서</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black text-white/70">오늘의 누적 학습</p>
              <p className="mt-2 text-2xl font-black">4시간 20분</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black text-white/70">LP 실행률</p>
              <p className="mt-2 text-2xl font-black">86%</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black text-white/70">성장 포인트</p>
              <p className="mt-2 text-2xl font-black">124 LP</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-[#14295F]/10 bg-[#F7FAFF] p-5">
            <p className="text-xs font-black tracking-[0.16em] text-[#FF7A16]">TODAY'S LP</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-white px-4 py-3 text-sm font-black text-[#14295F]">수능특강 독서 2지문</div>
              <div className="rounded-xl bg-white px-4 py-3 text-sm font-black text-[#14295F]">평가원 기출 1세트</div>
              <div className="rounded-xl bg-white px-4 py-3 text-sm font-black text-[#14295F]">오답 정리 30분</div>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-[#14295F]/10 bg-[#FFF4EB] p-5">
            <p className="text-xs font-black tracking-[0.16em] text-[#B85A00]">WEEKLY FEEDBACK</p>
            <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-[#7A4200]">
              이번 주는 독서 지문 처리 속도가 안정적입니다. 다음 주에는 문학 선지 판단 정확도를 더 끌어올립니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentMobileDemo() {
  return (
    <PhoneFrame>
      <div className="bg-[#FFFDFB]">
        <div className="flex items-center justify-between border-b border-[#14295F]/8 px-5 py-4">
          <div className="text-xs font-black text-[#14295F]/70">대시보드 &gt; 학생모드</div>
          <LayoutDashboard className="h-5 w-5 text-[#14295F]" />
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-[1.8rem] bg-[linear-gradient(145deg,#D95B11,#A63B08)] p-5 text-white">
            <p className="text-[11px] font-black tracking-[0.16em] text-white/80">TODAY TRACK</p>
            <h3 className="font-display mt-3 text-3xl font-bold leading-tight">오늘의 트랙을 시작하세요</h3>
            <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-center text-base font-black text-[#14295F]">트랙 시작</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4">
              <p className="text-xs font-black text-[#14295F]/60">오늘의 학습</p>
              <p className="mt-2 text-3xl font-black text-[#1B64DA]">1h 36m</p>
            </div>
            <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4">
              <p className="text-xs font-black text-[#14295F]/60">시즌 LP</p>
              <p className="mt-2 text-3xl font-black text-[#FF7A16]">3,164</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4">
            <p className="font-display text-2xl font-bold text-[#14295F]">계획트랙</p>
            <div className="mt-4 space-y-2">
              <div className="rounded-xl bg-[#F7FAFF] px-4 py-3 text-sm font-black text-[#14295F]">수능특강 독서 완료</div>
              <div className="rounded-xl bg-[#F7FAFF] px-4 py-3 text-sm font-black text-[#14295F]">평가원 독서 1세트 진행</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-5 border-t border-[#14295F]/8 bg-[#14295F] px-3 py-3 text-center text-[11px] font-black text-white">
          <div>홈</div>
          <div>성장</div>
          <div>기록</div>
          <div>계획</div>
          <div>상담</div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function ParentMobileDemo() {
  return (
    <PhoneFrame>
      <div className="bg-[#FFFCF9]">
        <div className="flex items-center justify-between border-b border-[#14295F]/8 px-5 py-4">
          <div className="text-xs font-black text-[#14295F]/70">대시보드 &gt; 학부모 앱모드</div>
          <Smartphone className="h-5 w-5 text-[#14295F]" />
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-[1.8rem] border border-[#14295F]/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-3xl font-bold text-[#14295F]">김재윤 학생 현황</p>
                <p className="mt-1 text-xs font-black text-[#FF7A16]">실시간 업데이트 중</p>
              </div>
              <Bell className="h-5 w-5 text-[#14295F]" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#F7FAFF] p-4">
                <p className="text-xs font-black text-[#14295F]/60">주간 누적 학습</p>
                <p className="mt-2 text-3xl font-black text-[#14295F]">14시간 23분</p>
              </div>
              <div className="rounded-2xl bg-[#FFF4EB] p-4">
                <p className="text-xs font-black text-[#B85A00]/70">평균 목표 달성</p>
                <p className="mt-2 text-3xl font-black text-[#FF7A16]">50%</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-2xl font-bold text-[#14295F]">최근 알림</p>
              <span className="rounded-full bg-[#FFF4EB] px-2.5 py-1 text-[11px] font-black text-[#B85A00]">2건</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[#FF7A16]/25 bg-[#FFF9F4] px-4 py-3">
                <p className="text-sm font-black text-[#14295F]">출결 상태 업데이트</p>
                <p className="mt-1 text-xs font-bold text-[#14295F]/60">제목을 누르면 상세 내용을 확인할 수 있습니다.</p>
              </div>
              <div className="rounded-xl border border-[#14295F]/10 bg-[#F7FAFF] px-4 py-3">
                <p className="text-sm font-black text-[#14295F]">생활 기록 알림</p>
                <p className="mt-1 text-xs font-bold text-[#14295F]/60">제목을 누르면 상세 내용을 확인할 수 있습니다.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4">
            <div className="flex items-center gap-2 text-[#14295F]">
              <CreditCard className="h-4 w-4 text-[#FF7A16]" />
              <p className="font-display text-2xl font-bold">수납</p>
            </div>
            <div className="mt-3 rounded-xl border border-[#14295F]/10 bg-[#F7FAFF] px-4 py-3">
              <p className="text-xs font-black text-[#14295F]/60">청구금액</p>
              <p className="mt-2 text-3xl font-black text-[#14295F]">₩50,000</p>
              <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">완납</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-5 border-t border-[#14295F]/8 bg-[#14295F] px-3 py-3 text-center text-[11px] font-black text-white">
          <div>홈</div>
          <div>학습</div>
          <div>데이터</div>
          <div>소통</div>
          <div>수납</div>
        </div>
      </div>
    </PhoneFrame>
  );
}

export default function ExperiencePage() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get('mode') as DemoMode | null) ?? null;
  const studentView = (searchParams.get('view') as StudentView | null) ?? 'desktop';

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F7FAFF_0%,#FFFFFF_100%)] text-[#14295F]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/15 bg-white px-4 py-2 text-sm font-black text-[#14295F]">
            <ChevronLeft className="h-4 w-4" />
            홍보 페이지로 돌아가기
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-sm font-black text-white">
            실제 로그인
          </Link>
        </div>

        <section className="mt-8 rounded-[2rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_24px_60px_rgba(20,41,95,0.12)] sm:p-8">
          <p className="text-xs font-black tracking-[0.2em] text-[#FF7A16]">TRACK EXPERIENCE</p>
          <h1 className="font-display mt-3 break-keep text-4xl font-bold leading-tight sm:text-5xl">
            웹앱 체험하기
          </h1>
          <p className="mt-4 max-w-3xl break-keep text-base font-bold leading-relaxed text-slate-600">
            학생 모드와 학부모 모드의 핵심 화면을 미리 체험해볼 수 있습니다. 학부모 모드는 앱모드 전용으로 구성했습니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <SelectorLink href="/experience?mode=student&view=desktop" label="학생 모드" active={mode === 'student'} />
            <SelectorLink href="/experience?mode=parent" label="학부모 모드" active={mode === 'parent'} />
          </div>
        </section>

        {!mode ? (
          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[1.8rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,41,95,0.1)]">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="h-5 w-5 text-[#FF7A16]" />
                <p className="font-display text-2xl font-bold">학생 모드 체험</p>
              </div>
              <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">
                계획, 실행, 성장 데이터를 학생이 직접 확인하는 화면입니다. 웹모드와 앱모드를 모두 체험할 수 있습니다.
              </p>
              <div className="mt-5 flex gap-3">
                <SelectorLink href="/experience?mode=student&view=desktop" label="웹모드 보기" />
                <SelectorLink href="/experience?mode=student&view=mobile" label="앱모드 보기" />
              </div>
            </article>

            <article className="rounded-[1.8rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,41,95,0.1)]">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-[#FF7A16]" />
                <p className="font-display text-2xl font-bold">학부모 모드 체험</p>
              </div>
              <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">
                학부모 모드는 모바일 앱 감각으로만 제공합니다. 출결, 학습 현황, 알림, 수납 흐름을 앱모드로 확인할 수 있습니다.
              </p>
              <div className="mt-5 flex gap-3">
                <SelectorLink href="/experience?mode=parent" label="앱모드 보기" />
              </div>
            </article>
          </section>
        ) : null}

        {mode === 'student' ? (
          <section className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-[#FF7A16]">STUDENT EXPERIENCE</p>
                <h2 className="font-display mt-2 text-3xl font-bold">학생 모드 체험</h2>
              </div>
              <div className="flex gap-2">
                <SelectorLink href="/experience?mode=student&view=desktop" label="웹모드" active={studentView === 'desktop'} />
                <SelectorLink href="/experience?mode=student&view=mobile" label="앱모드" active={studentView === 'mobile'} />
              </div>
            </div>

            {studentView === 'desktop' ? <StudentDesktopDemo /> : <StudentMobileDemo />}
          </section>
        ) : null}

        {mode === 'parent' ? (
          <section className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-[#FF7A16]">PARENT EXPERIENCE</p>
                <h2 className="font-display mt-2 text-3xl font-bold">학부모 모드 체험</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF4EB] px-4 py-2 text-sm font-black text-[#B85A00]">
                <Smartphone className="h-4 w-4" />
                앱모드 전용
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,41,95,0.1)]">
              <p className="mb-6 max-w-2xl break-keep text-sm font-bold leading-relaxed text-slate-600">
                학부모 모드는 모바일 앱 흐름에 맞춰 출결, 학습량, 알림, 수납을 빠르게 확인하는 구조입니다. 웹형 대시보드 없이 앱모드만 제공됩니다.
              </p>
              <ParentMobileDemo />
            </div>
          </section>
        ) : null}

        <section className="mt-10 rounded-[1.8rem] border border-[#14295F]/10 bg-[linear-gradient(145deg,#13295D,#1A3E8A)] p-6 text-white shadow-[0_20px_50px_rgba(20,41,95,0.18)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#FFD2A6]">NEXT STEP</p>
              <h3 className="font-display mt-2 text-3xl font-bold">실제 계정으로 시작해보세요</h3>
              <p className="mt-2 break-keep text-sm font-bold text-white/80">
                체험은 일부 화면 예시이며, 실제 계정에서는 학생 데이터와 관리 기능이 실시간으로 연결됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-full bg-[#FF7A16] px-5 text-sm font-black text-white">
                실제 로그인
              </Link>
              <Link href="/#consult" className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-black text-white">
                상담 문의
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

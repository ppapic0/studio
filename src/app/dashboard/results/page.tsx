'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, Medal, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAppContext } from '@/contexts/app-context';
import { marketingContent } from '@/lib/marketing-content';
import { cn } from '@/lib/utils';

const universityResults = marketingContent.outcomes.filter((item) => item.label !== '성장 사례');
const successStory = marketingContent.successStory;

const scoreSheetProofs = [
  {
    label: '6월 모의평가',
    caption: '국어 3등급 · 백분위 82',
    image: '/marketing/proof/june-score-sheet-proof-v6.jpg',
  },
  {
    label: '9월 모의평가',
    caption: '국어 1등급 · 백분위 96',
    image: '/marketing/proof/september-score-sheet-proof-v6.jpg',
  },
  {
    label: '수능',
    caption: '국어 백분위 99',
    image: '/marketing/proof/csat-score-sheet-proof-v6.jpg',
  },
] as const;

const operatingReasons = [
  '원장 직강 수업 설계',
  '직접 제작 해설 자료',
  '루틴 중심 학습 관리',
  '앱 기반 피드백 연결',
] as const;

const highlightRows = [
  {
    label: '주요 대학 합격',
    value: `${universityResults.reduce((sum, item) => sum + Number(String(item.value).replace(/[^\d]/g, '') || 0), 0)}명`,
    detail: '2026학년도 기준',
  },
  {
    label: '성장 사례',
    value: '백분위 99',
    detail: '3등급에서 고려대 합격',
  },
  {
    label: '실제 증빙',
    value: `${scoreSheetProofs.length}장`,
    detail: '개인정보 마스킹 완료',
  },
] as const;

export default function DashboardResultsPage() {
  const { activeMembership, viewMode } = useAppContext();
  const router = useRouter();
  const role = activeMembership?.role;
  const isMobile = role === 'parent' || viewMode === 'mobile';
  const homeHref = role === 'parent' ? '/dashboard?parentTab=home' : '/dashboard';
  const supportHref = role === 'parent' ? '/dashboard?parentTab=communication' : '/dashboard/appointments';
  const supportLabel = role === 'parent' ? '소통 탭으로 이동' : '상담트랙으로 이동';

  useEffect(() => {
    if (role === 'student') {
      router.replace('/dashboard');
    }
  }, [role, router]);

  if (role === 'student') {
    return null;
  }

  return (
    <div className={cn('space-y-5', !isMobile && 'space-y-6')}>
      <section className="relative overflow-hidden rounded-[2.2rem] border border-[#D8E5FF] bg-[linear-gradient(180deg,#FDFEFF_0%,#F3F8FF_100%)] px-5 py-6 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.10),transparent_28%),radial-gradient(circle_at_left_top,rgba(20,41,95,0.08),transparent_24%)]" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={homeHref}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#14295F]/12 bg-white px-4 text-[12px] font-black text-[#14295F] shadow-[0_10px_22px_rgba(20,41,95,0.06)]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              대시보드로 돌아가기
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#FF7A16]/18 bg-[#FFF3E8] px-3 py-1.5 text-[10px] font-black tracking-[0.16em] text-[#FF7A16]">
              <Sparkles className="h-3.5 w-3.5" />
              APP RESULTS
            </span>
          </div>

          <div className={cn('grid gap-5', isMobile ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-end')}>
            <div className="max-w-2xl">
              <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">TRACK RESULT ARCHIVE</p>
              <h1 className="font-aggro-display mt-3 break-keep text-[clamp(1.9rem,4vw,3rem)] font-black leading-[1.06] tracking-[-0.04em] text-[#14295F]">
                합격 결과는 우연이 아니라,
                <br />
                운영 구조에서 나옵니다
              </h1>
              <p className="mt-4 max-w-[38rem] break-keep text-[14px] font-semibold leading-[1.85] text-[#48607B] sm:text-[15px]">
                웹 합격실적에서 보여주던 핵심 결과와 실제 성적표 증빙을 앱 안에서도 바로 볼 수 있게 정리했습니다.
                주요 대학 합격 결과, 성장 사례, 실제 성적표 흐름을 한 화면에서 확인할 수 있습니다.
              </p>
            </div>

            <div className="rounded-[1.8rem] border border-[#14295F]/10 bg-white/88 p-4 shadow-[0_14px_34px_rgba(20,41,95,0.06)] backdrop-blur sm:p-5">
              <div className="space-y-3">
                {highlightRows.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[#E5EDF9] bg-[#F8FBFF] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-black tracking-[0.16em] text-[#6E82A4]">{item.label}</p>
                      <p className="mt-1 break-keep text-[11px] font-bold text-[#5C718F]">{item.detail}</p>
                    </div>
                    <p className="dashboard-number shrink-0 text-[1.35rem] font-black tracking-tight text-[#14295F] sm:text-[1.7rem]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={cn('grid gap-5', !isMobile && 'lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]')}>
        <article className="rounded-[2rem] border border-[#DCE6F7] bg-white px-5 py-6 shadow-[0_18px_40px_rgba(20,41,95,0.07)] sm:px-6 sm:py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14295F] text-white shadow-[0_14px_28px_rgba(20,41,95,0.18)]">
              <Medal className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">2026 FINAL OUTCOME</p>
              <h2 className="mt-1 break-keep text-[1.2rem] font-black leading-[1.25] text-[#14295F] sm:text-[1.35rem]">
                주요 대학 합격 결과
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {universityResults.map((item, index) => (
              <article
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[#E3EBF8] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] px-4 py-4"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-black tracking-[0.16em] text-[#7A8FB2]">
                    RESULT {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 break-keep text-[1rem] font-black text-[#14295F] sm:text-[1.08rem]">
                    {item.label}
                  </h3>
                  <p className="mt-1 text-[12px] font-semibold text-[#5A6F8B]">{item.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="dashboard-number text-[1.6rem] font-black leading-none text-[#14295F] sm:text-[2rem]">
                    {item.value}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-[#FFD9BF] bg-[linear-gradient(180deg,#FFF9F2_0%,#FFF3E8_100%)] px-5 py-6 shadow-[0_18px_40px_rgba(255,122,22,0.10)] sm:px-6 sm:py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF7A16] text-white shadow-[0_14px_28px_rgba(255,122,22,0.24)]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">SUCCESS STORY</p>
              <h2 className="mt-1 break-keep text-[1.2rem] font-black leading-[1.25] text-[#14295F] sm:text-[1.35rem]">
                {successStory.title}
              </h2>
            </div>
          </div>

          <p className="font-aggro-display mt-5 break-keep text-[1.35rem] font-black leading-[1.18] tracking-[-0.03em] text-[#14295F] sm:text-[1.7rem]">
            {successStory.summary}
          </p>
          <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.8] text-[#5D718B] sm:text-[14px]">
            모의평가에서 수능까지 어떤 식으로 점프했는지 실제 점수 흐름으로 확인할 수 있습니다.
          </p>

          <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
            {successStory.timeline.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.2rem] border border-white/80 bg-white/88 px-4 py-4 shadow-[0_12px_24px_rgba(20,41,95,0.06)]"
              >
                <p className="text-[10px] font-black tracking-[0.16em] text-[#FF7A16]">{item.label}</p>
                <p className="mt-2 break-keep text-[1rem] font-black text-[#14295F] sm:text-[1.08rem]">{item.value}</p>
                <p className="mt-1.5 text-[12px] font-semibold leading-[1.55] text-[#5B708A]">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[2rem] border border-[#DCE6F7] bg-white px-5 py-6 shadow-[0_18px_40px_rgba(20,41,95,0.07)] sm:px-6 sm:py-7">
        <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-end justify-between')}>
          <div className="max-w-2xl">
            <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">ACTUAL SCORE SHEETS</p>
            <h2 className="font-aggro-display mt-2 break-keep text-[1.35rem] font-black leading-[1.12] tracking-[-0.03em] text-[#14295F] sm:text-[1.8rem]">
              실제 성적표로 변화 흐름을 확인합니다
            </h2>
            <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.8] text-[#59708C] sm:text-[14px]">
              모의평가부터 수능까지, 같은 학생의 실제 변화 과정을 마스킹된 성적표 기준으로 바로 볼 수 있게 정리했습니다.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-[#DCE6F7] bg-[#F8FBFF] px-3 py-1.5 text-[11px] font-black text-[#14295F]/72">
            개인정보 마스킹 완료
          </div>
        </div>

        <div className={cn('mt-5 grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}>
          {scoreSheetProofs.map((item) => (
            <article
              key={item.image}
              className="overflow-hidden rounded-[1.45rem] border border-[#E0E9F7] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] shadow-[0_14px_28px_rgba(20,41,95,0.06)]"
            >
              <div className="border-b border-[#E7EEF9] px-4 py-3">
                <p className="text-[10px] font-black tracking-[0.16em] text-[#FF7A16]">{item.label}</p>
                <p className="mt-1 text-[13px] font-black text-[#14295F]">{item.caption}</p>
              </div>
              <div className="p-4">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.1rem] border border-[#D8E5FF] bg-white">
                  <Image
                    src={item.image}
                    alt={`${item.label} 성적표`}
                    fill
                    sizes="(max-width: 768px) 92vw, 30vw"
                    className="object-contain"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#14295F]/10 bg-[linear-gradient(135deg,#14295F_0%,#17326B_58%,#10214A_100%)] px-5 py-6 text-white shadow-[0_22px_46px_rgba(20,41,95,0.24)] sm:px-6 sm:py-7">
        <div className={cn('grid gap-5', isMobile ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end')}>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
                <ShieldCheck className="h-5 w-5 text-[#FFB273]" />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-[0.18em] text-[#FFB273]">WHY TRACK</p>
                <h2 className="mt-1 break-keep text-[1.2rem] font-black leading-[1.24] sm:text-[1.35rem]">
                  왜 결과가 이어졌는지 앱 안에서 같이 보세요
                </h2>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {operatingReasons.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-black text-white/92"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center')}>
            <Link href={homeHref} className="premium-cta premium-cta-ghost h-11 px-5 text-sm">
              대시보드 홈
            </Link>
            <Link href={supportHref} className="premium-cta premium-cta-primary h-11 gap-1.5 px-5 text-sm">
              {supportLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { StaggerChildren } from './stagger-children';

type MetricTone = 'navy' | 'orange' | 'green';

const heroMetrics = [
  {
    label: '주간 누적 학습',
    value: '14시간 23분',
    detail: '최근 7일 기준',
    tone: 'navy' as const,
  },
  {
    label: '평균 목표 달성률',
    value: '93%',
    detail: '후반부 안정화',
    tone: 'orange' as const,
  },
  {
    label: '리듬 안정도',
    value: '91점',
    detail: '상위권 유지',
    tone: 'green' as const,
  },
] satisfies Array<{
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
}>;

const analyticsFocusChips = ['공부시간', '목표 달성률', '성장률', '리듬', '시작·종료 시간', '중간 이탈시간'];

const analyticsScreenshots = [
  {
    src: '/marketing/app-evidence/experience-analytics-overview-capture.png',
    alt: '트랙 학습 분석 요약 화면 스크린샷',
    width: 836,
    height: 660,
    frameClassName: '',
  },
  {
    src: '/marketing/app-evidence/experience-analytics-dashboard-capture.png',
    alt: '트랙 학습 분석 상세 화면 스크린샷',
    width: 522,
    height: 800,
    frameClassName: 'mx-auto max-w-[33rem]',
  },
] as const;

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
}) {
  const toneClassMap: Record<MetricTone, string> = {
    navy: 'border-[#14295F]/10 bg-[#F7FAFF]',
    orange: 'border-[#FF7A16]/14 bg-[#FFF7F0]',
    green: 'border-emerald-200 bg-[#F4FBF8]',
  };

  return (
    <article
      className={`brand-sheen-panel relative min-w-0 overflow-hidden rounded-[1rem] border px-2.5 py-3 shadow-[0_10px_20px_rgba(20,41,95,0.04)] sm:rounded-[1.2rem] sm:px-4 sm:py-4 ${toneClassMap[tone]}`}
    >
      <div className="brand-glow-drift absolute -right-8 top-0 h-20 w-20 rounded-full bg-[#FFB878]/14 blur-2xl" />
      <div className="relative">
        <p className="break-keep text-[9px] font-black leading-[1.28] text-[#4D627A] sm:text-[11px]">{label}</p>
        <p className="brand-number-pop dashboard-number mt-1.5 break-keep text-[1.06rem] text-[#14295F] sm:mt-2 sm:text-[1.7rem]">{value}</p>
        <p className="mt-1 hidden text-[8.5px] font-bold leading-[1.35] text-[#5A6E85] sm:mt-1.5 sm:block sm:text-[11px]">{detail}</p>
      </div>
    </article>
  );
}

function AnalyticsScreenshotCard({
  screen,
}: {
  screen: (typeof analyticsScreenshots)[number];
}) {
  return (
    <article className="brand-panel-scan relative overflow-hidden rounded-[1.2rem] border border-[#14295F]/10 bg-white p-3 shadow-[0_14px_30px_rgba(20,41,95,0.08)] sm:rounded-[1.55rem] sm:p-5">
      <div className="brand-glow-drift absolute -left-8 top-5 h-24 w-24 rounded-full bg-[#FF7A16]/8 blur-3xl" />
      <div
        className="brand-glow-drift absolute right-6 top-4 h-28 w-28 rounded-full bg-[#8AB2FF]/10 blur-3xl"
        style={{ animationDelay: '-2.4s' }}
      />
      <div className={`relative ${screen.frameClassName}`}>
        <div className="overflow-hidden rounded-[1rem] border border-[#D8E5FF] bg-[linear-gradient(180deg,#FBFDFF_0%,#F3F7FF_100%)] p-2.5 shadow-[0_16px_32px_rgba(20,41,95,0.06)] sm:rounded-[1.2rem] sm:p-3.5">
          <Image
            src={screen.src}
            alt={screen.alt}
            width={screen.width}
            height={screen.height}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 88vw, 1120px"
            className="h-auto w-full rounded-[0.75rem] border border-[#EEF3FF] bg-white object-contain"
          />
        </div>
      </div>
    </article>
  );
}

export function DataAnalyticsPreviewSection({ showNextView = true }: { showNextView?: boolean }) {
  return (
    <section id="data-approach" className="relative scroll-mt-28 overflow-hidden py-0">
      <div className="pointer-events-none absolute inset-0">
        <div className="brand-glow-drift absolute left-[-8%] top-[14%] h-44 w-44 rounded-full bg-[#7AA7FF]/10 blur-[90px]" />
        <div
          className="brand-glow-drift absolute right-[-4%] top-[22%] h-56 w-56 rounded-full bg-[#FFB878]/14 blur-[110px]"
          style={{ animationDelay: '-2.8s' }}
        />
        <div
          className="brand-glow-drift absolute left-[20%] bottom-[10%] h-36 w-36 rounded-full bg-[#FF7A16]/8 blur-[90px]"
          style={{ animationDelay: '-4.1s' }}
        />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-4xl">
          <div className="px-1 py-2 text-center sm:px-4 sm:py-4">
            <div className="pointer-events-none absolute inset-x-[18%] top-[8%] h-28 rounded-full bg-[radial-gradient(circle,rgba(122,167,255,0.10)_0%,transparent_72%)] blur-3xl" />
            <div className="relative">
              <span className="eyebrow-badge">DATA DRIVEN</span>
              <h2 className="font-aggro-display mt-4 break-keep text-[clamp(1.5rem,6vw,2.7rem)] font-black leading-[1.08] text-[#14295F]">
                학습 데이터를 체계적으로
                <br />
                분석하고 맞춤형 학습 방향을 제시합니다.
              </h2>

              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {analyticsFocusChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex rounded-full border border-[#D9E4F8] bg-white/88 px-3 py-1.5 text-[11px] font-black text-[#425A75] shadow-[0_8px_18px_rgba(20,41,95,0.06)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <p className="mx-auto mt-5 max-w-[24rem] break-keep text-[13px] font-bold leading-[1.72] text-[#526984] sm:text-[14px]">
                학생, 학부모 상담자료로 사용하여 학습방향을 설정합니다.
              </p>
              <div className="mx-auto mt-6 h-[3px] w-full max-w-[15rem] rounded-full bg-[linear-gradient(90deg,rgba(20,41,95,0.14)_0%,rgba(20,41,95,0.55)_50%,rgba(20,41,95,0.14)_100%)]" />
            </div>
          </div>
        </div>

        <StaggerChildren stagger={90} className="mt-6 grid gap-3 sm:grid-cols-3">
          {heroMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              tone={metric.tone}
            />
          ))}
        </StaggerChildren>

        <StaggerChildren stagger={110} className="mt-8 space-y-4 sm:space-y-5">
          {analyticsScreenshots.map((screen) => (
            <AnalyticsScreenshotCard key={screen.src} screen={screen} />
          ))}
        </StaggerChildren>

        {showNextView ? (
          <article className="mt-6 rounded-[1.45rem] border border-[#14295F]/10 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(20,41,95,0.05)] sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[12px] font-bold text-[#FF7A16]">NEXT VIEW</p>
                <p className="mt-1.5 break-keep text-[1.05rem] font-black leading-[1.42] text-[#14295F]">
                  같은 데이터도 학생, 학부모, 운영자는 서로 다르게 읽습니다.
                </p>
                <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.68] text-[#52667D] sm:text-[14px]">
                  아래 역할별 화면에서 누가 어떤 그래프를 먼저 보는지 이어서 확인할 수 있게 연결합니다.
                </p>
              </div>

              <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
                <Link href="#app" className="premium-cta premium-cta-primary h-11 w-full gap-1.5 px-5 text-sm sm:w-auto">
                  역할별 화면 이어보기
                  <ArrowRight className="brand-cta-arrow h-3.5 w-3.5" />
                </Link>
                <Link href="/experience" className="premium-cta premium-cta-muted h-11 w-full px-5 text-sm sm:w-auto">
                  전체 체험 보기
                </Link>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}

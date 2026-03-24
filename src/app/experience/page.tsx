'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, BarChart3, Bell, ChevronLeft, LineChart, ShieldCheck, Smartphone, Target, Users } from 'lucide-react';

import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { marketingContent } from '@/lib/marketing-content';
import { cn } from '@/lib/utils';

type DemoMode = 'student' | 'parent' | 'admin';

const actualProofs = [
  '/marketing/reviews/kakao-feedback-1-redacted.jpg',
  '/marketing/reviews/kakao-feedback-2-redacted.jpg',
  '/marketing/reviews/kakao-feedback-3-redacted.jpg',
];

const modeContent: Record<
  DemoMode,
  {
    label: string;
    title: string;
    desc: string;
    subdesc: string;
    image: string;
    proofs: Array<{ title: string; description: string; image: string }>;
    stages: Array<{ step: string; title: string; description: string }>;
    primaryHref: string;
    badge: string;
  }
> = {
  student: {
    label: '학생 모드',
    title: '학생은 오늘의 루틴과 변화의 방향을 직접 확인합니다',
    desc: '학생 홈 화면, 주간 캘린더, 성장 지표, 피드백 이후 행동 흐름을 실제 시스템처럼 공개합니다.',
    subdesc: '해야 할 일 확인에서 끝나는 것이 아니라, 기록 추적과 해석, 다음 행동까지 연결되는 화면을 기준으로 보여줍니다.',
    image: '/marketing/app-evidence/student-dashboard-redacted.svg',
    proofs: [
      {
        title: '대표 홈 화면',
        description: '오늘의 루틴, 주간 그래프, 성장 지표가 함께 보입니다.',
        image: '/marketing/app-evidence/student-dashboard-redacted.svg',
      },
      {
        title: '실제 피드백 일부 공개',
        description: '카카오 피드백 일부를 마스킹해 행동 변화의 근거로 공개합니다.',
        image: '/marketing/reviews/kakao-feedback-1-redacted.jpg',
      },
    ],
    stages: [
      { step: '01 확인', title: '오늘의 루틴 확인', description: '학생이 지금 무엇을 해야 하는지 먼저 확인합니다.' },
      { step: '02 추적', title: '주간 기록 추적', description: '날짜별 기록과 주간 그래프로 흐름을 추적합니다.' },
      { step: '03 해석', title: '성장 지표 읽기', description: '집중력, 꾸준함, 목표 달성률로 상태를 읽습니다.' },
      { step: '04 행동', title: '피드백 반영', description: '피드백과 알림을 다음 루틴으로 연결합니다.' },
    ],
    primaryHref: '/go/login?placement=experience_student',
    badge: '학생 앱 흐름',
  },
  parent: {
    label: '학부모 모드',
    title: '학부모는 학생의 과정을 빠르게 읽고 바로 질문합니다',
    desc: '상태 요약, 주간 그래프, 날짜별 기록, 리포트와 알림 흐름을 실제 시스템처럼 공개합니다.',
    subdesc: '학부모는 길게 탐색하지 않고도 현재 상태와 변화의 방향을 빠르게 확인할 수 있어야 합니다.',
    image: '/marketing/app-evidence/parent-dashboard-redacted.svg',
    proofs: [
      {
        title: '상태 요약 화면',
        description: '출결, 주간 누적, 상태 요약, 위험 신호를 한 번에 확인합니다.',
        image: '/marketing/app-evidence/parent-dashboard-redacted.svg',
      },
      {
        title: '실제 피드백 일부 공개',
        description: '실제 피드백 자산을 마스킹해 학부모 커뮤니케이션 톤을 보여줍니다.',
        image: '/marketing/reviews/kakao-feedback-2-redacted.jpg',
      },
    ],
    stages: [
      { step: '01 확인', title: '실시간 상태 확인', description: '학생의 현재 상태와 출결을 먼저 읽습니다.' },
      { step: '02 추적', title: '주간 그래프 추적', description: '주간 누적 그래프와 날짜별 기록으로 과정을 봅니다.' },
      { step: '03 해석', title: '리포트 읽기', description: '리포트와 위험 신호를 함께 보며 개입 필요성을 읽습니다.' },
      { step: '04 행동', title: '질문/상담 연결', description: '바로 질문하거나 다음 상담으로 연결합니다.' },
    ],
    primaryHref: '/go/login?placement=experience_parent',
    badge: '학부모 앱 흐름',
  },
  admin: {
    label: '운영자 모드',
    title: '운영자는 문제를 먼저 발견하고 개입 결과까지 봅니다',
    desc: '위험 신호, 개입 우선순위, 상담/피드백 발송, 전후 비교를 같은 흐름으로 공개합니다.',
    subdesc: '운영자 화면은 보기 좋은 리포트보다 먼저 개입할 대상을 선별하고 후속 결과를 확인하는 데 집중합니다.',
    image: '/marketing/app-evidence/admin-dashboard-redacted.svg',
    proofs: [
      {
        title: '운영자 개입 화면',
        description: '위험 신호와 우선순위, 전후 비교를 묶어 보여주는 공개용 재구성 캡처입니다.',
        image: '/marketing/app-evidence/admin-dashboard-redacted.svg',
      },
      {
        title: '실제 결과 증빙',
        description: '운영 구조가 결과로 이어진 실제 성적표 일부를 마스킹해 공개합니다.',
        image: '/marketing/proof/september-mock-redacted.jpg',
      },
    ],
    stages: [
      { step: '01 확인', title: '하락 신호 감지', description: '공부시간, 목표 달성률, 미제출을 먼저 읽습니다.' },
      { step: '02 추적', title: '대상 우선순위 정리', description: '어디에 먼저 개입할지 운영 우선순위를 잡습니다.' },
      { step: '03 해석', title: '상담/피드백 연결', description: '개입 방식과 후속 조치를 같은 화면에서 이어갑니다.' },
      { step: '04 행동', title: '전후 변화 확인', description: '회복과 결과 변화를 다시 확인합니다.' },
    ],
    primaryHref: '/go/experience?placement=experience_admin&mode=admin',
    badge: '운영자 공개 화면',
  },
};

function ModeTab({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-black transition-all',
        active
          ? 'bg-[#14295F] text-white shadow-[0_6px_16px_rgba(20,41,95,0.22)]'
          : 'border border-[#14295F]/12 bg-white text-[#14295F]/65 hover:border-[#14295F]/22 hover:text-[#14295F]',
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function ProofCard({
  title,
  description,
  image,
  badge,
}: {
  title: string;
  description: string;
  image: string;
  badge?: string;
}) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-[#14295F]/10 bg-white shadow-sm">
      <div className="relative aspect-[1.22/1] border-b border-[#14295F]/8 bg-[#0D1732]">
        <Image src={image} alt={title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[1rem] font-black text-[#14295F]">{title}</p>
          {badge ? (
            <span className="rounded-full bg-[#F5F8FF] px-3 py-1 text-[10px] font-black text-[#14295F]/55">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-slate-500">{description}</p>
      </div>
    </article>
  );
}

function ModeDetail({ mode }: { mode: DemoMode }) {
  const content = modeContent[mode];

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#14295F]/10 bg-white shadow-[0_12px_36px_rgba(20,41,95,0.09)]">
        <div className="relative px-6 py-6 sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_6%_12%,rgba(20,41,95,0.04),transparent_20%),radial-gradient(circle_at_94%_8%,rgba(255,122,22,0.08),transparent_20%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]">{content.label}</p>
              <span className="rounded-full bg-[#F5F8FF] px-3 py-1.5 text-[11px] font-black text-[#14295F]">{content.badge}</span>
            </div>
            <h2 className="mt-2 break-keep text-[1.5rem] font-black text-[#14295F] sm:text-[1.75rem]">{content.title}</h2>
            <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.7] text-[#334e6a]">{content.desc}</p>
            <p className="mt-1.5 break-keep text-[13px] font-semibold leading-[1.65] text-slate-400">{content.subdesc}</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link href={content.primaryHref} className="premium-cta premium-cta-primary h-10 px-5 text-sm">
                {mode === 'admin' ? '운영자 화면 체험' : '실제 로그인'}
              </Link>
              <Link href="/experience" className="premium-cta premium-cta-muted h-10 px-5 text-sm">
                전체 증거 라이브러리
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <ProofCard title={`${content.label} 대표 화면`} description={content.desc} image={content.image} badge="재구성 캡처" />
        <div className="grid gap-4">
          {content.stages.map((stage) => (
            <article key={stage.step} className="rounded-[1.3rem] border border-[#14295F]/10 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">{stage.step}</p>
              <p className="mt-2 text-[1rem] font-black leading-[1.4] text-[#14295F]">{stage.title}</p>
              <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-slate-500">{stage.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {content.proofs.map((proof, index) => (
          <ProofCard
            key={`${proof.title}-${index}`}
            title={proof.title}
            description={proof.description}
            image={proof.image}
            badge={index === 0 ? '대표 증빙' : '실제 자산'}
          />
        ))}
      </div>
    </div>
  );
}

function ExperienceHub() {
  const captures = marketingContent.appSystem.captures;

  return (
    <div className="space-y-8">
      <div className="rounded-[1.75rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_12px_36px_rgba(20,41,95,0.09)]">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]">EVIDENCE LIBRARY</p>
        <h2 className="mt-2 break-keep text-[1.4rem] font-black text-[#14295F] sm:text-[1.7rem]">
          웹앱을 소개하지 않고
          <br />
          실제 시스템처럼 보여드립니다
        </h2>
        <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.7] text-[#334e6a]">
          학생, 학부모, 운영자 화면을 각각 공개용 증거 카드로 정리했습니다. 실제 자산은 마스킹해서 공개하고, 없는 부분은 현재 앱 기준 재구성으로 보완합니다.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {captures.map((capture) => (
          <ProofCard
            key={capture.mode}
            title={capture.mode}
            description={capture.callout}
            image={capture.image}
            badge={capture.proofType === 'actual' ? '실제 캡처' : '재구성 캡처'}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {actualProofs.map((image, index) => (
          <ProofCard
            key={image}
            title={`실제 피드백 자산 ${index + 1}`}
            description="학생/학부모 커뮤니케이션 자산 일부를 마스킹해 공개합니다."
            image={image}
            badge="실제 자산"
          />
        ))}
      </div>

      <div className="rounded-[1.5rem] border border-[#14295F]/10 bg-white p-6 text-center shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">FLOW</p>
        <p className="mt-2 break-keep text-[1.1rem] font-black text-[#14295F]">
          확인 → 추적 → 해석 → 행동 흐름으로 학생/학부모/운영자 화면을 함께 읽을 수 있게 구성했습니다.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/experience?mode=student" className="premium-cta premium-cta-primary h-10 px-5 text-sm">
            학생 모드 보기
          </Link>
          <Link href="/experience?mode=parent" className="premium-cta premium-cta-muted h-10 px-5 text-sm">
            학부모 모드 보기
          </Link>
          <Link href="/experience?mode=admin" className="premium-cta premium-cta-muted h-10 px-5 text-sm">
            운영자 화면 보기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ExperiencePage() {
  const searchParams = useSearchParams();
  const rawMode = searchParams.get('mode');
  const mode: DemoMode | null = rawMode === 'student' || rawMode === 'parent' || rawMode === 'admin' ? rawMode : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F5F8FF_0%,#FFFFFF_60%,#F8FBFF_100%)] text-[#14295F]">
      <MarketingPageTracker pageType="experience" placement="experience_page" />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-white px-4 py-2 text-[13px] font-black text-[#14295F] shadow-sm"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            홍보 페이지로 돌아가기
          </Link>
          <Link
            href="/go/login?placement=experience_header"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF7A16] px-4 py-2 text-[13px] font-black text-white shadow-[0_8px_18px_rgba(255,122,22,0.28)]"
          >
            실제 로그인
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <ModeTab href="/experience" label="증거 라이브러리" active={!mode} icon={<Target className="h-3.5 w-3.5" />} />
          <ModeTab href="/experience?mode=student" label="학생 모드" active={mode === 'student'} icon={<Smartphone className="h-3.5 w-3.5" />} />
          <ModeTab href="/experience?mode=parent" label="학부모 모드" active={mode === 'parent'} icon={<Users className="h-3.5 w-3.5" />} />
          <ModeTab href="/experience?mode=admin" label="운영자 화면" active={mode === 'admin'} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        </div>

        <div className="mt-6">{mode ? <ModeDetail mode={mode} /> : <ExperienceHub />}</div>

        <div className="mt-8 rounded-[1.5rem] border border-[#14295F]/10 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">TRUST METRICS</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {marketingContent.appSystem.trustMetrics.map((metric) => (
              <div key={`${metric.label}-${metric.value}`} className="rounded-[1.1rem] bg-[#F8FBFF] px-4 py-4">
                <p className="text-[10px] font-black tracking-[0.16em] text-[#14295F]/45">{metric.label}</p>
                <p className="dashboard-number mt-2 text-[1.25rem] text-[#14295F]">{metric.value}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#14295F]/58">{metric.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/go/login?placement=experience_bottom" className="premium-cta premium-cta-primary h-10 px-5 text-sm">
              실제 로그인
            </Link>
            <Link href="/#consult" className="premium-cta premium-cta-muted h-10 px-5 text-sm">
              상담 요청하기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

import {
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Target,
  Users,
} from 'lucide-react';

import { AcademyFloatingCTA } from '@/components/marketing/academy-floating-cta';
import { ConsultForm } from '@/components/marketing/consult-form';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { StaggerChildren } from '@/components/marketing/stagger-children';
import { TrackKoreanMethodSection } from '@/components/marketing/track-korean-method-section';
import { marketingContent } from '@/lib/marketing-content';

/* ─────────────────────────────────────────────────
   Static data — defined here, not in marketing-content
   to keep this page self-contained and maintainable
───────────────────────────────────────────────── */

const career = [
  { label: '관리형 독서실 원장', detail: '분당·판교 관리형 스터디센터 운영 경험' },
  { label: '국어 개인과외 40명+', detail: '직접 지도 학생 70% 이상 인서울 달성' },
  { label: '원장 본인 국어 백분위 99', detail: '2024학년도 수능 실전 기록' },
];

const results = [
  { school: '고려대학교', count: '2명', year: '26' },
  { school: '서강대학교', count: '1명', year: '26' },
  { school: '성균관대학교', count: '1명', year: '26' },
  { school: '홍익대학교', count: '1명', year: '26' },
  { school: '아주대학교', count: '1명', year: '26' },
];

const methods = [
  {
    icon: BookOpen,
    title: '읽는 방식 정리',
    body: '지문을 어디서 끊고, 무엇을 기준으로 읽어야 하는지 막연한 감이 아니라 구체적인 방식으로 정리합니다.',
  },
  {
    icon: Target,
    title: '선지 판단 기준 정리',
    body: '틀리는 문제를 다시 틀리지 않도록 선지를 판단하는 기준과 흔들리는 포인트를 함께 잡습니다.',
  },
  {
    icon: Users,
    title: '학생별 약점 보완',
    body: '학생마다 막히는 지점은 다릅니다. 읽기, 개념, 적용, 시간 관리 중 필요한 부분을 중심으로 보완합니다.',
  },
  {
    icon: Layers,
    title: '자료 기반 수업',
    body: '원장이 직접 만든 해설 자료와 수업 자료를 바탕으로 수업의 흐름이 남고, 복습의 기준도 분명해집니다.',
  },
];

const materialPreviews = [
  {
    label: '독서 지문 분석 자료',
    tag: '지문 구조 해설',
    desc: '단락별 핵심 정보와 연결 구조를 정리한 해설 자료입니다.',
    lines: [4, 3, 4, 2],
  },
  {
    label: '선지 판단 기준 노트',
    tag: '오답 패턴 분석',
    desc: '자주 틀리는 유형의 선지 판단 기준과 함정 패턴 정리.',
    lines: [3, 4, 3],
  },
  {
    label: '수업 설계 노트',
    tag: '수업 계획 자료',
    desc: '수업 흐름과 학생별 보완 포인트를 기록한 운영 자료입니다.',
    lines: [4, 3, 2, 3],
  },
];

const koreanMaterialPdfPath = '/materials/2026-korean-nonfiction-2passages-commentary.pdf';
const koreanMaterialPreviewUrl = `${koreanMaterialPdfPath}#page=1&view=FitH`;

const scoreProofCards = [
  {
    phase: '6월 모의평가',
    result: '국어 3등급',
    detail: '백분위 82',
    image: '/marketing/proof/june-mock-redacted.jpg',
  },
  {
    phase: '9월 모의평가',
    result: '국어 1등급',
    detail: '백분위 96',
    image: '/marketing/proof/september-mock-redacted.jpg',
  },
  {
    phase: '수능 본시험',
    result: '국어 백분위 99',
    detail: '실제 성적표 기반',
    image: '/marketing/proof/csat-score-redacted.jpg',
  },
];

const studentFits = [
  {
    title: '문제를 많이 풀어도 성적이 잘 안 오르는 학생',
    body: '풀이량보다 먼저, 읽는 방식과 판단 기준을 점검해야 하는 경우가 많습니다.',
  },
  {
    title: '국어를 감으로 풀고 있는 학생',
    body: '맞고 틀리고의 이유를 분명하게 설명할 수 있어야 성적이 안정됩니다.',
  },
  {
    title: '재학생 · N수생 모두',
    body: '현재 위치에 따라 필요한 방식은 달라집니다. 학생 상황에 맞게 수업 방향을 잡습니다.',
  },
  {
    title: '관리와 수업을 함께 가져가고 싶은 학생',
    body: '스터디센터 운영과 함께 연결해 더 안정적인 학습 흐름을 만들 수 있습니다.',
  },
];

const contactItems = [
  { label: 'CONTACT', value: marketingContent.consult.contactLine },
  { label: 'LOCATION', value: marketingContent.consult.locationLine },
  { label: 'HOURS', value: marketingContent.consult.hoursLine },
];

/* ─────────────────────────────────────────────────
   Page
───────────────────────────────────────────────── */

export default function ClassPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />
      <TrackKoreanMethodSection />

      {/* ══════════════════════════════════════════
          1. HERO
      ══════════════════════════════════════════ */}
      <section
        className="on-dark relative flex min-h-[92svh] items-center overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #080f28 0%, #0d1d47 50%, #0b1631 100%)' }}
      >
        {/* subtle radial ambience */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_12%_0%,rgba(22,55,155,0.44),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_88%_100%,rgba(20,41,95,0.4),transparent)]" />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_0.82fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          {/* Left */}
          <div className="space-y-8">
            <span className="eyebrow-badge-light">원장 직강 · 수능 국어</span>

            <div className="space-y-6">
              <h1 className="font-aggro-display break-keep text-[clamp(2.6rem,5.2vw,4.2rem)] font-black leading-[1.06] text-white">
                국어는 감이 아니라,
                <br />
                <span className="text-[#FF7A16]">근거와 구조</span>로
                <br />
                쌓입니다
              </h1>
              <p className="max-w-[440px] break-keep text-[15.5px] font-semibold leading-[1.82] text-white/85">
                원장 직강으로 진행합니다.
                직접 만든 해설 자료와 수업 자료를 바탕으로
                읽는 방식, 선지 판단 기준, 적용 흐름까지 함께 잡아갑니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a href="#class-consult" className="premium-cta premium-cta-primary h-12 px-7 text-[14px]">
                수업 상담 신청
              </a>
              <a href="#materials" className="premium-cta premium-cta-ghost h-12 px-7 text-[14px]">
                수업자료 미리보기
              </a>
            </div>

            <p className="text-[12.5px] font-bold text-white/50">
              2026학년도 · 고려대 2명 포함 주요 대학 합격
            </p>
          </div>

          {/* Right — credential card */}
          <div className="hidden lg:block">
            <div
              className="rounded-[1.6rem] border p-8 space-y-6"
              style={{
                borderColor: 'rgba(255,255,255,0.11)',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 24px 48px -12px rgba(0,0,0,0.32)',
              }}
            >
              <p className="text-[10.5px] font-black tracking-[0.22em] text-[#FFB273] uppercase">
                2026 성과 · 수업 신뢰도
              </p>

              {/* result grid */}
              <div className="grid grid-cols-2 gap-3">
                {results.map((r) => (
                  <div
                    key={r.school}
                    className="rounded-xl border border-white/8 bg-white/5 px-4 py-3"
                  >
                    <p className="text-[1.4rem] font-black leading-none text-white">{r.count}</p>
                    <p className="mt-1.5 break-keep text-[11.5px] font-semibold text-white/75">{r.school}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-[#FF7A16]/22 bg-[#FF7A16]/8 px-4 py-3">
                  <p className="text-[1.4rem] font-black leading-none text-[#FF9848]">99</p>
                  <p className="mt-1.5 text-[11.5px] font-semibold text-[#FF9848]/70">원장 국어 백분위</p>
                </div>
              </div>

              {/* highlights */}
              <div className="space-y-2.5 border-t border-white/8 pt-5">
                {['원장 직강', '직접 제작 해설 자료', '학생별 맞춤 보완'].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FF9848]" />
                    <span className="text-[13.5px] font-semibold text-white/90">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. INTRO
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="py-20 sm:py-28" style={{ background: '#f4f7ff' }}>
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <span className="eyebrow-badge">수업 소개</span>
            <h2 className="mt-5 break-keep text-[clamp(1.75rem,3.6vw,2.4rem)] font-black leading-[1.12] text-[#14295F]">
              국어 수업은 이렇게 진행됩니다
            </h2>
            <p className="mx-auto mt-6 max-w-[560px] break-keep text-[15.5px] font-semibold leading-[1.88] text-[#334e6a]">
              트랙의 국어 수업은 단순 문제풀이 반복이 아닙니다.
              지문을 읽는 방식, 선지 판단의 기준,
              흔들리는 포인트를 함께 점검하며
              학생마다 필요한 부분을 분명하게 잡아가는 수업입니다.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: BookOpen, text: '읽기 구조 확립' },
                { icon: Target, text: '판단 기준 정리' },
                { icon: GraduationCap, text: '학생별 보완' },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-[rgba(20,41,95,0.10)] bg-white px-6 py-7"
                >
                  <Icon className="h-6 w-6 text-[#FF7A16]" />
                  <span className="text-[15px] font-black text-[#14295F]">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          3. DIRECTOR
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="py-20 sm:py-28 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
              {/* Left */}
              <div>
                <span className="eyebrow-badge">원장 직강</span>
                <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
                  원장이 직접 가르칩니다
                </h2>
                <p className="mt-5 break-keep text-[15.5px] font-semibold leading-[1.9] text-[#334e6a]">
                  수업의 방향, 자료의 밀도, 학생 피드백의 흐름까지
                  모두 원장이 직접 설계하고 진행합니다.
                  겉으로만 많은 설명이 아니라, 실제 성적 변화로 이어질 수 있도록
                  수업의 기준을 분명하게 세웁니다.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  {['직강', '직접 제작 자료', '학생별 보완'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#14295F]/14 bg-[#14295F]/5 px-4 py-1.5 text-[12.5px] font-black text-[#14295F]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right — highlights */}
              <div className="space-y-3">
                {marketingContent.director.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="flex items-start gap-4 rounded-2xl border border-[rgba(20,41,95,0.09)] bg-[#f8faff] px-5 py-4"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7A16]" />
                    <p className="break-keep text-[14.5px] font-semibold leading-[1.72] text-[#14295F]">
                      {highlight}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          4. CAREER
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="py-20 sm:py-28" style={{ background: 'linear-gradient(180deg, #f4f7ff 0%, #ffffff 100%)' }}>
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow-badge">경력 · 실적</span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
                경력은 수업의 기준을 만듭니다
              </h2>
              <p className="mt-5 break-keep text-[15px] font-semibold leading-[1.88] text-[#334e6a]">
                학생을 오래 봐온 경험은
                어떤 지점에서 성적이 멈추고, 어디서부터 다시 올라가는지를
                더 정확하게 판단하게 합니다.
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Career items */}
              {career.map((c) => (
                <article
                  key={c.label}
                  className="rounded-[1.4rem] border border-[rgba(20,41,95,0.10)] bg-white px-6 py-7"
                  style={{ boxShadow: '0 2px 8px -2px rgba(20,41,95,0.06), 0 8px 24px -4px rgba(20,41,95,0.07)' }}
                >
                  <p className="text-[1.5rem] font-black leading-none text-[#14295F]">{c.label}</p>
                  <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.7] text-[#445f7e]">{c.detail}</p>
                </article>
              ))}

              {/* 2026 results merged into one card */}
              <article
                className="rounded-[1.4rem] border border-[rgba(20,41,95,0.10)] bg-white px-6 py-7 sm:col-span-2 lg:col-span-3"
                style={{ boxShadow: '0 2px 8px -2px rgba(20,41,95,0.06), 0 8px 24px -4px rgba(20,41,95,0.07)' }}
              >
                <p className="mb-5 text-[10.5px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">
                  2026학년도 합격
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-4">
                  {results.map((r) => (
                    <div key={r.school} className="flex items-baseline gap-2">
                      <span className="text-[1.35rem] font-black text-[#14295F]">{r.count}</span>
                      <span className="text-[13px] font-semibold text-[#445f7e]">{r.school}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article
              className="mt-8 rounded-[1.4rem] border border-[rgba(20,41,95,0.10)] bg-white px-6 py-7"
              style={{ boxShadow: '0 2px 8px -2px rgba(20,41,95,0.06), 0 8px 24px -4px rgba(20,41,95,0.07)' }}
            >
              <p className="text-[10.5px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">
                성적 상승 사례
              </p>
              <h3 className="mt-3 break-keep text-[1.35rem] font-black leading-[1.3] text-[#14295F]">
                6월 3등급에서 수능 백분위 99까지
              </h3>
              <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.74] text-[#445f7e]">
                동일 학생의 6월 모의평가, 9월 모의평가, 수능 성적표를 기준으로 한 실제 상승 흐름입니다.
                개인정보 보호를 위해 이름과 학교 정보는 가림 처리했습니다.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {['6월 3등급', '9월 1등급', '수능 백분위 99'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#14295F]/10 bg-[#F3F7FF] px-3 py-1.5 text-[12px] font-black text-[#14295F]"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {scoreProofCards.map((card) => (
                  <figure
                    key={card.phase}
                    className="overflow-hidden rounded-[1.1rem] border border-[rgba(20,41,95,0.12)] bg-[#F8FAFF]"
                  >
                    <img src={card.image} alt={`${card.phase} score proof (redacted)`} className="h-[230px] w-full object-cover object-top" />
                    <figcaption className="space-y-1 border-t border-[rgba(20,41,95,0.08)] bg-white px-4 py-3.5">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FF7A16]">{card.phase}</p>
                      <p className="text-[15px] font-black text-[#14295F]">{card.result}</p>
                      <p className="text-[12px] font-semibold text-[#4B6380]">{card.detail}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </article>

            <p className="mx-auto mt-12 max-w-xl text-center break-keep text-[15px] font-semibold leading-[1.88] text-[#334e6a]">
              결과는 한 번의 운이 아니라,<br />
              누적된 수업 경험과 정확한 피드백 구조에서 나옵니다.
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          5. TEACHING METHOD
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="py-20 sm:py-28 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <span className="eyebrow-badge">수업 방식</span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
                수업은 이해보다
                <br />
                적용까지 가야 합니다
              </h2>
            </div>

            <StaggerChildren stagger={100} className="mt-12 grid gap-5 sm:grid-cols-2">
              {methods.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="flex gap-5 rounded-[1.4rem] border border-[rgba(20,41,95,0.09)] bg-[#f8faff] p-7"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'linear-gradient(145deg, #1e4898, #14295f)' }}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[1.05rem] font-black leading-snug text-[#14295F]">{title}</h3>
                    <p className="mt-2.5 break-keep text-[14px] font-semibold leading-[1.8] text-[#445f7e]">
                      {body}
                    </p>
                  </div>
                </article>
              ))}
            </StaggerChildren>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          6. MATERIALS
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section
          id="materials"
          className="on-dark scroll-mt-20 py-20 sm:py-28"
          style={{ background: 'linear-gradient(155deg, #080f28 0%, #0d1d47 55%, #0b1631 100%)' }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <span className="eyebrow-badge-light">수업 자료</span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-white">
                자료의 밀도는
                <br />
                수업의 밀도와 연결됩니다
              </h2>
              <p className="mt-5 break-keep text-[15px] font-semibold leading-[1.88] text-white/80">
                트랙의 국어 수업은 직접 제작한 해설 자료와 수업 자료를 바탕으로 진행합니다.
                설명이 많은 자료보다, 학생이 실제로 이해하고 다시 적용할 수 있는 자료를 지향합니다.
              </p>
            </div>

            <StaggerChildren stagger={100} className="mt-12 grid gap-5 sm:grid-cols-3">
              {materialPreviews.map((m) => (
                <article
                  key={m.label}
                  className="overflow-hidden rounded-[1.4rem] border"
                  style={{
                    borderColor: 'rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Document thumbnail mock */}
                  <div
                    className="border-b px-6 py-6"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#FF9848]" />
                      <span className="text-[10px] font-black tracking-[0.16em] text-[#FFB273] uppercase">
                        {m.tag}
                      </span>
                    </div>
                    {/* mock text lines */}
                    <div className="space-y-2">
                      {m.lines.map((w, i) => (
                        <div key={i} className="flex gap-1.5">
                          {Array.from({ length: w }).map((_, j) => (
                            <div
                              key={j}
                              className="h-2 rounded-full bg-white/18"
                              style={{ width: `${20 + Math.random() * 40}%` }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Card body */}
                  <div className="px-6 py-5">
                    <p className="text-[13.5px] font-black text-white">{m.label}</p>
                    <p className="mt-2 break-keep text-[12.5px] font-semibold leading-[1.72] text-white/70">
                      {m.desc}
                    </p>
                  </div>
                </article>
              ))}
            </StaggerChildren>

            <div className="mt-12 text-center">
              <p className="mb-6 break-keep text-[14.5px] font-semibold text-white/75">
                자료를 통해 수업의 기준, 설명의 밀도, 정리 방식까지 미리 확인해보세요.
              </p>
              <div className="mx-auto mb-6 max-w-3xl overflow-hidden rounded-[1.2rem] border border-white/18 bg-white">
                <div className="flex items-center justify-between border-b border-[#14295F]/10 px-4 py-2.5">
                  <p className="text-[12px] font-black text-[#14295F]">PDF First Page Preview</p>
                  <a href={koreanMaterialPdfPath} download className="text-[11.5px] font-black text-[#14295F]/70 hover:text-[#14295F]">
                    Download
                  </a>
                </div>
                <iframe
                  title="PDF first page preview"
                  src={koreanMaterialPreviewUrl}
                  className="h-[280px] w-full bg-white"
                />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={koreanMaterialPdfPath}
                  download
                  className="premium-cta premium-cta-primary inline-flex h-12 px-8 text-[14px]"
                >
                  <Download className="h-4 w-4" />
                  수업자료 PDF 다운로드
                </a>
                <a href="#class-consult" className="premium-cta premium-cta-ghost inline-flex h-12 px-8 text-[14px]">
                  수업 상담 요청
                </a>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          7. STUDENT FIT
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="py-20 sm:py-28" style={{ background: '#f4f7ff' }}>
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <span className="eyebrow-badge">수업 대상</span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
                이런 학생에게 맞습니다
              </h2>
            </div>

            <StaggerChildren stagger={90} className="mt-12 grid gap-4 sm:grid-cols-2">
              {studentFits.map((s) => (
                <article
                  key={s.title}
                  className="rounded-[1.4rem] border border-[rgba(20,41,95,0.10)] bg-white px-7 py-6"
                  style={{ boxShadow: '0 2px 8px -2px rgba(20,41,95,0.05), 0 8px 20px -4px rgba(20,41,95,0.07)' }}
                >
                  <h3 className="break-keep text-[1rem] font-black leading-[1.38] text-[#14295F]">
                    {s.title}
                  </h3>
                  <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.78] text-[#445f7e]">
                    {s.body}
                  </p>
                </article>
              ))}
            </StaggerChildren>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          8. PHILOSOPHY
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section
          className="on-dark py-24 sm:py-36"
          style={{ background: 'linear-gradient(155deg, #0a1330 0%, #111d3f 60%, #0d1840 100%)' }}
        >
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-[10.5px] font-black tracking-[0.26em] text-[#FFB273] uppercase">
              수업 철학
            </p>
            <h2 className="mt-6 break-keep text-[clamp(1.6rem,3.4vw,2.3rem)] font-black leading-[1.22] text-white">
              국어는 결국,<br />
              설명 가능한 실력이 되어야 합니다
            </h2>
            <p className="mx-auto mt-8 max-w-[520px] break-keep text-[15.5px] font-semibold leading-[1.94] text-white/80">
              잘 읽었다고 느끼는 것과
              실제로 다시 설명할 수 있는 것은 다릅니다.
              트랙의 국어 수업은 학생이 스스로 판단 기준을 세우고,
              문제를 풀어낸 이유를 설명할 수 있는 상태까지 가는 것을 목표로 합니다.
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          9. CONSULT CTA
      ══════════════════════════════════════════ */}
      <section
        id="class-consult"
        className="on-dark scroll-mt-24 py-20 sm:py-28"
        style={{ background: 'linear-gradient(160deg, #0c1a40 0%, #14295f 55%, #0d1e4a 100%)' }}
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="overflow-hidden rounded-[2rem] border p-7 sm:p-10"
            style={{
              borderColor: 'rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 32px 64px -16px rgba(0,0,0,0.32)',
            }}
          >
            {/* heading */}
            <div className="max-w-xl">
              <span className="eyebrow-badge-light">수업 상담</span>
              <h2 className="mt-5 break-keep text-[clamp(1.75rem,3.6vw,2.4rem)] font-black leading-[1.1] text-white">
                수업이 필요한 지점부터
                <br />
                함께 확인해보세요
              </h2>
              <p className="mt-4 break-keep text-[15px] font-semibold leading-[1.88] text-white/72">
                학생의 현재 상태와 필요한 방향을 먼저 확인한 뒤,
                수업이 맞는지, 어떤 방식이 필요한지 상담을 통해 안내합니다.
              </p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              {/* Consult form */}
              <ConsultForm />

              {/* Contact info */}
              <div className="space-y-4">
                {contactItems.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-2xl border p-5"
                    style={{
                      borderColor: 'rgba(255,255,255,0.10)',
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <p className="text-[10.5px] font-black tracking-[0.18em] text-[#FFB273]">
                      {item.label}
                    </p>
                    <p className="mt-2 break-keep text-[1.05rem] font-black leading-relaxed text-white">
                      {item.value}
                    </p>
                  </article>
                ))}

                <div className="flex flex-wrap gap-3 pt-1">
                  <a href="#class-consult" className="premium-cta premium-cta-primary h-12 px-6 text-sm">
                    상담 폼 작성하기
                  </a>
                  <a href="/" className="premium-cta premium-cta-ghost h-12 px-6 text-sm">
                    메인으로 돌아가기
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          10. FOOTER
      ══════════════════════════════════════════ */}
      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />

      {/* Floating CTA */}
      <AcademyFloatingCTA />
    </main>
  );
}

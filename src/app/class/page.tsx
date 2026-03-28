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
import { unstable_noStore as noStore } from 'next/cache';

import { AcademyFloatingCTA } from '@/components/marketing/academy-floating-cta';
import { ConsultForm } from '@/components/marketing/consult-form';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MockExamProgramSection } from '@/components/marketing/mock-exam-program-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { StaggerChildren } from '@/components/marketing/stagger-children';
import { adminDb } from '@/lib/firebase-admin';
import { marketingContent } from '@/lib/marketing-content';
import { resolveMarketingCenterId } from '@/lib/marketing-center';

async function getWaitlistCount(): Promise<number> {
  noStore();
  try {
    const centerId = await resolveMarketingCenterId();
    if (!centerId) return 0;
    const snap = await adminDb
      .collection('centers')
      .doc(centerId)
      .collection('admissionWaitlist')
      .where('status', '==', 'waiting')
      .count()
      .get();
    return snap.data().count ?? 0;
  } catch {
    return 0;
  }
}

/* ─────────────────────────────────────────────────
   Static data — defined here, not in marketing-content
   to keep this page self-contained and maintainable
───────────────────────────────────────────────── */

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
    body: '지문 구조를 빠르게 잡고 핵심 개념만 남기도록 읽는 기준을 세웁니다.',
  },
  {
    icon: Target,
    title: '선지 판단 기준 정리',
    body: '정답 근거와 오답 함정을 분리해 선지 판단 속도와 정확도를 올립니다.',
  },
  {
    icon: Users,
    title: '학생별 약점 보완',
    body: '학생마다 다른 약점을 진단해 필요한 포인트만 집중 보완합니다.',
  },
  {
    icon: Layers,
    title: '자료 기반 수업',
    body: '원장 제작 자료로 수업과 복습 기준을 하나로 맞춥니다.',
  },
];

const materialPreviews = [
  {
    label: '독서 지문 분석 자료',
    tag: '지문 구조 해설',
    desc: '단락별 핵심 정보와 연결 구조를 정리한 해설 자료입니다.',
    focus: '구조와 출제 포인트를 한 장에서 확인',
  },
  {
    label: '당해년도 수능 선별 기출집',
    tag: '수능 기출 선별',
    desc: '당해년도 수능 경향에 맞춰 선별한 기출 문항 해설 자료입니다.',
    focus: '핵심 기출만 압축해 실전 기준 정리',
  },
  {
    label: '사설 모의고사 해설자료',
    tag: '사설 모의 해설',
    desc: '주요 사설 모의고사 문항의 사고 과정과 오답 포인트를 정리합니다.',
    focus: '실전 감각과 시간 운영까지 함께 점검',
  },
];

const koreanMaterialPdfPath = '/materials/2026-korean-nonfiction-2passages-commentary.pdf';
const koreanMaterialPreviewImagePath = '/materials/2026-korean-nonfiction-2passages-commentary-page1.png';

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

const mobileContactLayoutClass: Record<string, string> = {
  CONTACT: '',
  LOCATION: 'col-span-2',
  HOURS: 'col-span-2',
};

/* ─────────────────────────────────────────────────
   Page
───────────────────────────────────────────────── */

export default async function ClassPage() {
  const waitlistCount = await getWaitlistCount();
  const hourLines = marketingContent.consult.hoursLine.split(' · ').map((item) => item.trim());
  return (
    <main className="min-h-screen bg-white pb-24 text-slate-900 sm:pb-0">
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />

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
          1.5 TAGLINE QUOTE
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="py-16 sm:py-20 bg-white">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="border-l-[5px] border-[#14295F] pl-6 py-1">
              <p className="break-keep text-[clamp(1.55rem,3.2vw,2.15rem)] font-black leading-[1.45] text-[#14295F]">
                공부는 방향이 중요합니다.
                <br />
                성장의 길, <span className="text-[#FF7A16]">트랙</span>에서 시작됩니다
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

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
              단순 반복이 아니라 기준을 세우는 수업입니다.
              읽기 구조, 선지 판단, 약점 보완을 짧고 명확하게 훈련합니다.
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

      <ScrollReveal>
        <MockExamProgramSection mockExamProgram={marketingContent.mockExamProgram} />
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
                  원장이 직접 수업합니다
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
                    className="flex items-start gap-4 rounded-2xl border border-[rgba(20,41,95,0.18)] bg-[#14295F] px-5 py-4"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7A16]" />
                    <p className="break-keep text-[14.5px] font-semibold leading-[1.72] text-white">
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
          PHILOSOPHY
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
          5. TEACHING METHOD
      ══════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="py-20 sm:py-28 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <span className="eyebrow-badge">수업 방식</span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
                시험장에서 바로 쓰는
                <br />
                핵심 기준 4가지
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
                  className="rounded-[1.4rem] border px-6 py-6"
                  style={{
                    borderColor: 'rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#FF9848]" />
                    <span className="text-[10px] font-black tracking-[0.16em] text-[#FFB273] uppercase">
                      {m.tag}
                    </span>
                  </div>
                  <p className="mt-4 text-[14px] font-black text-white">{m.label}</p>
                  <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-white/75">
                    {m.desc}
                  </p>
                  <div className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
                    <p className="text-[12px] font-bold text-white/85">{m.focus}</p>
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
                  <p className="text-[12px] font-black text-[#14295F]">PDF 1페이지 미리보기</p>
                  <a href={koreanMaterialPdfPath} download className="text-[11.5px] font-black text-[#14295F]/70 hover:text-[#14295F]">
                    다운로드
                  </a>
                </div>
                <a href={koreanMaterialPdfPath} target="_blank" rel="noreferrer" className="block bg-white">
                  <img
                    src={koreanMaterialPreviewImagePath}
                    alt="수업자료 PDF 1페이지 미리보기"
                    className="h-[250px] w-full object-contain sm:h-[360px]"
                  />
                </a>
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
              <p className="mt-4 break-keep text-[15px] font-semibold leading-[1.88]" style={{ color: 'rgba(255,255,255,0.72)' }}>
                학생의 현재 상태와 필요한 방향을 먼저 확인한 뒤,
                수업이 맞는지, 어떤 방식이 필요한지 상담을 통해 안내합니다.
              </p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              {/* Consult form */}
              <ConsultForm waitlistCount={waitlistCount} />

              {/* Contact info */}
              <div className="space-y-4">
                {waitlistCount > 0 && (
                  <article
                    className="relative overflow-hidden rounded-2xl border p-5"
                    style={{
                      borderColor: 'rgba(255,122,22,0.45)',
                      background: 'linear-gradient(135deg, rgba(255,122,22,0.18) 0%, rgba(255,122,22,0.08) 100%)',
                    }}
                  >
                    <div
                      className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20"
                      style={{ background: 'radial-gradient(circle, #FF7A16 0%, transparent 70%)' }}
                    />
                    <p className="text-[10.5px] font-black tracking-[0.18em] text-[#FF7A16]">현재 수업 대기 인원</p>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-4xl font-black leading-none text-white">{waitlistCount}</span>
                      <span className="mb-0.5 text-lg font-black text-white/70">명</span>
                    </div>
                    <p className="mt-1.5 break-keep text-sm font-bold leading-relaxed text-white/80">
                      현재 수업 입학을 기다리고 있습니다.<br />
                      <span className="text-[#FF7A16]">지금 상담 신청하면 순차적으로 연락드립니다.</span>
                    </p>
                  </article>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {contactItems.map((item) => (
                    <article
                      key={item.label}
                      className={`rounded-[1.25rem] border p-4 sm:rounded-2xl sm:p-5 ${mobileContactLayoutClass[item.label] ?? ''}`}
                      style={{
                        borderColor: 'rgba(255,255,255,0.10)',
                        background: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <p className="text-[10px] font-black tracking-[0.17em] text-[#FFB273] sm:text-[10.5px]">
                        {item.label}
                      </p>
                      {item.label === 'HOURS' ? (
                        <div className="mt-2 space-y-1.5 sm:space-y-2">
                          {hourLines.map((line) => (
                            <p
                              key={line}
                              className="whitespace-nowrap text-[11px] font-black leading-[1.35] tracking-[-0.03em] text-white sm:text-[1.05rem] sm:leading-relaxed sm:tracking-normal"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 break-keep text-[0.94rem] font-black leading-[1.65] text-white sm:text-[1.05rem] sm:leading-relaxed">
                          {item.value}
                        </p>
                      )}
                    </article>
                  ))}
                </div>

                <div className="grid gap-2.5 pt-1 sm:flex sm:flex-wrap">
                  <a href="#class-consult" className="premium-cta premium-cta-primary h-12 w-full px-6 text-sm sm:w-auto">
                    상담 폼 작성하기
                  </a>
                  <a href="/" className="premium-cta premium-cta-ghost h-12 w-full px-6 text-sm sm:w-auto">
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

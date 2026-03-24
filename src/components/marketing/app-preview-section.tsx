'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

import { StaggerChildren } from './stagger-children';

type AppPreviewSectionProps = {
  appSystem: MarketingContent['appSystem'];
};

const actualProofs = [
  {
    label: '실제 피드백',
    title: '카카오 피드백 일부 공개',
    image: '/marketing/reviews/kakao-feedback-1-redacted.jpg',
  },
  {
    label: '실제 피드백',
    title: '카카오 피드백 일부 공개',
    image: '/marketing/reviews/kakao-feedback-2-redacted.jpg',
  },
  {
    label: '실제 피드백',
    title: '카카오 피드백 일부 공개',
    image: '/marketing/reviews/kakao-feedback-3-redacted.jpg',
  },
];

export function AppPreviewSection({ appSystem }: AppPreviewSectionProps) {
  return (
    <section
      id="app"
      className="scroll-mt-20 py-12 sm:py-16"
      style={{ background: 'linear-gradient(180deg, #edf1fb 0%, #ffffff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow-badge">EVIDENCE LIBRARY</span>
          <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
            웹앱을 소개하지 않고
            <br />
            실제 흐름처럼 보여드립니다
          </h2>
          <p className="mt-3 break-keep text-[14px] font-bold leading-[1.7] text-[#384f6a]">
            학생, 학부모, 운영자 화면이 각각 무엇을 보여주고 어떤 행동을 만들게 하는지 화면 단위로 공개합니다.
          </p>
        </div>

        <StaggerChildren stagger={120} className="mt-9 grid gap-5 lg:grid-cols-3">
          {appSystem.captures.map((capture) => (
            <article
              key={capture.mode}
              className="overflow-hidden rounded-[1.5rem] border border-[rgba(20,41,95,0.12)] bg-white shadow-[0_16px_36px_rgba(20,41,95,0.08)]"
            >
              <div className="relative aspect-[1.08/1] border-b border-[rgba(20,41,95,0.08)] bg-[#0D1732]">
                <Image src={capture.image} alt={capture.title} fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" />
              </div>
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">{capture.mode}</p>
                  <span className="rounded-full bg-[#F5F8FF] px-3 py-1 text-[10px] font-black text-[#14295F]/55">
                    {capture.proofType === 'actual' ? '실제 캡처' : '재구성 캡처'}
                  </span>
                </div>
                <h3 className="mt-2 break-keep text-[1.1rem] font-black leading-[1.35] text-[#14295F]">{capture.title}</h3>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-slate-500">{capture.description}</p>
                <div className="mt-4 rounded-[1rem] bg-[#F8FBFF] px-4 py-3 text-[11px] font-black text-[#14295F]">
                  {capture.callout}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(20,41,95,0.07)] bg-[#14295F]/3 px-5 py-4">
                <Link
                  href={capture.href}
                  className="inline-flex min-w-0 items-center gap-2 text-[13px] font-black text-[#14295F] transition-all duration-200 hover:gap-3"
                >
                  이 화면 자세히 보기
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <span className="text-[11px] font-black text-[#14295F]/42">로그인 없이 대표 흐름 확인</span>
              </div>
            </article>
          ))}
        </StaggerChildren>

        <div className="mt-8 rounded-[1.7rem] border border-[#14295F]/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">ACTUAL PROOF</p>
              <p className="mt-1 break-keep text-[1.2rem] font-black text-[#14295F]">
                실제 피드백과 결과 자산도 함께 공개합니다
              </p>
            </div>
            <Link href="/experience" className="premium-cta premium-cta-primary h-10 px-5 text-sm">
              웹앱 증거 라이브러리 보기
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {actualProofs.map((proof) => (
              <article key={`${proof.label}-${proof.image}`} className="overflow-hidden rounded-[1.2rem] border border-[#14295F]/10 bg-[#F8FBFF]">
                <div className="relative aspect-[1.28/1]">
                  <Image src={proof.image} alt={proof.title} fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" />
                </div>
                <div className="px-4 py-4">
                  <p className="text-[10px] font-black tracking-[0.16em] text-[#FF7A16]">{proof.label}</p>
                  <p className="mt-1 text-[14px] font-black text-[#14295F]">{proof.title}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

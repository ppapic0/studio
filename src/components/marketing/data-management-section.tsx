import { Database, Eye, MessageSquare } from 'lucide-react';

import { StaggerChildren } from './stagger-children';

const cards = [
  {
    icon: Database,
    step: '기록',
    heading: '자동으로 기록됩니다',
    body: '출입, 공부 시간, 실행 상태가 앱 안에 차곡차곡 남습니다.',
    tags: ['출입 기록', '공부 시간', '실행 흐름'],
  },
  {
    icon: Eye,
    step: '확인',
    heading: '각자의 화면에서 확인합니다',
    body: '학생과 학부모는 각자의 화면에서 필요한 흐름을 바로 확인합니다.',
    tags: ['학생 화면', '학부모 화면', '누적 데이터'],
  },
  {
    icon: MessageSquare,
    step: '관리',
    heading: '기록이 관리로 이어집니다',
    body: '쌓인 기록은 상담, 점검, 피드백의 기준으로 이어집니다.',
    tags: ['상담 연결', '피드백', '점검'],
  },
];

export function DataManagementSection() {
  return (
    <section
      id="data"
      className="scroll-mt-20 py-12 sm:py-16"
      style={{ background: 'linear-gradient(180deg, #f2f6ff 0%, #edf1fb 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mx-auto max-w-xl text-center">
          <span className="eyebrow-badge">DATA SYSTEM</span>
          <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
            기록이 쌓이고,
            <br />
            데이터로 확인됩니다
          </h2>
          <p className="mt-3 break-keep text-[14px] font-bold leading-[1.7] text-[#384f6a]">
            출입 기록, 공부 시간, 실행 상태가 자동으로 연결됩니다.
            <br className="hidden sm:block" />
            쌓인 기록은 상담과 피드백의 기준으로 이어집니다.
          </p>
        </div>

        {/* 3-step cards */}
        <StaggerChildren stagger={100} className="mt-9 grid gap-4 md:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <article
                key={card.step}
                className="relative rounded-[1.25rem] border border-[rgba(20,41,95,0.08)] bg-white p-5"
              >
                {/* Icon + step number */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#14295F]/6">
                    <Icon className="h-4 w-4 text-[#14295F]/65" />
                  </div>
                  <span className="text-[1.9rem] font-black leading-none text-[#14295F]/6 select-none">
                    0{i + 1}
                  </span>
                </div>

                {/* Label + heading + body */}
                <p className="text-[10.5px] font-black uppercase tracking-[0.18em] text-[#FF7A16]">
                  {card.step}
                </p>
                <h3 className="mt-1.5 text-[1.05rem] font-black leading-[1.3] text-[#14295F]">
                  {card.heading}
                </h3>
                <p className="mt-2 text-[13px] font-semibold leading-[1.68] text-slate-500">
                  {card.body}
                </p>

                {/* Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-[#14295F]/5 px-2 py-0.5 text-[11px] font-black text-[#14295F]/55"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </StaggerChildren>
      </div>
    </section>
  );
}

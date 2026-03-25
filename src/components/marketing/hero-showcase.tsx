import { ArrowRight, CalendarDays, Clock3, MessageSquare, Sparkles } from 'lucide-react';

const weeklyBars = [
  { label: '월', value: 56 },
  { label: '화', value: 62 },
  { label: '수', value: 68 },
  { label: '목', value: 76 },
  { label: '금', value: 84 },
  { label: '토', value: 88 },
];

const routineItems = [
  { label: '독서 루틴', status: '완료', tone: 'emerald' },
  { label: '문학 오답 정리', status: '진행 중', tone: 'orange' },
  { label: '피드백 확인', status: '확인 완료', tone: 'navy' },
] as const;

function toneClassMap(tone: (typeof routineItems)[number]['tone']) {
  if (tone === 'emerald') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'orange') return 'bg-[#FFF3E8] text-[#B55200]';
  return 'bg-[#EEF3FF] text-[#14295F]';
}

export function HeroShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div className="pointer-events-none absolute -left-8 top-8 h-32 w-32 rounded-full bg-[#FF7A16]/18 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-2 h-40 w-40 rounded-full bg-[#244ea8]/24 blur-3xl" />

      <article className="relative overflow-hidden rounded-[2rem] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_60px_rgba(4,11,29,0.34)] backdrop-blur-md sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(255,255,255,0.18),transparent_22%),radial-gradient(circle_at_92%_10%,rgba(255,122,22,0.16),transparent_18%)]" />

        <div className="relative rounded-[1.55rem] border border-white/12 bg-[#0f1d42]/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FF7A16]/18 text-[#FFB273]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-[0.18em] text-white/[0.52]">STUDENT MODE PREVIEW</p>
                <p className="mt-1 text-[1rem] font-black leading-[1.25] text-white">학생 화면에서 루틴과 흐름을 바로 확인</p>
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black text-[#FFB273]">
              실제 앱 구조
            </div>
          </div>

          <div className="mt-4 rounded-[1.35rem] bg-[linear-gradient(140deg,#FF8B2A_0%,#D95D12_68%,#A93B0B_100%)] p-4 text-white shadow-[0_14px_30px_rgba(217,93,18,0.30)]">
            <p className="text-[10px] font-black tracking-[0.18em] text-white/[0.72]">TODAY FOCUS</p>
            <p className="mt-2 break-keep text-[1.25rem] font-black leading-[1.2] sm:text-[1.4rem]">
              오늘도 같은 방향으로
              <br />
              루틴을 이어갑니다
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-black text-white">공부시간 5h 42m</span>
              <span className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-black text-white">목표 달성 93%</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] text-white/[0.46]">오늘의 루틴</p>
                  <p className="mt-1 text-[14px] font-black text-white">해야 할 흐름이 한 눈에 보입니다</p>
                </div>
                <CalendarDays className="h-4 w-4 shrink-0 text-[#FFB273]" />
              </div>

              <div className="mt-3 space-y-2.5">
                {routineItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-[1rem] border border-white/8 bg-[#09152F]/88 px-3 py-3"
                  >
                    <p className="text-[12px] font-black text-white">{item.label}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${toneClassMap(item.tone)}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] text-white/[0.46]">주간 흐름</p>
                  <p className="mt-1 text-[14px] font-black text-white">꾸준히 올라가는 학습 패턴</p>
                </div>
                <Clock3 className="h-4 w-4 shrink-0 text-[#FFB273]" />
              </div>

              <div className="mt-4 flex h-28 items-end gap-2">
                {weeklyBars.map((bar, index) => (
                  <div key={bar.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative flex h-full w-full items-end">
                      <div
                        className={`w-full rounded-t-[0.9rem] ${
                          index === weeklyBars.length - 1
                            ? 'bg-[linear-gradient(180deg,#FFB36E_0%,#FF7A16_100%)]'
                            : 'bg-[linear-gradient(180deg,#456CC7_0%,#203F86_100%)]'
                        }`}
                        style={{ height: `${bar.value}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-white/[0.48]">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-[#09152F] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] text-[#FFB273]">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] text-white/[0.46]">피드백</p>
                  <p className="mt-1 break-keep text-[13px] font-semibold leading-[1.65] text-white/[0.82]">
                    공부시간이 안정적으로 올라오고 있어요. 같은 시작 시간을 유지하면 다음 주 흐름이 더 단단해집니다.
                  </p>
                </div>
              </div>
              <a
                href="/go/experience?placement=hero_student_preview&mode=student"
                className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-black text-[#FFB273]"
              >
                학생 화면 보기
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

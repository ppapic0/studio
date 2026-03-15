import Link from 'next/link';
import {
  Brain,
  CheckCircle2,
  FileText,
  Files,
  Library,
  MessageSquareQuote,
  NotebookPen,
  PenTool,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

const differentiationCards = [
  {
    icon: Brain,
    title: '예측하며 읽는 비문학',
    description:
      'A 개념이 나오면 반대되는 B를 먼저 떠올리고, 지문 구조를 능동적으로 추적하는 방식으로 사고력을 키웁니다.',
  },
  {
    icon: Users,
    title: '소수정예 토론형 수업',
    description:
      '수업 중 특정 입장을 비판해보고 의견을 교환하며, 논리적 사고와 선택지 판단 근거를 함께 훈련합니다.',
  },
  {
    icon: Target,
    title: '원장 직강 풀이 체계',
    description:
      '상위권 학생이 실제 시험장에서 바로 적용할 수 있는 문제풀이 기준과 판단 루틴을 체계적으로 전달합니다.',
  },
  {
    icon: Files,
    title: '직접 제작 해설서',
    description:
      '시중 해설을 반복하지 않고, 직접 제작한 해설서와 연계지문으로 수업 포인트를 더 깊고 정확하게 정리합니다.',
  },
  {
    icon: NotebookPen,
    title: '언어와 매체 문법 완성',
    description:
      '문법 개념을 처음부터 끝까지 판서로 풀어낼 수 있도록 구조화해, 헷갈리는 개념을 문제 적용까지 연결합니다.',
  },
  {
    icon: Library,
    title: '학교별 내신 맞춤 대응',
    description:
      '학교 분석지, 동형모의고사, 직접 출제 문항으로 학교별 시험 특성을 반영한 실전형 내신 대비를 진행합니다.',
  },
];

const nonFictionSteps = [
  {
    step: 'STEP 1',
    title: '핵심 개념 포착',
    description: '지문의 주장과 개념 축을 먼저 세우고, 문장 해석보다 구조를 먼저 잡습니다.',
  },
  {
    step: 'STEP 2',
    title: '반대 개념·예외 예측',
    description: '한 입장이 나오면 대조 개념, 반례, 예외를 동시에 떠올리는 사고를 훈련합니다.',
  },
  {
    step: 'STEP 3',
    title: '출제 포인트 가정',
    description: '읽는 동시에 문제로 나올 지점을 가정하며, 근거 중심으로 선택지를 준비합니다.',
  },
  {
    step: 'STEP 4',
    title: '선택지 판단력 강화',
    description: '오답 유형을 근거로 분류해 빠르고 정확하게 판단하는 시험장용 루틴을 완성합니다.',
  },
];

const literatureCards = [
  {
    title: '기출 문학 풀이법',
    description: '작품 해설을 길게 듣기보다, 기출에서 반복되는 질문 구조와 판단 기준을 먼저 익힙니다.',
  },
  {
    title: '긍정·부정 표시 표현법',
    description: '선택지와 선지 근거에서 긍정·부정 표현을 빠르게 표시해 오판 가능성을 줄입니다.',
  },
  {
    title: '동그라미·별표·엑스 표시법',
    description: '시험장에서 바로 쓸 수 있는 표식 체계를 훈련해, 읽기와 판단을 동시에 정리합니다.',
  },
];

const languageMediaTags = ['개념 구조화', '판서 중심 설명', '문제 적용 훈련', '반복 정리 가능'];

const contentCards = [
  {
    title: '직접 제작 해설서',
    description: '수업 핵심 논리를 그대로 담아 복습 기준이 흔들리지 않도록 설계합니다.',
  },
  {
    title: '직접 제작 연계지문',
    description: '수업에서 다룬 개념이 실제로 확장되도록 연결 지문을 직접 구성합니다.',
  },
  {
    title: '시중 교재 포인트 보완',
    description: '학생이 놓치기 쉬운 함정과 논점 공백을 보완 문항으로 채워 수업 밀도를 높입니다.',
  },
  {
    title: '필요 문항 직접 출제',
    description: '학생 수준과 목표에 맞춰 필요한 문제를 직접 출제해 실전 감각을 빠르게 끌어올립니다.',
  },
];

const schoolPrepItems = [
  '학교별 분석지 작성',
  '학교별 동형모의고사 제작',
  '직접 출제 문항 활용',
  '학교별 시험 특성 반영',
];

export function TrackKoreanMethodSection() {
  return (
    <section
      id="korean-class"
      className="section-bg-soft scroll-mt-24 py-16 sm:py-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="marketing-card-dark space-y-7 p-6 text-white sm:p-8 lg:p-10">
          <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-black tracking-[0.14em] text-white/95 uppercase">
                수능 국어 전문 · 원장 직강
              </span>
              <h2 className="font-aggro-display break-keep text-[clamp(1.9rem,4.8vw,3.2rem)] font-black leading-[1.12]">
                읽는 힘을 넘어서,
                <br />
                생각하는 힘으로 푸는 수능 국어
              </h2>
              <p className="max-w-[680px] break-keep text-[14px] font-semibold leading-[1.8] text-white/85 sm:text-[15px]">
                수능 국어는 단순한 독해가 아니라, 빠르고 정확한 사고력의 싸움입니다.
                트랙 국어는 지문을 읽는 법이 아니라 문제를 바라보는 사고의 틀을 훈련합니다.
                비문학, 문학, 언어와 매체, 내신까지 과목별로 수업 방식을 다르게 설계해 실전 적용력을 완성합니다.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="#korean-method-detail" className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                  수업 방식 자세히 보기
                </a>
                <Link href="#consult" className="premium-cta premium-cta-ghost h-11 px-6 text-sm">
                  상담 문의하기
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                '비문학 사고력 확장형 수업',
                '문학 문제풀이 체계화',
                '언매·내신 직접 제작 자료 제공',
              ].map((point) => (
                <article key={point} className="rounded-2xl border border-white/14 bg-white/8 px-4 py-4">
                  <p className="text-[13.5px] font-black leading-[1.45] text-white">{point}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div id="korean-method-detail" className="mt-14">
          <div className="text-center">
            <span className="inline-flex items-center rounded-full border border-[#14295F]/12 bg-white px-3 py-1 text-[11px] font-black tracking-[0.12em] text-[#14295F]/75 uppercase">
              Why Track Korean
            </span>
            <h3 className="mt-3 break-keep text-[clamp(1.5rem,3vw,2.15rem)] font-black leading-[1.2] text-[#14295F]">
              일반 강의식 수업과 다른,
              <br />
              트랙 국어의 핵심 차별점
            </h3>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {differentiationCards.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="marketing-card p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14295F]/8 text-[#14295F]">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="mt-4 break-keep text-[1.02rem] font-black text-[#14295F]">{title}</h4>
                <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.72] text-[#425a77]">{description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="marketing-card p-6 sm:p-7">
            <span className="inline-flex items-center rounded-full bg-[#FF7A16]/10 px-3 py-1 text-[11px] font-black tracking-[0.1em] text-[#d86a10] uppercase">
              비문학 수업 방식
            </span>
            <h3 className="mt-3 break-keep text-[clamp(1.35rem,2.8vw,1.95rem)] font-black leading-[1.28] text-[#14295F]">
              비문학은 이해가 아니라
              <br />
              예측하는 사고로 풀어야 합니다
            </h3>
            <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.82] text-[#3c5572] sm:text-[14.5px]">
              트랙 국어의 비문학 수업은 문장을 따라가는 수업이 아닙니다.
              지문 안에서 하나의 주장이나 개념이 나오면, 그와 대비되는 관점·예외·한계를 먼저 떠올리게 합니다.
              학생은 해설을 수동적으로 듣는 것이 아니라 구조를 예측하고 출제 포인트를 생각하며 읽는 훈련을 하게 됩니다.
            </p>
            <p className="mt-3 break-keep text-[14px] font-black text-[#14295F]">
              빠른 독해 + 높은 사고력 = 수능 국어 경쟁력
            </p>
          </article>

          <div className="grid gap-3">
            {nonFictionSteps.map((item) => (
              <article
                key={item.step}
                className="marketing-card-soft rounded-2xl p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FF7A16]">{item.step}</p>
                <h4 className="mt-1 text-[15px] font-black text-[#14295F]">{item.title}</h4>
                <p className="mt-1.5 break-keep text-[12.8px] font-semibold leading-[1.66] text-[#47617e]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[0.94fr_1.06fr]">
          <article className="marketing-card-dark p-6 text-white sm:p-7">
            <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-[11px] font-black tracking-[0.1em] uppercase">
              문학 수업 방식
            </span>
            <h3 className="mt-3 break-keep text-[clamp(1.35rem,2.6vw,1.9rem)] font-black leading-[1.28]">
              문학은 감상이 아니라,
              <br />
              표시하고 판단하는 풀이 훈련입니다
            </h3>
            <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.8] text-white/85">
              작품 해설을 길게 듣기보다, 문제에서 무엇을 표시하고 어떤 기준으로 판단할지를 먼저 훈련합니다.
              기출 문학 풀이법과 표식 루틴을 익혀 시험장에서 바로 적용 가능한 문제풀이 중심 수업을 진행합니다.
            </p>
            <div className="mt-5 rounded-xl border border-white/16 bg-white/8 p-4">
              <p className="text-[12px] font-black text-white/92">문학 풀이 체크리스트</p>
              <ul className="mt-2 space-y-2">
                {[
                  '지문 읽기 전 문제 유형 먼저 확인',
                  '긍정·부정 표현 표시 후 선지 비교',
                  '동그라미·별표·엑스로 근거 우선순위 정리',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[12.5px] font-semibold text-white/86">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ffb26f]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {literatureCards.map((card) => (
              <article
                key={card.title}
                className="marketing-card p-5"
              >
                <h4 className="break-keep text-[15px] font-black text-[#14295F]">{card.title}</h4>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.68] text-[#47607b]">{card.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.03fr_0.97fr]">
          <article className="marketing-card p-6 sm:p-7">
            <span className="inline-flex items-center rounded-full bg-[#14295F]/8 px-3 py-1 text-[11px] font-black tracking-[0.1em] text-[#14295F] uppercase">
              언어와 매체
            </span>
            <h3 className="mt-3 break-keep text-[clamp(1.28rem,2.5vw,1.85rem)] font-black leading-[1.28] text-[#14295F]">
              언어와 매체, 개념을 끝까지 밀어붙이는 문법 수업
            </h3>
            <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.8] text-[#3d5673]">
              언어와 매체는 암기만으로 안정적인 점수를 만들기 어렵습니다.
              트랙 국어는 문법 개념을 구조적으로 연결하고, 처음부터 끝까지 판서로 풀어낼 수 있을 정도의 명확한 체계로 수업을 진행합니다.
              단순 정리가 아니라 문제에 바로 적용되는 방식으로 정리해 점수로 이어지게 합니다.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {languageMediaTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#14295F]/14 bg-[#f2f6ff] px-3 py-1.5 text-[12px] font-black text-[#14295F]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>

          <article className="marketing-card-soft p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-black text-[#14295F]">판서 흐름 미리보기</p>
              <span className="inline-flex items-center rounded-full bg-[#FF7A16]/12 px-2.5 py-1 text-[10px] font-black text-[#d86a10]">
                추후 수업 스크린샷 삽입
              </span>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-[#14295F]/24 bg-[#f7faff] p-5 text-center">
              <PenTool className="mx-auto h-6 w-6 text-[#14295F]/45" />
              <p className="mt-2 text-[12.5px] font-semibold text-[#58708d]">
                문법 판서 예시 이미지 / 강의 화면 캡처 자리
              </p>
            </div>
          </article>
        </div>

        <div className="marketing-card mt-14 p-6 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.03fr_0.97fr] lg:items-start">
            <div>
              <span className="inline-flex items-center rounded-full bg-[#FF7A16]/10 px-3 py-1 text-[11px] font-black tracking-[0.12em] text-[#d86a10] uppercase">
                자료 제작력 / 콘텐츠
              </span>
              <h3 className="mt-3 break-keep text-[clamp(1.3rem,2.8vw,1.9rem)] font-black leading-[1.28] text-[#14295F]">
                수업만 하는 것이 아니라,
                <br />
                자료까지 직접 설계합니다
              </h3>
              <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.82] text-[#3f5874]">
                트랙 국어는 시중 교재를 그대로 소비하지 않습니다.
                수업에서 필요한 해설서, 연계지문, 보완 문항을 직접 제작해 학생이 놓치기 쉬운 포인트를 정교하게 다룹니다.
                이 자료 제작력이 수업 밀도와 완성도를 안정적으로 끌어올립니다.
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-[#14295F]/24 bg-[#f8fbff] p-5">
              <div className="flex items-center gap-2 text-[12px] font-black text-[#14295F]">
                <Sparkles className="h-4 w-4 text-[#FF7A16]" />
                자료 썸네일/해설서 미리보기 슬롯
              </div>
              <p className="mt-2 break-keep text-[12.5px] font-semibold leading-[1.7] text-[#5f7690]">
                추후 PDF 커버, 해설서 샘플 이미지, 연계지문 카드 썸네일을 여기에 추가하면 됩니다.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {contentCards.map((card) => (
              <article key={card.title} className="marketing-card-soft rounded-2xl p-5">
                <p className="inline-flex rounded-full bg-[#14295F]/8 px-2.5 py-1 text-[10px] font-black tracking-[0.1em] text-[#14295F] uppercase">
                  직접 제작
                </p>
                <h4 className="mt-3 break-keep text-[15px] font-black text-[#14295F]">{card.title}</h4>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.68] text-[#4d6681]">{card.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="marketing-card-dark p-6 text-white sm:p-7">
            <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-[11px] font-black tracking-[0.1em] uppercase">
              내신 대비
            </span>
            <h3 className="mt-3 break-keep text-[clamp(1.3rem,2.7vw,1.9rem)] font-black leading-[1.28]">
              학교별 특성을 반영한,
              <br />
              정확한 내신 대비
            </h3>
            <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.82] text-white/86">
              내신은 학교마다 출제 방식과 포인트가 다르기 때문에 일괄적인 대비로는 한계가 있습니다.
              트랙 국어는 학교별 분석지와 동형모의고사를 제작하고, 필요한 문항은 직접 출제해 실제 시험 환경에 맞춘 대비를 진행합니다.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {schoolPrepItems.map((item) => (
                <div key={item} className="rounded-xl border border-white/16 bg-white/8 px-3 py-2.5 text-[12.5px] font-black text-white/92">
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="marketing-card-soft p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[13px] font-black text-[#14295F]">
              <MessageSquareQuote className="h-4.5 w-4.5 text-[#FF7A16]" />
              학교별 자료 샘플 영역
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-[#14295F]/24 bg-[#f7faff] p-6 text-center">
              <FileText className="mx-auto h-6 w-6 text-[#14295F]/45" />
              <p className="mt-2 text-[12.5px] font-semibold text-[#58708d]">
                학교 분석지 / 동형모의고사 샘플 이미지 삽입 자리
              </p>
            </div>
          </article>
        </div>

        <div className="marketing-card-dark mt-14 p-7 text-white sm:p-9">
          <p className="text-[11px] font-black tracking-[0.16em] text-[#ffbf84] uppercase">Track Korean CTA</p>
          <h3 className="mt-3 break-keep text-[clamp(1.45rem,3.2vw,2.2rem)] font-black leading-[1.2]">
            국어 성적을 바꾸는 건
            <br />
            결국 읽는 방식과 생각하는 방식입니다
          </h3>
          <p className="mt-4 max-w-[760px] break-keep text-[14px] font-semibold leading-[1.8] text-white/86 sm:text-[14.5px]">
            원장 직강, 직접 제작 자료, 사고력 중심 수업으로 수능 국어와 내신 국어를 더 밀도 있게 준비하세요.
            상담을 통해 현재 상태에 맞는 학습 루틴과 수업 방향을 함께 설계해드립니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="#consult" className="premium-cta premium-cta-primary h-11 px-6 text-sm">
              상담 문의하기
            </Link>
            <a href="#korean-method-detail" className="premium-cta premium-cta-ghost h-11 px-6 text-sm">
              수업 방식 더 보기
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

import { ArrowRight, LogIn, Smartphone, Users } from 'lucide-react';

export function EntryGatewaySection() {
  return (
    <section className="bg-white pb-10 pt-3 sm:pb-14">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="marketing-card overflow-hidden p-5 sm:p-6">
          {/* Top accent line */}
          <div className="mb-5 h-0.5 w-full rounded-full bg-gradient-to-r from-[#14295F] via-[#FF7A16] to-transparent opacity-20" />

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow-badge">QUICK ENTRANCE</span>
              <h2 className="mt-3 break-keep text-[1.85rem] font-black leading-[1.10] tracking-[-0.04em] text-[#14295F] sm:text-[2.2rem]">
                기존 재원생 입구와 체험 입구를 분리했습니다
              </h2>
              <p className="mt-3 max-w-3xl break-keep text-[14.5px] font-medium leading-[1.82] text-slate-600">
                바로 로그인하려는 재원생과, 학생·학부모 체험을 먼저 보려는 신규 방문자를
                분리해 운영 흐름과 방문 데이터를 더 정확하게 확인합니다.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <a
              href="/go/login?placement=gateway_login"
              className="group app-depth-card-warm premium-surface-button overflow-hidden p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{
                    background: 'linear-gradient(145deg, #ff9d4e, #e86800)',
                    boxShadow: '0 8px 20px rgba(255,122,22,0.32)',
                  }}
                >
                  <LogIn className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-[#FF7A16]/25 bg-[#FFF3E8] px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#B85A00]">
                  RETURNING USER
                </span>
              </div>
              <p className="mt-5 text-[1.5rem] font-black tracking-[-0.04em] text-[#14295F]">
                기존 재원생은 바로 로그인
              </p>
              <p className="mt-3 break-keep text-sm font-medium leading-[1.78] text-slate-600">
                학생, 학부모, 선생님 모두 기존 계정으로 바로 웹앱에 들어갈 수 있도록
                가장 빠른 입구를 따로 두었습니다.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#14295F]">
                웹앱 로그인으로 이동
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/go/experience?placement=gateway_experience"
              className="group app-depth-card premium-surface-button overflow-hidden p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{
                    background: 'linear-gradient(145deg, #1e4898, #14295f)',
                    boxShadow: '0 8px 20px rgba(20,41,95,0.28)',
                  }}
                >
                  <Smartphone className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-[#14295F]/12 bg-[#F3F7FF] px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#14295F]">
                  STUDENT · PARENT DEMO
                </span>
              </div>
              <p className="mt-5 text-[1.5rem] font-black tracking-[-0.04em] text-[#14295F]">
                처음 방문했다면 체험부터 확인
              </p>
              <p className="mt-3 break-keep text-sm font-medium leading-[1.78] text-slate-600">
                학생 모드와 학부모 모드를 실제 앱처럼 확인하고, 그래프·기록·수납·알림
                흐름까지 한 번에 체험할 수 있습니다.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#14295F]/10 bg-[#F3F7FF] px-3 py-1.5 text-[11px] font-black text-[#14295F]">
                  <Users className="h-3.5 w-3.5 text-[#FF7A16]" />
                  학생 / 학부모 분리 체험
                </span>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#14295F]">
                웹앱 체험으로 이동
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

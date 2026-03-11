import { TrackLogo } from '@/components/ui/track-logo';

type AuthFormWrapperProps = {
  children: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
};

export function AuthFormWrapper({
  children,
  title,
  subtitle,
}: AuthFormWrapperProps) {
  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="mx-auto grid w-full max-w-[400px] gap-8">
          <div className="grid gap-3 text-center">
            <div className="mb-2">{title}</div>
            <p className="text-balance text-muted-foreground font-medium">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>

      <div className="hidden lg:block relative overflow-hidden bg-[#14295F]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,122,22,0.28),transparent_38%),radial-gradient(circle_at_82%_80%,rgba(255,122,22,0.16),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#14295F_0%,#10214A_54%,#0D1A3A_100%)] opacity-95" />

        <div className="absolute -left-10 top-10 rounded-full border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
          <TrackLogo variant="mark" className="h-10 w-auto opacity-90" />
        </div>
        <div className="absolute -right-8 bottom-14 rounded-full border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
          <TrackLogo variant="mark" className="h-8 w-auto opacity-80" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-sm w-fit">
            <TrackLogo className="h-12 w-auto" />
          </div>

          <div className="max-w-md space-y-4 text-white">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-white/60">Track Intelligence</p>
            <h3 className="text-5xl font-black tracking-tight leading-tight">아이의 시간을 지키는 학습 운영 시스템</h3>
            <p className="text-sm font-semibold text-white/70 leading-relaxed">
              첫 화면부터 불필요한 사진 없이, 브랜드 로고와 핵심 메시지 중심으로 깔끔하게 구성했습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
            {subtitle.trim() ? <p className="text-balance text-muted-foreground font-medium">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>

      <div className="hidden lg:block relative overflow-hidden bg-[#14295F]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-5%,#26437F_0%,#1A2F66_38%,#12244F_65%,#0B1737_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_28%,rgba(255,154,31,0.42),transparent_20%),radial-gradient(circle_at_76%_31%,rgba(255,122,22,0.24),transparent_26%),radial-gradient(circle_at_20%_20%,rgba(255,184,77,0.14),transparent_18%),radial-gradient(circle_at_16%_72%,rgba(255,184,77,0.12),transparent_16%),radial-gradient(circle_at_88%_72%,rgba(255,184,77,0.1),transparent_14%)]" />

        <div className="absolute inset-0">
          <div className="absolute left-[15%] top-[16%] h-24 w-24 rounded-full border border-[#ffb25f]/45 shadow-[0_0_28px_rgba(255,154,31,0.35)]" />
          <div className="absolute left-[17.5%] top-[18.5%] h-[4.75rem] w-[4.75rem] rounded-full border border-[#ff9a1f]/50" />
          <div className="absolute left-[73%] top-[62%] h-20 w-20 rounded-full border border-[#ffb25f]/35 shadow-[0_0_24px_rgba(255,154,31,0.22)]" />
          <div className="absolute left-[75%] top-[64%] h-14 w-14 rounded-full border border-[#ff9a1f]/40" />
          <div className="absolute left-[62%] top-[14%] h-3 w-3 rounded-full bg-[#ffb347] shadow-[0_0_18px_rgba(255,154,31,0.8)]" />
          <div className="absolute left-[86%] top-[28%] h-2.5 w-2.5 rounded-full bg-[#ffd48a] shadow-[0_0_12px_rgba(255,184,77,0.75)]" />
          <div className="absolute left-[33%] top-[75%] h-2 w-2 rounded-full bg-[#ffb347] shadow-[0_0_10px_rgba(255,154,31,0.75)]" />
          <div className="absolute left-[58%] top-[52%] h-2 w-2 rounded-full bg-[#ffd48a] shadow-[0_0_10px_rgba(255,184,77,0.7)]" />
        </div>

        <div className="relative z-10 flex h-full items-center justify-center p-12">
          <div className="relative flex h-[24rem] w-[24rem] items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,154,31,0.56)_0%,rgba(255,154,31,0.3)_40%,rgba(255,154,31,0)_72%)]" />
            <div className="absolute inset-[15%] rounded-full border border-[#ffb25f]/45" />
            <div className="absolute inset-[26%] rounded-full border border-[#ff9a1f]/42" />
            <TrackLogo variant="mark" className="relative z-10 h-52 w-auto drop-shadow-[0_24px_40px_rgba(3,12,35,0.42)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

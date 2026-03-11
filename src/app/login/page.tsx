import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { LoginForm } from '@/components/auth/login-form';
import { TrackLogo } from '@/components/ui/track-logo';

export default function LoginPage() {
  return (
    <AuthFormWrapper
      title={
        <div className="flex flex-col items-center gap-4">
          <TrackLogo variant="mark" className="h-24 w-auto animate-in fade-in slide-in-from-top-4 duration-700" />
          <span className="text-lg font-black tracking-tight text-[#14295F]">오늘의 몰입을 시작해보세요</span>
        </div>
      }
      subtitle="집중과 성장이 이어지는 학습 운영 플랫폼"
    >
      <LoginForm />
    </AuthFormWrapper>
  );
}

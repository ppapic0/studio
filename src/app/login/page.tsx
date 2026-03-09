import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { LoginForm } from '@/components/auth/login-form';
import { TrackLogo } from '@/components/ui/track-logo';

export default function LoginPage() {
  return (
    <AuthFormWrapper
      title={
        <div className="flex flex-col items-center gap-4">
          <TrackLogo className="h-20 w-auto animate-in fade-in slide-in-from-top-4 duration-700" />
          <span className="text-lg font-black tracking-tight text-[#14295F]">다시 오신 것을 환영합니다</span>
        </div>
      }
      subtitle="가장 조용한 곳에서, 당신의 성장이 시작되는 공간"
    >
      <LoginForm />
    </AuthFormWrapper>
  );
}

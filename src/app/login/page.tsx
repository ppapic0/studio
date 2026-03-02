import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <AuthFormWrapper
      title={
        <div className="flex flex-col items-center gap-1">
          <span className="text-7xl font-black italic tracking-tighter text-accent drop-shadow-sm animate-in fade-in slide-in-from-top-4 duration-1000">
            트랙학습센터
          </span>
          <span className="text-xl font-bold tracking-tight opacity-80 mt-2">
            에 다시 오신 것을 환영합니다
          </span>
        </div>
      }
      subtitle="가장 조용한 곳에서, 당신의 성장이 시작되는 공간"
    >
      <LoginForm />
    </AuthFormWrapper>
  );
}

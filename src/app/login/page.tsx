
import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <AuthFormWrapper
      title={
        <div className="flex flex-col items-center gap-1">
          <span className="text-6xl font-black italic tracking-tighter text-accent animate-in fade-in slide-in-from-top-4 duration-1000">
            트랙
          </span>
          <span className="text-xl font-bold tracking-tight opacity-80">
            에 다시 오신 것을 환영합니다
          </span>
        </div>
      }
      subtitle="성장의 궤도에 다시 합류하여 몰입을 시작하세요."
    >
      <LoginForm />
    </AuthFormWrapper>
  );
}

import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <AuthFormWrapper
      title="트랙에 다시 오신 것을 환영합니다"
      subtitle="대시보드에 접속할 모드를 선택하고 로그인하세요."
    >
      <LoginForm />
    </AuthFormWrapper>
  );
}

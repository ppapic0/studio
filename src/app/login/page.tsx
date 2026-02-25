import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <AuthFormWrapper
      title="다시 오신 것을 환영합니다"
      subtitle="대시보드에 액세스하려면 자격 증명을 입력하세요."
    >
      <LoginForm />
    </AuthFormWrapper>
  );
}

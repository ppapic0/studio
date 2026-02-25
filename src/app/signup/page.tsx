import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <AuthFormWrapper
      title="계정 만들기"
      subtitle="아래에 정보를 입력하여 새 계정을 만드세요."
    >
      <SignupForm />
    </AuthFormWrapper>
  );
}

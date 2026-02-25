import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <AuthFormWrapper
      title="계정 만들기"
      subtitle="시작하려면 세부 정보와 초대 코드를 입력하세요."
    >
      <SignupForm />
    </AuthFormWrapper>
  );
}

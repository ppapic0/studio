import { DevJoinForm } from '@/components/dev/dev-join-form';
import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';

export default function DevJoinPage() {
  return (
    <AuthFormWrapper
      title="개발용 센터 가입"
      subtitle="테스트를 위해 센터 ID, 역할, 개발용 비밀 키를 입력하세요."
    >
      <DevJoinForm />
    </AuthFormWrapper>
  );
}

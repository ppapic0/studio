import { AuthFormWrapper } from '@/components/auth/auth-form-wrapper';
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <AuthFormWrapper
      title="Create an Account"
      subtitle="Enter your details and invite code to get started."
    >
      <SignupForm />
    </AuthFormWrapper>
  );
}

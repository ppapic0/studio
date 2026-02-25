import { redirect } from 'next/navigation';

export default function Home() {
  // The main layout will handle redirection based on auth state.
  // Redirect to a protected route and let the AuthGuard do its job.
  redirect('/app');
}

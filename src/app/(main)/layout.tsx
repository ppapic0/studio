import { AuthGuard } from '@/components/auth/auth-guard';
import { AppProvider } from '@/contexts/app-context';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <AuthGuard>{children}</AuthGuard>
    </AppProvider>
  );
}

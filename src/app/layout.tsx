import type { Metadata } from "next";
import "pretendard/dist/web/static/pretendard.css";

import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Toaster } from "@/components/ui/toaster";
import { AppProvider } from "@/contexts/app-context";
import { FirebaseClientProvider } from "@/firebase/client-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "트랙 국어 학원 | 관리형 스터디센터 · 수능 국어",
  description:
    "관리형 스터디센터 중심 운영, 수능 국어 그룹 수업, 학부모 앱과 학생 웹앱이 연결된 트랙의 학습 관리 시스템입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-body antialiased selection:bg-primary selection:text-white">
        <FirebaseClientProvider>
          <AppProvider>
            <AuthGuard>{children}</AuthGuard>
          </AppProvider>
          <Toaster />
          <FirebaseErrorListener />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}

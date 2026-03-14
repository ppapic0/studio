import type { Metadata } from "next";
import localFont from "next/font/local";

import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Toaster } from "@/components/ui/toaster";
import { AppProvider } from "@/contexts/app-context";
import { FirebaseClientProvider } from "@/firebase/client-provider";

import "./globals.css";

const sbAggro = localFont({
  src: [
    { path: "./fonts/sb-aggro-m.ttf", weight: "500", style: "normal" },
    { path: "./fonts/sb-aggro-b.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-aggro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "트랙 학습센터 | 국어 중심 입시학원 · 관리형 스터디카페",
  description:
    "원장 직강 국어 수업, 직접 제작 해설자료, 자체 앱 기반 학습·생활관리, 프리미엄 학습공간을 제공하는 트랙 학습센터입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${sbAggro.variable} font-body antialiased selection:bg-primary selection:text-white`}
      >
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

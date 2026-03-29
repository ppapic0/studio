import type { Metadata, Viewport } from "next";

import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { RouteAwareAppShell } from "@/components/auth/route-aware-app-shell";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";

import "./globals.css";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#14295f',
};

export const metadata: Metadata = {
  title: "트랙 관리형 스터디센터 / 트랙 국어학원",
  description:
    "관리형 스터디센터 중심 운영, 수능 국어 그룹 수업, 학부모 앱과 학생 웹앱이 연결된 트랙의 학습 관리 시스템입니다.",
  manifest: "/manifest.webmanifest?v=20260325",
  icons: {
    icon: [
      { url: "/favicon.png?v=20260325", type: "image/png", sizes: "any" },
      { url: "/favicon.ico?v=20260325", sizes: "any" },
    ],
    shortcut: ["/favicon.ico?v=20260325"],
    apple: [{ url: "/apple-touch-icon.png?v=20260325", sizes: "180x180", type: "image/png" }],
  },
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
          <RouteAwareAppShell>{children}</RouteAwareAppShell>
          <Toaster />
          <FirebaseErrorListener />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable.css";

import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Toaster } from "@/components/ui/toaster";
import { AppProvider } from "@/contexts/app-context";
import { FirebaseClientProvider } from "@/firebase/client-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "?? ???? | ?? ?? ???? & ??? ?????",
  description:
    "?? ?? ?? ??, ?? ?? ?? ??, ??? ?? ?? ???? ??? ??? ? ?? ?? ???????.",
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

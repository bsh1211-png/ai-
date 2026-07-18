import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Swolemeter",
  description: "내 몸을 분석하고 목표 몸에 맞는 운동을 추천받는 개인 PT 에이전트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg">
        <I18nProvider>
          <AuthProvider>
            <Nav />
            <main className="flex-1 w-full max-w-[440px] sm:max-w-[600px] lg:max-w-[720px] mx-auto px-5 sm:px-8 pt-[72px] sm:pt-20 pb-16">
              {children}
            </main>
          </AuthProvider>
        </I18nProvider>
      </body>
      {/* Google AdSense 사이트 인증 스크립트 (모든 페이지에 1회 로드) */}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7494630317472263"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </html>
  );
}

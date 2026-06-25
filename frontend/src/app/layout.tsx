import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
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
        <AuthProvider>
          <Nav />
          <main className="flex-1 w-full max-w-[480px] mx-auto px-5 pt-20 pb-10">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}

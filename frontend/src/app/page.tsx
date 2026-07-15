"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type AnalysisReport, type ScanSession } from "@/lib/api";
import { CATEGORY_KO } from "@/lib/muscle-labels";
import { LoginScreen } from "@/components/login-screen";
import { LoadingScreen } from "@/components/loading-screen";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "좋은 새벽이에요";
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

function RecentAnalysisCard() {
  const [session, setSession] = useState<ScanSession | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ScanSession[]>("/scans")
      .then(async (sessions) => {
        const completed = sessions.find((s) => s.status === "completed");
        if (!completed) return;
        setSession(completed);
        const r = await api.get<AnalysisReport>(`/scans/${completed.id}/report`);
        setReport(r);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!session || !report) return null;

  const stats = report.headline_stats;

  return (
    <Link href={`/scan/${session.id}`} className="card block space-y-3">
      <p className="label">Latest Scan <span className="text-text-secondary normal-case">· 최근 분석</span></p>
      <div className="flex items-end justify-between">
        <p className="display-number text-5xl gradient-score">
          {stats?.percentile ?? "-"}<span className="text-2xl">%</span>
        </p>
        <div className="flex gap-1.5">
          {stats?.body_fat_estimate_pct != null && (
            <span className="badge-success text-xs px-2 py-1 rounded-md font-display">
              체지방 {stats.body_fat_estimate_pct}%
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{new Date(session.scan_date).toLocaleDateString("ko-KR")}</span>
        <span>{CATEGORY_KO[session.category] ?? session.category}</span>
        <span>보완 부위 {report.weak_points.length}곳</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user, loading } = useAuth();

  // 로그인 확인 대기(재방문 로그인 유저의 백엔드 콜드스타트 등) 동안 로딩 표시
  if (loading) return <LoadingScreen label="로그인 정보를 확인하는 중..." />;

  // 로그아웃 상태로 링크 진입 시 처음부터 로그인 화면을 바로 노출
  if (!user) {
    return <LoginScreen />;
  }

  if (user.is_banned) {
    return (
      <div className="space-y-5 pt-6">
        <p className="label">Account Suspended <span className="text-text-secondary normal-case">· 계정 정지</span></p>
        <h1 className="hero-headline-kr text-accent-red">계정 정지</h1>
        <div className="card" style={{ borderColor: "var(--color-accent-red)" }}>
          <p className="text-sm text-text-secondary leading-relaxed">
            부적절한 이미지 업로드가 누적되어 계정 이용이 영구 정지되었습니다. 분석 기능을 사용할 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label">{greeting()}</p>
        <h1 className="hero-headline-kr text-text-primary mt-2">
          {user.email.split("@")[0]}
        </h1>
      </div>

      <Link
        href="/scan/new"
        className="card flex items-center justify-between gap-4 active:scale-[0.98] transition cyan-glow-strong"
        style={{ borderColor: "var(--color-accent-cyan)" }}
      >
        <div>
          <p className="label-big text-accent-cyan text-3xl">Start Analysis</p>
          <p className="text-xs text-text-secondary mt-1">분석 시작 · 사진을 찍고 AI가 체형을 분석합니다</p>
        </div>
        <span className="text-accent-cyan text-3xl shrink-0">→</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/goals" className="card text-center py-5">
          <p className="label-big text-text-primary text-xl">Goal</p>
          <p className="text-xs text-text-secondary mt-1">목표 설정</p>
        </Link>
        <Link href="/history" className="card text-center py-5">
          <p className="label-big text-text-primary text-xl">History</p>
          <p className="text-xs text-text-secondary mt-1">기록 보기</p>
        </Link>
      </div>

      <RecentAnalysisCard />
    </div>
  );
}

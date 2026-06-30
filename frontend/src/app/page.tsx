"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, API_URL, type AnalysisReport, type ScanSession } from "@/lib/api";
import { CATEGORY_KO } from "@/lib/muscle-labels";

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
      <p className="text-xs text-text-secondary">최근 분석</p>
      <div className="flex items-end justify-between">
        <p className="font-display font-extrabold text-2xl gradient-score">
          상위 {stats?.percentile ?? "-"}%
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

  if (loading) return null;

  if (!user) {
    return (
      <div className="space-y-5 pt-10">
        <h1 className="text-2xl font-bold text-text-primary">
          내 몸을 분석하고, 목표 몸에 맞는 운동을 추천받자
        </h1>
        <p className="text-text-secondary text-sm">
          사진으로 신체를 분석하고, 부족한 부위에 맞는 운동과 루틴을 추천받는 개인 PT 에이전트입니다.
        </p>
        <a href={`${API_URL}/auth/oauth/google/start`} className="btn-primary text-center block">
          시작하기
        </a>
        <p className="text-xs text-text-dim text-center">Google 계정으로 간편하게 시작할 수 있어요</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">
        {greeting()}, {user.email.split("@")[0]}님
      </h1>

      <Link href="/scan/new" className="card flex items-center gap-4 active:scale-[0.98] transition">
        <span
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-2xl"
          style={{ background: "linear-gradient(135deg, #00E5FF, #A855F7)" }}
        >
          ◎
        </span>
        <div>
          <p className="font-bold text-text-primary">신체 분석 시작</p>
          <p className="text-xs text-text-secondary mt-0.5">사진을 찍고 AI가 체형을 분석합니다</p>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/goals" className="card text-center py-5">
          <p className="text-sm font-medium text-text-primary">목표 설정</p>
        </Link>
        <Link href="/history" className="card text-center py-5">
          <p className="text-sm font-medium text-text-primary">기록 보기</p>
        </Link>
      </div>

      <RecentAnalysisCard />
    </div>
  );
}

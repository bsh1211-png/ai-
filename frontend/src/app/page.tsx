"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type AnalysisReport, type ScanSession } from "@/lib/api";
import { categoryLabel } from "@/lib/muscle-labels";
import { LoginScreen } from "@/components/login-screen";
import { useI18n } from "@/lib/i18n";

function RecentAnalysisCard() {
  const { t, lang } = useI18n();
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
      <p className="label">{t("home.latest_scan")} <span className="text-text-secondary normal-case">{t("home.latest_scan_sub")}</span></p>
      <div className="flex items-end justify-between">
        <p className="display-number text-5xl gradient-score">
          {stats?.percentile ?? "-"}<span className="text-2xl">%</span>
        </p>
        <div className="flex gap-1.5">
          {stats?.body_fat_estimate_pct != null && (
            <span className="badge-success text-xs px-2 py-1 rounded-md font-display">
              {t("home.body_fat_badge").replace("{n}", String(stats.body_fat_estimate_pct))}
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{new Date(session.scan_date).toLocaleDateString(lang === "en" ? "en-US" : "ko-KR")}</span>
        <span>{categoryLabel(session.category, lang)}</span>
        <span>{t("home.weak_points_count").replace("{n}", String(report.weak_points.length))}</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { t } = useI18n();

  // 로그인 전에는 로딩/빈 화면 없이 무조건 로그인 화면을 첫 화면으로 노출한다.
  // 유효한 토큰이 있으면 백그라운드 인증 확인 후 자동으로 대시보드로 전환된다.
  if (!user) {
    return <LoginScreen />;
  }

  if (user.is_banned) {
    return (
      <div className="space-y-5 pt-6">
        <p className="label">{t("home.banned_tag")} <span className="text-text-secondary normal-case">{t("home.banned_tag_sub")}</span></p>
        <h1 className="hero-headline-kr text-accent-red">{t("home.banned_title")}</h1>
        <div className="card" style={{ borderColor: "var(--color-accent-red)" }}>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("home.banned_desc")}
          </p>
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greetingKey =
    hour < 6 ? "home.greeting.dawn" : hour < 12 ? "home.greeting.morning" : hour < 18 ? "home.greeting.afternoon" : "home.greeting.evening";

  return (
    <div className="space-y-6">
      <div>
        <p className="label">{t(greetingKey as Parameters<typeof t>[0])}</p>
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
          <p className="label-big text-accent-cyan text-3xl">{t("home.start_title")}</p>
          <p className="text-xs text-text-secondary mt-1">{t("home.start_desc")}</p>
        </div>
        <span className="text-accent-cyan text-3xl shrink-0">→</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/goals" className="card text-center py-5">
          <p className="label-big text-text-primary text-xl">{t("home.goal")}</p>
          <p className="text-xs text-text-secondary mt-1">{t("home.goal_sub")}</p>
        </Link>
        <Link href="/history" className="card text-center py-5">
          <p className="label-big text-text-primary text-xl">{t("home.history")}</p>
          <p className="text-xs text-text-secondary mt-1">{t("home.history_sub")}</p>
        </Link>
      </div>

      <RecentAnalysisCard />
    </div>
  );
}

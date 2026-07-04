"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  ApiError,
  type AnalysisReport,
  type Goal,
  type HistorySummary,
  type ProgressLog,
  type ScanSession,
} from "@/lib/api";
import { CATEGORY_KO } from "@/lib/muscle-labels";

function WeightSparkline({ logs }: { logs: ProgressLog[] }) {
  const points = logs
    .filter((l) => l.weight_kg !== null)
    .slice()
    .reverse(); // 날짜 오름차순
  if (points.length < 2) return null;

  const weights = points.map((p) => p.weight_kg as number);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.weight_kg as number) - min) / range * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke="#00E5FF" strokeWidth="2" />
    </svg>
  );
}

export default function HistoryPage() {
  const [dashboard, setDashboard] = useState<HistorySummary | null>(null);
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [reportsBySession, setReportsBySession] = useState<Record<string, AnalysisReport>>({});
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadAll = () => {
    api.get<ScanSession[]>("/scans").then((list) => {
      setSessions(list);
      const completed = list.filter((s) => s.status === "completed");
      Promise.all(
        completed.map((s) =>
          api
            .get<AnalysisReport>(`/scans/${s.id}/report`)
            .then((r) => [s.id, r] as const)
            .catch(() => null)
        )
      ).then((pairs) => {
        const map: Record<string, AnalysisReport> = {};
        for (const pair of pairs) {
          if (pair) map[pair[0]] = pair[1];
        }
        setReportsBySession(map);
      });
    });
    api.get<ProgressLog[]>("/progress").then(setLogs);
    api.get<Goal | null>("/goals/active").then(setActiveGoal).catch(() => setActiveGoal(null));
    api.get<HistorySummary>("/history/dashboard-summary").then(setDashboard).catch(() => setDashboard(null));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/progress", {
        weight_kg: weight ? Number(weight) : undefined,
        notes: notes || undefined,
      });
      setWeight("");
      setNotes("");
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "기록 추가 중 오류가 발생했습니다");
    }
  };

  const deleteLog = async (logId: string) => {
    await api.delete(`/progress/${logId}`);
    setLogs((prev) => prev.filter((l) => l.id !== logId));
  };

  return (
    <div className="space-y-10">
      <div
        className="card relative overflow-hidden"
        style={{ borderColor: "var(--color-accent-cyan)", background: "rgba(0,184,255,0.08)" }}
      >
        <p className="label mb-2">Dashboard <span className="text-text-secondary normal-case">· 종합</span></p>
        <p className="text-base font-medium text-text-primary whitespace-pre-wrap">
          {dashboard ? dashboard.summary : "불러오는 중..."}
        </p>
      </div>

      {/* 현재 목표 */}
      <Link
        href="/goals"
        className="card block"
        style={{ borderColor: "#FF6B35", background: "rgba(255,107,53,0.06)" }}
      >
        <p className="label mb-1" style={{ color: "#FF6B35" }}>Goal <span className="text-text-secondary normal-case">· 목표</span></p>
        <p className="text-sm text-text-primary">
          {activeGoal?.goal_text ? `🎯 ${activeGoal.goal_text}` : "아직 목표가 없어요 — 눌러서 설정하기 →"}
        </p>
      </Link>

      <div>
        <p className="label mb-1">History <span className="text-text-secondary normal-case">· 기록</span></p>
        <h1 className="hero-headline-kr text-text-primary mb-4">분석 기록</h1>
        {sessions.length === 0 && <p className="text-sm text-text-secondary">아직 분석 기록이 없습니다.</p>}
        <ul className="space-y-2">
          {sessions.map((s) => {
            const report = reportsBySession[s.id];
            return (
              <li key={s.id} className="card flex justify-between items-center text-sm">
                <div className="flex items-center gap-3">
                  {report?.headline_stats?.percentile != null && (
                    <span className="badge-info text-xs px-2 py-1 rounded font-display shrink-0">
                      상위 {report.headline_stats.percentile}%
                    </span>
                  )}
                  <div>
                    <p className="text-text-primary">{new Date(s.scan_date).toLocaleDateString("ko-KR")}</p>
                    <p className="text-xs text-text-secondary">
                      {CATEGORY_KO[s.category] ?? s.category} · {s.status}
                    </p>
                  </div>
                </div>
                <Link href={`/scan/${s.id}`} className="min-h-11 flex items-center text-sm text-accent-cyan">
                  보기
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="label mb-4">Progress <span className="text-text-secondary normal-case">· 몸무게/메모</span></p>
        <WeightSparkline logs={logs} />
        <form onSubmit={addLog} className="flex flex-wrap gap-2 my-4">
          <input
            type="number"
            step="0.1"
            placeholder="몸무게(kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-32"
          />
          <input
            type="text"
            placeholder="메모"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 min-w-32"
          />
          <button type="submit" className="btn-primary w-auto px-4">
            추가
          </button>
        </form>
        {error && <p className="text-sm text-accent-red mb-2">{error}</p>}
        <ul className="space-y-1 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between text-text-secondary py-1">
              <span>
                {new Date(l.logged_at).toLocaleDateString("ko-KR")} —{" "}
                {l.weight_kg ? `${l.weight_kg}kg` : ""} {l.notes}
              </span>
              <button onClick={() => deleteLog(l.id)} className="text-text-dim hover:text-accent-red text-xs px-2">
                삭제
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

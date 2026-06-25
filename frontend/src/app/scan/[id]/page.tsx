"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, exerciseImageUrl, type AnalysisReport, type Exercise, type ScanSession } from "@/lib/api";
import { muscleLabel } from "@/lib/muscle-labels";
import { generateShareCardBlob, shareOrDownloadCard } from "@/lib/share-card";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "업로드됨 (분석 대기)",
  processing: "분석 중...",
  completed: "분석 완료",
  failed: "분석 실패",
};

function ScoreColumn({ label, value, suffix, gradient, color }: { label: string; value: number | null; suffix: string; gradient?: boolean; color?: string }) {
  return (
    <div className="flex-1 text-center py-2">
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      {value === null ? (
        <p className="text-text-dim text-sm">데이터 없음</p>
      ) : (
        <p
          className="font-display font-black leading-none"
          style={{
            fontSize: "clamp(2.2rem, 12vw, 3.5rem)",
            ...(gradient
              ? {
                  background: "linear-gradient(135deg, #00E5FF, #A855F7)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }
              : { color }),
          }}
        >
          {value}
          <span style={{ fontSize: "clamp(1rem, 5vw, 1.4rem)" }}>{suffix}</span>
        </p>
      )}
    </div>
  );
}

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const s = await api.get<ScanSession>(`/scans/${id}`);
        if (cancelled) return;
        setSession(s);

        if (s.status === "completed") {
          const r = await api.get<AnalysisReport>(`/scans/${id}/report`);
          if (cancelled) return;
          setReport(r);
          clearInterval(intervalId);
        } else if (s.status === "failed") {
          clearInterval(intervalId);
        }
      } catch {
        // 일시적 네트워크 오류는 다음 polling에서 재시도
      }
    };

    const intervalId = setInterval(poll, 3000);
    poll();
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [id]);

  useEffect(() => {
    if (!report) return;
    Promise.all(
      report.recommended_exercise_ids.map((exId) => api.get<Exercise>(`/exercises/${exId}`))
    ).then(setExercises);
  }, [report]);

  const handleShare = async () => {
    if (!report?.headline_stats || !session) return;
    setSharing(true);
    try {
      const blob = await generateShareCardBlob(
        report.headline_stats,
        new Date(session.scan_date).toLocaleDateString("ko-KR")
      );
      if (blob) await shareOrDownloadCard(blob, `swolemeter-${session.id}.png`);
    } finally {
      setSharing(false);
    }
  };

  if (!session) return <p className="text-sm text-text-secondary">불러오는 중...</p>;

  const stats = report?.headline_stats;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">분석 결과</h1>
        <p className="text-sm text-text-secondary">{STATUS_LABEL[session.status] ?? session.status}</p>
      </div>

      {session.status === "processing" && (
        <p className="text-sm text-text-secondary">
          AI가 사진을 분석하고 있습니다. 잠시만 기다려주세요 (자동으로 갱신됩니다)...
        </p>
      )}

      {session.status === "failed" && (
        <div className="space-y-3">
          <p className="text-sm text-accent-red">{session.error_message ?? "분석에 실패했습니다"}</p>
          <Link href="/scan/new" className="btn-primary inline-block text-center">
            다시 촬영하기
          </Link>
        </div>
      )}

      {report && stats && (
        <div className="space-y-8">
          {/* 스코어 카드 */}
          <div className="card relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, rgba(0,229,255,0.12), transparent 70%)",
              }}
            />
            <div className="relative flex divide-x" style={{ borderColor: "var(--color-border)" }}>
              <ScoreColumn label="일반인 대비 상위" value={stats.percentile} suffix="%" gradient />
              <ScoreColumn label="목표 싱크율" value={stats.sync_rate} suffix="%" color="#FF6B35" />
            </div>
          </div>

          {/* 수치 뱃지 행 */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="card py-3">
              <p className="text-xs text-text-secondary mb-1">체지방률</p>
              <p className="font-display font-extrabold text-xl" style={{ color: "#39FF14" }}>
                {stats.body_fat_estimate_pct ?? "-"}%
              </p>
            </div>
            <div className="card py-3">
              <p className="text-xs text-text-secondary mb-1">대칭 점수</p>
              <p className="font-display font-extrabold text-xl" style={{ color: "#00E5FF" }}>
                {stats.symmetry_score ?? "-"}
              </p>
            </div>
          </div>

          {/* 신체 총평 */}
          <div className="card">
            <p className="text-sm font-semibold text-text-primary mb-2">신체 총평</p>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{report.summary}</p>
          </div>

          {/* 보완이 필요한 부위 */}
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">보완이 필요한 부위</p>
            <ul className="space-y-2">
              {report.weak_points.map((wp, i) => {
                const isMinor = wp.severity === "low";
                const barColor = isMinor ? "#39FF14" : "#FF6B35";
                return (
                  <li key={i} className="card relative pl-5 overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: barColor }} />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{muscleLabel(wp.part)}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md ${isMinor ? "badge-success" : "badge-warning"}`}
                      >
                        {isMinor ? "미세 조정" : "보완 필요"}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm mt-1">{wp.comment}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          {exercises.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-text-primary mb-3">추천 운동</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {exercises.map((ex) => (
                  <div key={ex.id} className="card space-y-2">
                    {ex.image_paths[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exerciseImageUrl(ex.image_paths[0])}
                        alt={ex.name_en}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    )}
                    <p className="text-sm font-medium text-text-primary">{ex.name_ko || ex.name_en}</p>
                    <p className="text-xs text-text-secondary">{ex.primary_muscles.join(", ")}</p>
                    {ex.youtube_video_ids.slice(0, 2).map((videoId) => (
                      <iframe
                        key={videoId}
                        className="w-full aspect-video rounded-lg"
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title={ex.name_en}
                        allowFullScreen
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.recommended_routine && report.recommended_routine.items.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-text-primary mb-3">추천 루틴</p>
              <div className="card divide-y" style={{ padding: 0 }}>
                {report.recommended_routine.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-sm" style={{ borderColor: "var(--color-border)" }}>
                    <div>
                      <p className="font-medium text-text-primary">{item.exercise_name}</p>
                      <p className="text-xs" style={{ color: "#00E5FF" }}>
                        {muscleLabel(item.target_part)} 타겟
                      </p>
                    </div>
                    <span className="badge-info text-xs px-2 py-1 rounded-md font-display">
                      {item.duration_minutes != null ? `${item.duration_minutes}분` : `${item.sets}세트 × ${item.reps}회`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button onClick={handleShare} disabled={sharing} className="btn-primary disabled:opacity-50">
              {sharing ? "이미지 생성 중..." : "📤 결과 공유하기"}
            </button>
            <Link href="/scan/new" className="btn-secondary block text-center">
              다시 분석하기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

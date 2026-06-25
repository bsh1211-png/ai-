"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, exerciseImageUrl, type AnalysisReport, type Exercise, type ScanSession } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "업로드됨 (분석 대기)",
  processing: "분석 중...",
  completed: "분석 완료",
  failed: "분석 실패",
};

function StatBlock({
  label,
  value,
  suffix,
  sad,
}: {
  label: string;
  value: number | null;
  suffix: string;
  sad: boolean;
}) {
  if (value === null) {
    return (
      <div className="flex-1 text-center py-4">
        <p className="text-xs text-white/60">{label}</p>
        <p className="text-white/40 text-sm mt-2">데이터 없음</p>
      </div>
    );
  }
  return (
    <div className="flex-1 text-center py-4">
      <p className="text-xs text-white/60 mb-1">{label}</p>
      <p className="font-extrabold text-white leading-none" style={{ fontSize: "clamp(2rem, 11vw, 3.5rem)" }}>
        {value}
        <span style={{ fontSize: "clamp(1rem, 5vw, 1.5rem)" }}>{suffix}</span>
        {sad && <span className="ml-1">ㅠㅠ</span>}
      </p>
    </div>
  );
}

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

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

  if (!session) return <p className="text-sm text-gray-500">불러오는 중...</p>;

  const stats = report?.headline_stats;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">분석 결과</h1>
        <p className="text-sm text-gray-500">{STATUS_LABEL[session.status] ?? session.status}</p>
      </div>

      {session.status === "processing" && (
        <p className="text-sm text-gray-500">
          AI가 사진을 분석하고 있습니다. 잠시만 기다려주세요 (자동으로 갱신됩니다)...
        </p>
      )}

      {session.status === "failed" && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{session.error_message ?? "분석에 실패했습니다"}</p>
          <Link
            href="/scan/new"
            className="inline-block min-h-11 rounded-xl bg-black text-white px-4 py-3 text-sm font-medium"
          >
            다시 촬영하기
          </Link>
        </div>
      )}

      {report && stats && (
        <div className="space-y-8">
          <div className="rounded-2xl border bg-gradient-to-br from-gray-900 to-gray-700 px-2 py-2">
            <div className="flex divide-x divide-white/20">
              <StatBlock
                label="일반인 대비 상위"
                value={stats.percentile}
                suffix="%"
                sad={stats.percentile !== null && stats.percentile >= 50}
              />
              <StatBlock
                label="목표 몸과 싱크로율"
                value={stats.sync_rate}
                suffix="%"
                sad={stats.sync_rate !== null && stats.sync_rate < 50}
              />
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-white">
            <p className="text-sm font-semibold text-gray-900 mb-2">신체 총평</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.summary}</p>
            <div className="flex gap-4 mt-3 text-xs text-gray-600">
              <span>추정 체지방률 {stats.body_fat_estimate_pct ?? "-"}%</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">보완이 필요한 부위</p>
            <ul className="space-y-2">
              {report.weak_points.map((wp, i) => (
                <li key={i} className="border rounded-xl p-3 text-sm bg-white">
                  <span className="font-medium text-gray-900">{wp.part}</span>{" "}
                  <span className="text-xs text-gray-500">({wp.severity})</span>
                  <p className="text-gray-700 mt-1">{wp.comment}</p>
                </li>
              ))}
            </ul>
          </div>

          {exercises.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">추천 운동</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {exercises.map((ex) => (
                  <div key={ex.id} className="border rounded-xl p-3 space-y-2 bg-white">
                    {ex.image_paths[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exerciseImageUrl(ex.image_paths[0])}
                        alt={ex.name_en}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    )}
                    <p className="text-sm font-medium text-gray-900">{ex.name_ko || ex.name_en}</p>
                    <p className="text-xs text-gray-500">{ex.primary_muscles.join(", ")}</p>
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
              <p className="text-sm font-semibold text-gray-900 mb-3">추천 루틴</p>
              <div className="border rounded-xl bg-white divide-y">
                {report.recommended_routine.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{item.exercise_name}</p>
                      <p className="text-xs text-gray-500">{item.target_part} 타겟</p>
                    </div>
                    <p className="text-gray-700 font-medium">
                      {item.sets}세트 × {item.reps}회
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

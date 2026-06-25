"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  api,
  exerciseImageUrl,
  type AnalysisReport,
  type Exercise,
  type ScanSession,
} from "@/lib/api";
import { AuthedImage } from "@/components/authed-image";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "업로드됨 (분석 대기)",
  processing: "분석 중...",
  completed: "분석 완료",
  failed: "분석 실패",
};

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">분석 결과</h1>
        <p className="text-sm text-gray-500">{STATUS_LABEL[session.status] ?? session.status}</p>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">업로드한 사진</p>
        <div className="flex gap-3">
          {session.images.map((img) => (
            <AuthedImage
              key={img.id}
              path={`/scans/${session.id}/images/${img.id}/file`}
              alt={img.angle}
              className="w-24 h-24 object-cover rounded border"
            />
          ))}
        </div>
      </div>

      {session.status === "processing" && (
        <p className="text-sm text-gray-500">
          AI가 사진을 분석하고 있습니다. 잠시만 기다려주세요 (자동으로 갱신됩니다)...
        </p>
      )}

      {session.status === "failed" && (
        <p className="text-sm text-red-600">{session.error_message ?? "분석에 실패했습니다"}</p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="border rounded p-4 bg-gray-50">
            <p className="text-sm whitespace-pre-wrap">{report.summary}</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">성장 여지가 있는 부위</p>
            <ul className="space-y-2">
              {report.weak_points.map((wp, i) => (
                <li key={i} className="border rounded p-3 text-sm">
                  <span className="font-medium">{wp.part}</span>{" "}
                  <span className="text-xs text-gray-500">({wp.severity})</span>
                  <p className="text-gray-600 mt-1">{wp.comment}</p>
                </li>
              ))}
            </ul>
          </div>

          {exercises.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">추천 운동</p>
              <div className="grid grid-cols-2 gap-4">
                {exercises.map((ex) => (
                  <div key={ex.id} className="border rounded p-3 space-y-2">
                    {ex.image_paths[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exerciseImageUrl(ex.image_paths[0])}
                        alt={ex.name_en}
                        className="w-full h-32 object-cover rounded"
                      />
                    )}
                    <p className="text-sm font-medium">{ex.name_ko || ex.name_en}</p>
                    <p className="text-xs text-gray-500">{ex.primary_muscles.join(", ")}</p>
                    {ex.youtube_video_id && (
                      <iframe
                        className="w-full aspect-video rounded"
                        src={`https://www.youtube.com/embed/${ex.youtube_video_id}`}
                        title={ex.name_en}
                        allowFullScreen
                      />
                    )}
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

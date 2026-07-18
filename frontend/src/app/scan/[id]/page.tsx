"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, exerciseImageUrl, fetchAuthedBlobUrl, type AnalysisReport, type Exercise, type ScanSession } from "@/lib/api";
import { muscleLabel } from "@/lib/muscle-labels";
import { generateShareCardBlob, shareCardImage, downloadCard, SERVICE_URL } from "@/lib/share-card";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";

const STATUS_KEY: Record<string, TranslationKey> = {
  uploaded: "result.status.uploaded",
  processing: "result.status.processing",
  completed: "result.status.completed",
  failed: "result.status.failed",
};

const DIRECTION_KEY: Record<string, TranslationKey> = {
  bulk_up: "direction.bulk_up",
  slim_down: "direction.slim_down",
  recomposition: "direction.recomposition",
  maintain: "direction.maintain",
};

// 목표 대비 방향 배지: label은 t()로, cls만 고정
const GOAL_ACTION_BADGE: Record<string, { key: TranslationKey; cls: string }> = {
  grow: { key: "goalaction.grow", cls: "badge-info" },
  reduce: { key: "goalaction.reduce", cls: "badge-warning" },
  definition: { key: "goalaction.definition", cls: "badge-success" },
  maintain: { key: "goalaction.maintain", cls: "badge-success" },
};

const ANGLE_KEY: Record<string, TranslationKey> = {
  front: "angle.front",
  back: "angle.back",
  side: "angle.side",
  left: "angle.side",
  right: "angle.side",
  side_left: "angle.side",
  side_right: "angle.side",
};

// 촬영한 사진 슬라이더 — 여러 각도면 좌우로 넘겨서 보기
function PhotoCarousel({ photos }: { photos: { angle: string; url: string }[] }) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (photos.length === 0) return null;

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, i) => (
          <div key={i} className="relative shrink-0 w-full snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.angle}
              className="w-full max-h-[60vh] object-contain bg-black rounded-2xl"
            />
            {p.angle && (
              <span className="absolute top-3 left-3 text-xs px-2.5 py-1 rounded-md bg-black/60 text-white tracking-wide backdrop-blur-sm">
                {ANGLE_KEY[p.angle] ? t(ANGLE_KEY[p.angle]) : p.angle}
              </span>
            )}
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: i === active ? 20 : 6,
                background: i === active ? "var(--color-accent-cyan)" : "var(--color-text-dim)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 영어 라벨(크게) + 서브 라벨(작게). 서브 라벨은 비어있으면 숨긴다(영어 모드).
function BiLabel({ en, ko, color, className = "" }: { en: string; ko: string; color?: string; className?: string }) {
  return (
    <div className={className}>
      <p className="label" style={color ? { color } : undefined}>{en}</p>
      {ko && <p className="text-xs text-text-secondary tracking-wide mt-0.5">{ko}</p>}
    </div>
  );
}

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [photos, setPhotos] = useState<{ angle: string; url: string }[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const imageCount = session?.images.length ?? 0;

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

  // 촬영한 사진을 인증 토큰으로 불러와 blob URL로 표시 (여러 각도면 슬라이더)
  useEffect(() => {
    if (!session || session.images.length === 0) return;
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      const loaded = await Promise.all(
        session.images.map(async (img) => {
          try {
            const url = await fetchAuthedBlobUrl(`/scans/${session.id}/images/${img.id}/file`);
            created.push(url);
            return { angle: img.angle, url };
          } catch {
            return null;
          }
        })
      );
      const valid = loaded.filter((x): x is { angle: string; url: string } => x !== null);
      if (cancelled) {
        created.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setPhotos(valid);
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, imageCount]);

  const shareUrl = `https://${SERVICE_URL}`;
  const pct = report?.headline_stats?.percentile;
  const shareText =
    pct != null
      ? t("result.share_text").replace("{n}", String(pct))
      : t("result.share_text_nopct");

  const buildCard = async (): Promise<Blob | null> => {
    if (!report?.headline_stats || !session) return null;
    return generateShareCardBlob(
      report.headline_stats,
      new Date(session.scan_date).toLocaleDateString(lang === "en" ? "en-US" : "ko-KR"),
      lang
    );
  };

  // 네이티브 공유 시트(모바일: 인스타/X/왓츠앱 등) — 미지원 시 이미지 저장으로 폴백
  const handleNativeShare = async () => {
    if (!session) return;
    setSharing(true);
    setShareMsg(null);
    try {
      const blob = await buildCard();
      if (!blob) return;
      const result = await shareCardImage(blob, `swolemeter-${session.id}.png`, `${shareText} ${shareUrl}`);
      if (result === "unsupported") {
        downloadCard(blob, `swolemeter-${session.id}.png`);
        setShareMsg(t("result.share_downloaded"));
      }
    } finally {
      setSharing(false);
    }
  };


  if (!session) return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;

  const stats = report?.headline_stats;
  const subFat = t("result.body_fat_sub");
  const subSym = t("result.symmetry_sub");
  const subGoal = t("result.goal_match_sub");

  return (
    <div className="space-y-8">
      <div>
        <p className="label">{t("result.tag")}</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">{t("result.title")}</h1>
        <p className="text-sm text-text-secondary mt-2">{STATUS_KEY[session.status] ? t(STATUS_KEY[session.status]) : session.status}</p>
      </div>

      {/* 미성년자 보호 안내 */}
      {user?.is_minor && (
        <div className="card" style={{ borderColor: "var(--color-accent-cyan)" }}>
          <p className="text-xs text-text-secondary leading-relaxed">
            {t("result.minor_notice")}
          </p>
        </div>
      )}

      {/* 촬영한 사진 — 상위 % 위에 크게, 여러 각도면 슬라이드로 넘겨보기 */}
      {photos.length > 0 && <PhotoCarousel photos={photos} />}

      {session.status === "processing" && (
        <p className="text-sm text-text-secondary">
          {t("result.processing_msg")}
        </p>
      )}

      {session.status === "failed" && (
        <div className="space-y-3">
          <div className="card" style={{ borderColor: "var(--color-accent-red)" }}>
            <p className="text-sm text-accent-red whitespace-pre-line leading-relaxed">
              {session.error_message ?? t("capture.analyze_fail")}
            </p>
          </div>
          <Link href="/scan/new" className="btn-primary inline-block text-center">
            {t("result.retry_capture")}
          </Link>
        </div>
      )}

      {report && stats && (
        <div className="space-y-8">
          {/* 히어로 스코어 — 화면을 채우는 거대 숫자 */}
          <div className="relative overflow-hidden text-center py-6">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 50% 30%, rgba(0,184,255,0.18), transparent 70%)",
              }}
            />
            <div className="relative">
              <p className="label">{t("result.ranked_top")}</p>
              <p className="text-sm text-text-secondary tracking-widest mt-0.5">{t("result.ranked_top_sub")}</p>
              {stats.percentile === null ? (
                <p className="text-text-dim text-sm mt-4">{t("result.no_data")}</p>
              ) : (
                <p
                  className="display-number text-accent-cyan cyan-glow mt-2"
                  style={{ fontSize: "clamp(80px, 24vw, 200px)" }}
                >
                  {stats.percentile}<span style={{ fontSize: "clamp(28px, 8vw, 64px)" }}>%</span>
                </p>
              )}
              <p className="hashtag text-base mt-6">#SWOLEMETER</p>
            </div>
          </div>

          {/* 3대 수치 — 바디팻 / 대칭 / 목표 일치율 (목표 있을 때만 3열) */}
          <div className={`grid ${stats.sync_rate !== null ? "grid-cols-3" : "grid-cols-2"} gap-3 text-center`}>
            <div className="card py-4 px-2">
              <BiLabel en={t("result.body_fat")} ko={subFat} className="mb-2" />
              <p className="display-number text-3xl" style={{ color: "#39FF14" }}>
                {stats.body_fat_estimate_pct ?? "-"}<span className="text-lg">%</span>
              </p>
            </div>
            <div className="card py-4 px-2">
              <BiLabel en={t("result.symmetry")} ko={subSym} className="mb-2" />
              <p className="display-number text-3xl text-accent-cyan">
                {stats.symmetry_score ?? "-"}
              </p>
            </div>
            {stats.sync_rate !== null && (
              <div className="card py-4 px-2" style={{ borderColor: "#FF6B35" }}>
                <BiLabel en={t("result.goal_match")} ko={subGoal} color="#FF6B35" className="mb-2" />
                <p className="display-number text-3xl" style={{ color: "#FF6B35" }}>
                  {stats.sync_rate}<span className="text-lg">%</span>
                </p>
              </div>
            )}
          </div>

          {/* 신체 총평 */}
          <div className="card" style={{ borderColor: "var(--color-accent-cyan)", background: "rgba(0,184,255,0.06)" }}>
            <p className="section-label mb-2" style={{ color: "var(--color-accent-cyan)" }}>{t("result.overall")} <span className="sub">{t("result.overall_sub")}</span></p>
            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{report.summary}</p>
          </div>

          {/* 목표 대비 분석 */}
          {report.goal_comparison?.feedback && (
            <div className="card" style={{ borderColor: "#FF6B35" }}>
              <div className="flex items-center gap-2 mb-2">
                <p className="section-label" style={{ color: "#FF6B35" }}>
                  {t("result.goal_analysis")} <span className="sub">{t("result.goal_analysis_sub")}</span>
                </p>
                {report.goal_comparison.direction && (
                  <span className="text-xs px-2 py-0.5 rounded badge-warning">
                    {DIRECTION_KEY[report.goal_comparison.direction] ? t(DIRECTION_KEY[report.goal_comparison.direction]) : report.goal_comparison.direction}
                  </span>
                )}
              </div>
              {report.goal_comparison.goal_text && (
                <p className="text-xs text-text-secondary mb-2">{t("result.goal_prefix").replace("{text}", report.goal_comparison.goal_text)}</p>
              )}
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {report.goal_comparison.feedback}
              </p>
            </div>
          )}

          {/* 보완이 필요한 부위 */}
          <div>
            <p className="section-label mb-3">{t("result.weak_points")} <span className="sub">{t("result.weak_points_sub")}</span></p>
            <ul className="space-y-2">
              {report.weak_points.map((wp, i) => {
                const isReduce = wp.goal_action === "reduce";
                const isMinor = wp.severity === "low";
                const barColor = isReduce ? "#FF6B35" : isMinor ? "#39FF14" : "#FF6B35";
                const actionBadge = wp.goal_action ? GOAL_ACTION_BADGE[wp.goal_action] : null;
                return (
                  <li key={i} className="card relative pl-5 overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: barColor }} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text-primary">{muscleLabel(wp.part, lang)}</span>
                      {actionBadge ? (
                        <span className={`text-xs px-2 py-0.5 rounded-md ${actionBadge.cls}`}>
                          {t(actionBadge.key)}
                        </span>
                      ) : (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md ${isMinor ? "badge-success" : "badge-warning"}`}
                        >
                          {isMinor ? t("result.badge_minor_adjust") : t("result.badge_need_work")}
                        </span>
                      )}
                    </div>
                    <p className="text-text-primary text-sm mt-1">{wp.comment}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          {exercises.length > 0 && (
            <div>
              <p className="section-label mb-3">{t("result.recommended")} <span className="sub">{t("result.recommended_sub")}</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {exercises.map((ex) => (
                  <div key={ex.id} className="card space-y-2">
                    {ex.image_paths[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exerciseImageUrl(ex.image_paths[0])}
                        alt={ex.name_en}
                        className="w-full h-32 object-cover rounded analysis-photo"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <p className="text-sm font-medium text-text-primary">{lang === "en" ? ex.name_en : (ex.name_ko || ex.name_en)}</p>
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
              <p className="section-label mb-3">{t("result.routine")} <span className="sub">{t("result.routine_sub")}</span></p>
              <div className="card divide-y" style={{ padding: 0 }}>
                {report.recommended_routine.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-sm" style={{ borderColor: "var(--color-border)" }}>
                    <div>
                      <p className="font-medium text-text-primary">{item.exercise_name}</p>
                      <p className="text-xs" style={{ color: "#00E5FF" }}>
                        {t("result.target_suffix").replace("{part}", muscleLabel(item.target_part, lang))}
                      </p>
                    </div>
                    <span className="badge-info text-xs px-2 py-1 rounded-md font-display">
                      {item.duration_minutes != null
                        ? t("result.minutes").replace("{n}", String(item.duration_minutes))
                        : t("result.sets_reps").replace("{sets}", String(item.sets)).replace("{reps}", String(item.reps))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 공유 — 워터마크 카드 이미지 + 플랫폼별 링크 확산 */}
          <div className="space-y-3 pt-2">
            <p className="section-label mb-1">Share <span className="sub">{t("result.share_section_sub")}</span></p>

            <button onClick={handleNativeShare} disabled={sharing} className="btn-primary disabled:opacity-50">
              {sharing ? t("result.sharing") : t("result.share_native")}
            </button>

            {shareMsg && (
              <p className="text-xs text-center" style={{ color: "var(--color-accent-cyan)" }}>{shareMsg}</p>
            )}

            <Link href="/scan/new" className="btn-secondary block text-center mt-1">
              {t("result.reanalyze")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

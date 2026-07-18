"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type LeaderboardEntry, type RankingProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { LoadingScreen } from "@/components/loading-screen";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function RankingPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<RankingProfile | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [nickname, setNickname] = useState("");
  const [savingNick, setSavingNick] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    try {
      const [p, board] = await Promise.all([
        api.get<RankingProfile>("/friends/me"),
        api.get<{ entries: LeaderboardEntry[] }>("/friends/leaderboard"),
      ]);
      setProfile(p);
      setEntries(board.entries);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("ranking.error_load"));
    }
  }, [t]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const inviteLink = profile ? `${origin}/invite/${profile.invite_code}` : "";

  const handleInvite = async () => {
    if (!inviteLink) return;
    const shareData = {
      title: t("ranking.share_title"),
      text: t("ranking.share_text"),
      url: inviteLink,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* 사용자가 취소한 경우 무시 */
      }
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 미지원 */
    }
  };

  const handleSaveNickname = async () => {
    const name = nickname.trim();
    if (!name) return;
    setSavingNick(true);
    setError(null);
    try {
      await api.post("/friends/nickname", { display_name: name });
      setNickname("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("ranking.error_nickname"));
    } finally {
      setSavingNick(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{t("common.need_login")}</p>
        <Link href="/login" className="btn-primary inline-block text-center">
          {t("common.login")}
        </Link>
      </div>
    );
  }

  // 미성년자 보호: 신체 점수 경쟁(랭킹)에서 제외
  if (user.is_minor) {
    return (
      <div className="space-y-6">
        <div>
          <p className="label">Ranking</p>
          <h1 className="hero-headline-kr text-text-primary mt-1">{t("ranking.title")}</h1>
        </div>
        <div className="card space-y-2" style={{ borderColor: "var(--color-accent-cyan)" }}>
          <p className="text-sm text-text-primary">{t("ranking.minor_notice")}</p>
          <p className="text-xs text-text-dim leading-relaxed">{t("ranking.minor_desc")}</p>
        </div>
        <Link href="/history" className="btn-secondary block text-center">
          {t("ranking.view_history")}
        </Link>
      </div>
    );
  }

  const needsNickname = profile !== null && !profile.display_name;

  return (
    <div className="space-y-8">
      <div>
        <p className="label">Ranking</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">{t("ranking.title")}</h1>
        <p className="text-sm text-text-secondary mt-2">{t("ranking.subtitle")}</p>
      </div>

      {error && <p className="text-sm text-accent-red">{error}</p>}

      {/* 닉네임 설정 (미설정 시) */}
      {needsNickname && (
        <div className="card space-y-3" style={{ borderColor: "var(--color-accent-cyan)" }}>
          <p className="text-sm text-text-primary">{t("ranking.set_nickname")}</p>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder={t("ranking.nickname_placeholder")}
              className="flex-1 rounded-xl px-4 py-3 text-sm bg-transparent border"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            />
            <button
              onClick={handleSaveNickname}
              disabled={savingNick || !nickname.trim()}
              className="btn-primary px-5 disabled:opacity-50"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      )}

      {/* 내 점수 */}
      <div className="text-center py-2">
        <p className="label">My Score</p>
        <p className="text-sm text-text-secondary tracking-widest mt-0.5">{t("ranking.my_score_sub")}</p>
        {profile?.score != null ? (
          <p className="display-number text-accent-cyan cyan-glow mt-2" style={{ fontSize: "clamp(64px, 20vw, 140px)" }}>
            {profile.score}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-text-dim text-sm">{t("ranking.no_score")}</p>
            <Link href="/scan/new" className="btn-primary inline-block text-center">
              {t("ranking.go_analyze")}
            </Link>
          </div>
        )}
      </div>

      {/* 초대 버튼 */}
      <button onClick={handleInvite} className="btn-primary w-full">
        {copied ? t("ranking.invite_copied") : t("ranking.invite_btn")}
      </button>

      {/* 리더보드 */}
      <div>
        <p className="section-label mb-3">Leaderboard <span className="sub">{t("ranking.leaderboard_sub")}</span></p>
        {entries.length <= 1 ? (
          <div className="card text-center py-6">
            <p className="text-sm text-text-secondary">{t("ranking.no_friends")}</p>
            <p className="text-xs text-text-dim mt-1">{t("ranking.no_friends_hint")}</p>
          </div>
        ) : (
          <div className="card divide-y" style={{ padding: 0 }}>
            {entries.map((e) => (
              <div
                key={e.user_id}
                className="flex items-center gap-3 px-5 py-3"
                style={{
                  borderColor: "var(--color-border)",
                  background: e.is_me ? "rgba(0,184,255,0.08)" : "transparent",
                }}
              >
                <span className="w-8 text-center font-display text-lg" style={{ color: e.rank && e.rank <= 3 ? "var(--color-accent-cyan)" : "var(--color-text-dim)" }}>
                  {e.rank ? MEDAL[e.rank] ?? e.rank : "-"}
                </span>
                <span className="flex-1 text-sm truncate" style={{ color: e.is_me ? "var(--color-accent-cyan)" : "var(--color-text-primary)" }}>
                  {e.display_name}
                  {e.is_me && <span className="text-xs text-text-dim ml-1">{t("ranking.me")}</span>}
                </span>
                <span className="font-display text-xl" style={{ color: e.score != null ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
                  {e.score ?? "-"}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-text-dim mt-3 text-center">
          {t("ranking.score_note")}
        </p>
      </div>
    </div>
  );
}

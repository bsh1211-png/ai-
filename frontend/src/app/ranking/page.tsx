"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type LeaderboardEntry, type RankingProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LoadingScreen } from "@/components/loading-screen";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function RankingPage() {
  const { user, loading } = useAuth();
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
      setError(e instanceof ApiError ? e.message : "불러오는 중 오류가 발생했습니다");
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const inviteLink = profile ? `${origin}/invite/${profile.invite_code}` : "";

  const handleInvite = async () => {
    if (!inviteLink) return;
    const shareData = {
      title: "Swolemeter 친구 대결",
      text: "내 몸 점수랑 대결해보자! 누가 더 높을까? 💪",
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
      setError(e instanceof ApiError ? e.message : "닉네임 저장에 실패했습니다");
    } finally {
      setSavingNick(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">로그인이 필요합니다.</p>
        <Link href="/login" className="btn-primary inline-block text-center">
          로그인
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
          <h1 className="hero-headline-kr text-text-primary mt-1">친구 대결</h1>
        </div>
        <div className="card space-y-2" style={{ borderColor: "var(--color-accent-cyan)" }}>
          <p className="text-sm text-text-primary">미성년 회원은 신체 점수 경쟁(랭킹) 기능이 제한됩니다.</p>
          <p className="text-xs text-text-dim leading-relaxed">
            성장기에는 체형이 계속 변합니다. 남과 점수를 비교하기보다 나의 변화 기록에 집중해요. 💪
          </p>
        </div>
        <Link href="/history" className="btn-secondary block text-center">
          내 기록 보기
        </Link>
      </div>
    );
  }

  const needsNickname = profile !== null && !profile.display_name;

  return (
    <div className="space-y-8">
      <div>
        <p className="label">Ranking</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">친구 대결</h1>
        <p className="text-sm text-text-secondary mt-2">누가 더 높은 점수일까? 친구를 초대해 대결하세요.</p>
      </div>

      {error && <p className="text-sm text-accent-red">{error}</p>}

      {/* 닉네임 설정 (미설정 시) */}
      {needsNickname && (
        <div className="card space-y-3" style={{ borderColor: "var(--color-accent-cyan)" }}>
          <p className="text-sm text-text-primary">리더보드에 표시할 닉네임을 정해주세요.</p>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder="닉네임 (최대 30자)"
              className="flex-1 rounded-xl px-4 py-3 text-sm bg-transparent border"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            />
            <button
              onClick={handleSaveNickname}
              disabled={savingNick || !nickname.trim()}
              className="btn-primary px-5 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 내 점수 */}
      <div className="text-center py-2">
        <p className="label">My Score</p>
        <p className="text-sm text-text-secondary tracking-widest mt-0.5">내 점수</p>
        {profile?.score != null ? (
          <p className="display-number text-accent-cyan cyan-glow mt-2" style={{ fontSize: "clamp(64px, 20vw, 140px)" }}>
            {profile.score}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-text-dim text-sm">아직 측정 기록이 없어요</p>
            <Link href="/scan/new" className="btn-primary inline-block text-center">
              분석하러 가기
            </Link>
          </div>
        )}
      </div>

      {/* 초대 버튼 */}
      <button onClick={handleInvite} className="btn-primary w-full">
        {copied ? "✅ 초대 링크 복사됨!" : "👊 친구 초대해서 대결하기"}
      </button>

      {/* 리더보드 */}
      <div>
        <p className="section-label mb-3">Leaderboard <span className="sub">· 순위표</span></p>
        {entries.length <= 1 ? (
          <div className="card text-center py-6">
            <p className="text-sm text-text-secondary">아직 친구가 없어요.</p>
            <p className="text-xs text-text-dim mt-1">위 버튼으로 친구를 초대하면 대결이 시작됩니다!</p>
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
                  {e.is_me && <span className="text-xs text-text-dim ml-1">(나)</span>}
                </span>
                <span className="font-display text-xl" style={{ color: e.score != null ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
                  {e.score ?? "-"}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-text-dim mt-3 text-center">
          점수는 최신 분석의 상위 %를 100점 만점으로 환산한 값입니다 (높을수록 우세).
        </p>
      </div>
    </div>
  );
}

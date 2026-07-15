"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type ConsentStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LoadingScreen } from "@/components/loading-screen";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, logout, refresh } = useAuth();
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [busy, setBusy] = useState<null | "revoke" | "delete">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ConsentStatus>("/consents/me").then(setConsent).catch(() => setConsent(null));
  }, []);

  const handleRevoke = async () => {
    if (
      !window.confirm(
        "동의를 철회하면 지금까지 저장된 모든 신체 사진과 분석 기록(히스토리)이 즉시 완전 삭제됩니다. 계속하시겠습니까?"
      )
    )
      return;
    setBusy("revoke");
    setError(null);
    setMessage(null);
    try {
      const res = await api.delete<{ deleted_photos: number }>("/consents/body-image");
      await refresh();
      const status = await api.get<ConsentStatus>("/consents/me");
      setConsent(status);
      setMessage(`동의를 철회하고 저장된 사진 ${res.deleted_photos}개를 삭제했습니다.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "철회 처리 중 오류가 발생했습니다");
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "회원 탈퇴 시 계정과 저장된 모든 신체 사진·분석 기록이 즉시 완전 삭제되며 되돌릴 수 없습니다. 정말 탈퇴하시겠습니까?"
      )
    )
      return;
    setBusy("delete");
    setError(null);
    try {
      await api.delete("/auth/me");
      logout();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "탈퇴 처리 중 오류가 발생했습니다");
      setBusy(null);
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

  return (
    <div className="space-y-8">
      <div>
        <p className="label">Settings</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">설정</h1>
      </div>

      <section className="card space-y-1">
        <p className="label">계정</p>
        <p className="text-sm text-text-primary">{user.email}</p>
      </section>

      {message && (
        <p className="text-sm" style={{ color: "var(--color-accent-cyan)" }}>
          {message}
        </p>
      )}
      {error && <p className="text-sm text-accent-red">{error}</p>}

      {/* 신체 사진 동의 관리 */}
      <section className="space-y-3">
        <p className="section-label">Privacy <span className="sub">· 신체 사진 · 개인정보</span></p>
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">신체 사진 수집·보관 동의</p>
            <span
              className="text-xs px-2 py-0.5 rounded-md"
              style={{
                background: consent?.body_image_consent_active ? "rgba(0,184,255,0.15)" : "var(--color-surface)",
                color: consent?.body_image_consent_active ? "var(--color-accent-cyan)" : "var(--color-text-dim)",
              }}
            >
              {consent?.body_image_consent_active ? "동의함" : "동의 안 함"}
            </span>
          </div>
          <p className="text-xs text-text-dim leading-relaxed">
            철회하면 저장된 모든 신체 사진과 분석 기록이 즉시 완전 삭제됩니다.
          </p>
          {consent?.body_image_consent_active && (
            <button
              onClick={handleRevoke}
              disabled={busy !== null}
              className="btn-secondary w-full disabled:opacity-50"
            >
              {busy === "revoke" ? "처리 중..." : "동의 철회 및 사진 삭제"}
            </button>
          )}
          <Link
            href="/privacy"
            className="block text-center text-xs underline text-text-secondary hover:text-text-primary"
          >
            개인정보처리방침 보기
          </Link>
        </div>
      </section>

      {/* 회원 탈퇴 */}
      <section className="space-y-3">
        <p className="section-label" style={{ color: "var(--color-accent-red)" }}>
          Danger Zone <span className="sub">· 회원 탈퇴</span>
        </p>
        <div className="card space-y-3" style={{ borderColor: "var(--color-accent-red)" }}>
          <p className="text-xs text-text-dim leading-relaxed">
            탈퇴하면 계정과 저장된 모든 신체 사진·분석 기록이 즉시 완전 삭제되며 되돌릴 수 없습니다.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={busy !== null}
            className="w-full min-h-11 rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
            style={{ border: "1px solid var(--color-accent-red)", color: "var(--color-accent-red)" }}
          >
            {busy === "delete" ? "처리 중..." : "회원 탈퇴"}
          </button>
        </div>
      </section>
    </div>
  );
}

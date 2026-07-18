"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type ConsentStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { LoadingScreen } from "@/components/loading-screen";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, logout, refresh } = useAuth();
  const { t } = useI18n();
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [busy, setBusy] = useState<null | "revoke" | "delete">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ConsentStatus>("/consents/me").then(setConsent).catch(() => setConsent(null));
  }, []);

  const handleRevoke = async () => {
    if (!window.confirm(t("settings.revoke_confirm"))) return;
    setBusy("revoke");
    setError(null);
    setMessage(null);
    try {
      const res = await api.delete<{ deleted_photos: number }>("/consents/body-image");
      await refresh();
      const status = await api.get<ConsentStatus>("/consents/me");
      setConsent(status);
      setMessage(t("settings.revoke_done").replace("{n}", String(res.deleted_photos)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.error_revoke"));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t("settings.delete_confirm"))) return;
    setBusy("delete");
    setError(null);
    try {
      await api.delete("/auth/me");
      logout();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.error_delete"));
      setBusy(null);
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

  return (
    <div className="space-y-8">
      <div>
        <p className="label">Settings</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">{t("settings.title")}</h1>
      </div>

      <section className="card space-y-1">
        <p className="label">{t("settings.account")}</p>
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
        <p className="section-label">{t("settings.privacy")} <span className="sub">{t("settings.privacy_sub")}</span></p>
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">{t("settings.consent_label")}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-md"
              style={{
                background: consent?.body_image_consent_active ? "rgba(0,184,255,0.15)" : "var(--color-surface)",
                color: consent?.body_image_consent_active ? "var(--color-accent-cyan)" : "var(--color-text-dim)",
              }}
            >
              {consent?.body_image_consent_active ? t("settings.consent_yes") : t("settings.consent_no")}
            </span>
          </div>
          <p className="text-xs text-text-dim leading-relaxed">
            {t("settings.revoke_note")}
          </p>
          {consent?.body_image_consent_active && (
            <button
              onClick={handleRevoke}
              disabled={busy !== null}
              className="btn-secondary w-full disabled:opacity-50"
            >
              {busy === "revoke" ? t("common.processing") : t("settings.revoke_btn")}
            </button>
          )}
          <Link
            href="/privacy"
            className="block text-center text-xs underline text-text-secondary hover:text-text-primary"
          >
            {t("settings.view_privacy")}
          </Link>
        </div>
      </section>

      {/* 회원 탈퇴 */}
      <section className="space-y-3">
        <p className="section-label" style={{ color: "var(--color-accent-red)" }}>
          {t("settings.danger")} <span className="sub">{t("settings.danger_sub")}</span>
        </p>
        <div className="card space-y-3" style={{ borderColor: "var(--color-accent-red)" }}>
          <p className="text-xs text-text-dim leading-relaxed">
            {t("settings.delete_note")}
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={busy !== null}
            className="w-full min-h-11 rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
            style={{ border: "1px solid var(--color-accent-red)", color: "var(--color-accent-red)" }}
          >
            {busy === "delete" ? t("common.processing") : t("settings.delete_btn")}
          </button>
        </div>
      </section>
    </div>
  );
}

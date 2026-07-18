"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type SignupResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

function OAuthCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { t } = useI18n();

  const token = searchParams.get("token");
  const pendingToken = searchParams.get("pending");
  const email = searchParams.get("email");
  const initialError = searchParams.get("error");

  const [birthDate, setBirthDate] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    login(token).then(() => router.push("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    if (!acceptTerms || !acceptPrivacy) {
      setError(t("signup.error_required"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<SignupResponse>("/auth/oauth/complete-signup", {
        pending_token: pendingToken,
        birth_date: birthDate,
        accept_terms: acceptTerms,
        accept_privacy: acceptPrivacy,
        accept_marketing: acceptMarketing,
      });
      await login(result.access_token);
      router.push("/onboarding/body-image-consent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("signup.error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  if (token) {
    return <p className="text-sm text-text-secondary">{t("signup.processing")}</p>;
  }

  if (!pendingToken) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-accent-red">{error ?? t("signup.bad_access")}</p>
        <a href="/login" className="text-sm underline text-text-secondary">
          {t("signup.back_login")}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="text-xl font-semibold text-text-primary">{t("signup.title")}</h1>
      <p className="text-sm text-text-secondary">
        {t("signup.desc").replace("{email}", email ?? "")}
      </p>

      <div className="space-y-1">
        <label className="text-sm font-medium text-text-primary">{t("signup.birth")}</label>
        <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full" />
        <p className="text-xs text-text-secondary">{t("signup.birth_note")}</p>
      </div>

      <div className="card space-y-2">
        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
          <span>{t("signup.terms")}</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            required
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
          />
          <span>{t("signup.privacy")}</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={acceptMarketing}
            onChange={(e) => setAcceptMarketing(e.target.checked)}
          />
          <span>{t("signup.marketing")}</span>
        </label>
      </div>

      {error && <p className="text-sm text-accent-red">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !acceptTerms || !acceptPrivacy}
        className="btn-primary disabled:opacity-50"
      >
        {submitting ? t("common.processing") : t("signup.submit")}
      </button>
    </form>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <OAuthCompleteInner />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export default function BodyImageConsentPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConsent = async (consented: boolean) => {
    if (!consented) {
      router.push("/");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/consents/body-image", { consented: true });
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("consent.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-text-primary">{t("consent.title")}</h1>
      <div className="space-y-3 text-sm text-text-secondary">
        <p>{t("consent.intro")}</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-text-primary">{t("consent.li1_key")}</span>{t("consent.li1")}
          </li>
          <li>
            <span className="text-text-primary">{t("consent.li2_key")}</span>{t("consent.li2")}
          </li>
          <li>
            <span className="text-text-primary">{t("consent.li3_key")}</span>{t("consent.li3")}
          </li>
          <li>
            <span className="text-text-primary">{t("consent.li4_key")}</span>{t("consent.li4")}
          </li>
          <li>{t("consent.li5")}</li>
        </ul>
        <p className="text-xs text-text-dim">
          {t("consent.detail_prefix")}
          <Link href="/privacy" className="underline text-text-secondary hover:text-text-primary">
            {t("consent.detail_link")}
          </Link>
          {t("consent.detail_suffix")}
        </p>
      </div>

      {error && <p className="text-sm text-accent-red">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => handleConsent(true)} disabled={submitting} className="btn-primary flex-1">
          {t("consent.agree")}
        </button>
        <button onClick={() => handleConsent(false)} disabled={submitting} className="btn-secondary flex-1">
          {t("consent.disagree")}
        </button>
      </div>
    </div>
  );
}

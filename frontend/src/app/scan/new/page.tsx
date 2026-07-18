"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export default function ScanCategoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);

  const CATEGORIES = [
    { value: "full_body", en: "FULL BODY", label: t("category.full_body"), desc: t("scannew.full_body_desc") },
    { value: "upper", en: "UPPER BODY", label: t("category.upper"), desc: t("scannew.upper_desc") },
    { value: "lower", en: "LOWER BODY", label: t("category.lower"), desc: t("scannew.lower_desc") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="label">{t("scannew.tag")} <span className="text-text-secondary normal-case">{t("scannew.tag_sub")}</span></p>
        <h1 className="hero-headline-kr text-text-primary mt-1">{t("scannew.title")}</h1>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map((c) => {
          const isSelected = selected === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setSelected(c.value)}
              className="w-full flex items-center justify-between gap-4 rounded border px-5 py-4 min-h-11 text-left transition"
              style={{
                borderColor: isSelected ? "var(--color-accent-cyan)" : "var(--color-border)",
                background: isSelected ? "rgba(0,184,255,0.10)" : "var(--color-surface)",
                boxShadow: isSelected ? "0 0 24px rgba(0,184,255,0.2)" : "none",
              }}
            >
              <div>
                <p
                  className="label-big text-2xl"
                  style={{ color: isSelected ? "var(--color-accent-cyan)" : "var(--color-text-primary)" }}
                >
                  {c.en}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">{c.label} · {c.desc}</p>
              </div>
              {isSelected && <span className="text-accent-cyan text-xl shrink-0">●</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => selected && router.push(`/scan/angles?category=${selected}`)}
        disabled={!selected}
        className="btn-primary disabled:opacity-40"
      >
        {t("common.next")}
      </button>
    </div>
  );
}

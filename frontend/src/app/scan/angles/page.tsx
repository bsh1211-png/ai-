"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type ScanSession } from "@/lib/api";
import { categoryLabel } from "@/lib/muscle-labels";
import { useI18n } from "@/lib/i18n";

const DEFAULT_CHECKED: Record<string, string[]> = {
  full_body: ["front", "back", "side"],
  upper: ["front", "back"],
  lower: ["front"],
};

function AnglesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();
  const category = searchParams.get("category") || "full_body";

  const ANGLE_OPTIONS: Record<string, { value: string; label: string; desc: string }[]> = {
    full_body: [
      { value: "front", label: t("angle.front"), desc: t("angle.front_desc") },
      { value: "back", label: t("angle.back"), desc: t("angle.back_desc") },
      { value: "side", label: t("angle.side"), desc: t("angle.side_desc") },
    ],
    upper: [
      { value: "front", label: t("angle.upper_front"), desc: t("angle.upper_front_desc") },
      { value: "back", label: t("angle.upper_back"), desc: t("angle.upper_back_desc") },
      { value: "side", label: t("angle.upper_side"), desc: t("angle.upper_side_desc") },
    ],
    lower: [
      { value: "front", label: t("angle.lower_front"), desc: t("angle.lower_front_desc") },
      { value: "back", label: t("angle.lower_back"), desc: t("angle.lower_back_desc") },
      { value: "side", label: t("angle.lower_side"), desc: t("angle.lower_side_desc") },
    ],
  };
  const options = ANGLE_OPTIONS[category] ?? ANGLE_OPTIONS.full_body;

  const [selected, setSelected] = useState<string[]>(DEFAULT_CHECKED[category] ?? ["front"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (angle: string) => {
    setSelected((prev) => (prev.includes(angle) ? prev.filter((a) => a !== angle) : [...prev, angle]));
  };

  const handleNext = async () => {
    if (selected.length === 0) {
      setError(t("angles.error_min"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await api.post<ScanSession>("/scans", { category });
      const angleQuery = selected.join(",");
      router.push(`/scan/capture?sessionId=${session.id}&angles=${angleQuery}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("angles.error_session"));
    } finally {
      setBusy(false);
    }
  };

  const ANGLE_EN: Record<string, string> = { front: "FRONT", back: "BACK", side: "SIDE" };

  return (
    <div className="space-y-6">
      <div>
        <p className="label">Angles <span className="text-text-secondary normal-case">· {categoryLabel(category, lang)} {t("angles.tag_suffix")}</span></p>
        <h1 className="hero-headline-kr text-text-primary mt-1">{t("angles.title")}</h1>
      </div>
      <div className="space-y-3">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center gap-3 rounded border px-5 py-4 min-h-11 text-left transition"
              style={{
                borderColor: checked ? "var(--color-accent-cyan)" : "var(--color-border)",
                background: checked ? "rgba(0,184,255,0.10)" : "var(--color-surface)",
              }}
            >
              <span
                className="w-6 h-6 rounded-sm flex items-center justify-center shrink-0 text-xs font-bold"
                style={{
                  background: checked ? "var(--color-accent-cyan)" : "transparent",
                  border: checked ? "none" : "1px solid var(--color-border)",
                  color: "#000000",
                }}
              >
                {checked && "✓"}
              </span>
              <div>
                <p
                  className="label-big text-xl"
                  style={{ color: checked ? "var(--color-accent-cyan)" : "var(--color-text-primary)" }}
                >
                  {ANGLE_EN[opt.value] ?? opt.value}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">{opt.label} · {opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-accent-red">{error}</p>}
      <button onClick={handleNext} disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? t("angles.preparing") : t("angles.start_capture")}
      </button>
    </div>
  );
}

export default function ScanAnglesPage() {
  return (
    <Suspense fallback={null}>
      <AnglesInner />
    </Suspense>
  );
}

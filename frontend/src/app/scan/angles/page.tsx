"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type ScanSession } from "@/lib/api";
import { CATEGORY_KO } from "@/lib/muscle-labels";

const ANGLE_OPTIONS: Record<string, { value: string; label: string; desc: string }[]> = {
  full_body: [
    { value: "front", label: "전면", desc: "정면에서 바라본 모습" },
    { value: "back", label: "후면", desc: "뒤에서 바라본 모습" },
    { value: "side", label: "측면", desc: "옆에서 바라본 모습" },
  ],
  upper: [
    { value: "front", label: "상체 전면", desc: "정면에서 바라본 상체" },
    { value: "back", label: "상체 후면", desc: "뒤에서 바라본 상체" },
    { value: "side", label: "상체 측면", desc: "옆에서 바라본 상체" },
  ],
  lower: [
    { value: "front", label: "하체 전면", desc: "정면에서 바라본 하체" },
    { value: "back", label: "하체 후면", desc: "뒤에서 바라본 하체" },
    { value: "side", label: "하체 측면", desc: "옆에서 바라본 하체" },
  ],
};

const DEFAULT_CHECKED: Record<string, string[]> = {
  full_body: ["front", "back", "side"],
  upper: ["front", "back"],
  lower: ["front"],
};

function AnglesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "full_body";
  const options = ANGLE_OPTIONS[category] ?? ANGLE_OPTIONS.full_body;

  const [selected, setSelected] = useState<string[]>(DEFAULT_CHECKED[category] ?? ["front"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (angle: string) => {
    setSelected((prev) => (prev.includes(angle) ? prev.filter((a) => a !== angle) : [...prev, angle]));
  };

  const handleNext = async () => {
    if (selected.length === 0) {
      setError("최소 1개 각도를 선택해주세요");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await api.post<ScanSession>("/scans", { category });
      const angleQuery = selected.join(",");
      router.push(`/scan/capture?sessionId=${session.id}&angles=${angleQuery}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "세션 생성 중 오류가 발생했습니다");
    } finally {
      setBusy(false);
    }
  };

  const ANGLE_EN: Record<string, string> = { front: "FRONT", back: "BACK", side: "SIDE" };

  return (
    <div className="space-y-6">
      <div>
        <p className="label">Angles <span className="text-text-secondary normal-case">· {CATEGORY_KO[category]} 각도 선택</span></p>
        <h1 className="hero-headline-kr text-text-primary mt-1">어떤 각도를 찍을까요?</h1>
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
        {busy ? "준비 중..." : "촬영 시작"}
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

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type ScanSession } from "@/lib/api";

const CATEGORY_LABEL: Record<string, string> = {
  full_body: "전신",
  upper: "상체",
  lower: "하체",
};

const ANGLE_LABEL: Record<string, Record<string, string>> = {
  full_body: { front: "전면", back: "후면", side: "측면" },
  upper: { front: "상체 전면", back: "상체 후면", side: "상체 측면" },
  lower: { front: "하체 전면", back: "하체 후면", side: "하체 측면" },
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
  const angleLabels = ANGLE_LABEL[category] ?? ANGLE_LABEL.full_body;

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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{CATEGORY_LABEL[category]} — 어떤 각도를 찍을까요?</h1>
      <div className="grid grid-cols-1 gap-3">
        {Object.entries(angleLabels).map(([angle, label]) => (
          <label
            key={angle}
            className="flex items-center gap-3 rounded-xl border px-4 py-4 min-h-11 text-sm font-medium"
          >
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={selected.includes(angle)}
              onChange={() => toggle(angle)}
            />
            {label}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleNext}
        disabled={busy}
        className="w-full min-h-11 rounded-xl bg-black text-white px-4 py-3 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "준비 중..." : "다음"}
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

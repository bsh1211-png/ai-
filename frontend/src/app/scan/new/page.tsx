"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "full_body", symbol: "⬡", label: "전신", desc: "전체 밸런스 분석" },
  { value: "upper", symbol: "△", label: "상체", desc: "어깨·가슴·팔·복근" },
  { value: "lower", symbol: "▽", label: "하체", desc: "허벅지·종아리·힙" },
];

export default function ScanCategoryPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">어디를 분석할까요?</h1>

      <div className="space-y-3">
        {CATEGORIES.map((c) => {
          const isSelected = selected === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setSelected(c.value)}
              className="w-full flex items-center gap-4 rounded-2xl border px-4 py-4 min-h-11 text-left transition"
              style={{
                borderColor: isSelected ? "var(--color-accent-cyan)" : "var(--color-border)",
                background: isSelected ? "rgba(0,229,255,0.10)" : "var(--color-surface)",
              }}
            >
              <span className="text-2xl shrink-0" style={{ color: "var(--color-accent-cyan)" }}>
                {c.symbol}
              </span>
              <div>
                <p className="font-medium text-text-primary">{c.label}</p>
                <p className="text-xs text-text-secondary mt-0.5">{c.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => selected && router.push(`/scan/angles?category=${selected}`)}
        disabled={!selected}
        className="btn-primary disabled:opacity-40"
      >
        다음
      </button>
    </div>
  );
}

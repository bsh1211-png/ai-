"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "full_body", en: "FULL BODY", label: "전신", desc: "전체 밸런스 분석" },
  { value: "upper", en: "UPPER BODY", label: "상체", desc: "어깨·가슴·팔·복근" },
  { value: "lower", en: "LOWER BODY", label: "하체", desc: "허벅지·종아리·힙" },
];

export default function ScanCategoryPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <p className="label">Select Target <span className="text-text-secondary normal-case">· 부위 선택</span></p>
        <h1 className="hero-headline-kr text-text-primary mt-1">어디를 분석할까요?</h1>
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
        다음
      </button>
    </div>
  );
}

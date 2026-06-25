"use client";

import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "full_body", label: "전신", emoji: "🧍" },
  { value: "upper", label: "상체", emoji: "💪" },
  { value: "lower", label: "하체", emoji: "🦵" },
];

export default function ScanCategoryPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">어디를 분석할까요?</h1>
      <div className="grid grid-cols-3 gap-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => router.push(`/scan/angles?category=${c.value}`)}
            className="flex flex-col items-center gap-2 rounded-xl border py-6 min-h-[88px] text-sm font-medium active:scale-95 transition"
          >
            <span className="text-3xl">{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

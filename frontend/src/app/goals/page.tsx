"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Goal } from "@/lib/api";

export default function GoalsPage() {
  const [goalText, setGoalText] = useState("");
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<Goal | null>("/goals/active")
      .then(setActiveGoal)
      .catch(() => setActiveGoal(null));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const goal = await api.post<Goal>("/goals", { goal_text: goalText });
      setActiveGoal(goal);
      setGoalText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "목표 설정 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-xl font-semibold">목표 몸 설정</h1>

      {activeGoal && (
        <div className="border rounded p-4 bg-gray-50">
          <p className="text-xs text-gray-500 mb-1">현재 목표</p>
          <p className="text-sm">{activeGoal.goal_text}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="text-sm font-medium">원하는 몸을 글로 설명해주세요</label>
        <textarea
          required
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder="예: 어깨가 넓고 허리가 가는 역삼각형 체형, 복근이 선명한 몸"
          className="w-full border rounded px-3 py-2 h-28"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "목표 저장"}
        </button>
      </form>
    </div>
  );
}

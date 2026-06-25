"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Goal } from "@/lib/api";
import { AuthedImage } from "@/components/authed-image";

export default function GoalsPage() {
  const [goalText, setGoalText] = useState("");
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [refFile, setRefFile] = useState<File | null>(null);
  const [refConsent, setRefConsent] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refSubmitting, setRefSubmitting] = useState(false);

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

  const handleReferenceUpload = async () => {
    if (!activeGoal || !refFile) return;
    if (!refConsent) {
      setRefError("사진 사용 동의가 필요합니다");
      return;
    }
    setRefSubmitting(true);
    setRefError(null);
    try {
      const form = new FormData();
      form.append("file", refFile);
      form.append("consent", "true");
      const updated = await api.postForm<Goal>(`/goals/${activeGoal.id}/reference-image`, form);
      setActiveGoal(updated);
      setRefFile(null);
    } catch (err) {
      setRefError(err instanceof ApiError ? err.message : "업로드 중 오류가 발생했습니다");
    } finally {
      setRefSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-xl font-semibold">목표(워너비) 몸 설정</h1>

      {activeGoal && (
        <div className="border rounded p-4 bg-gray-50 space-y-3">
          <p className="text-xs text-gray-500">현재 목표</p>
          {activeGoal.goal_text && <p className="text-sm text-gray-900">{activeGoal.goal_text}</p>}
          {activeGoal.reference_image_path && (
            <AuthedImage
              path={`/goals/${activeGoal.id}/reference-image/file`}
              alt="워너비 목표 사진"
              className="w-32 h-32 object-cover rounded-lg border"
            />
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="text-sm font-medium">원하는 몸을 글로 설명해주세요</label>
        <textarea
          required
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder="예: 어깨가 넓고 허리가 가는 역삼각형 체형, 복근이 선명한 몸"
          className="w-full border rounded px-3 py-2 h-28 text-gray-900"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-xl bg-black text-white px-4 py-3 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "목표 저장"}
        </button>
      </form>

      {activeGoal && (
        <div className="space-y-3 border rounded-xl p-4">
          <p className="text-sm font-medium">워너비 사진 업로드 (선택)</p>
          <p className="text-xs text-gray-500">
            본인이 원하는 몸의 사진(인플루언서, 연예인 사진 등)을 올리면 분석 시 함께 비교합니다. AI가 사진을
            보고 위의 목표 텍스트를 사진에 맞게 자동으로 조정합니다. 본인이 권리를 가졌거나 비공개 개인용
            비교 목적으로만 사용함에 동의가 필요합니다.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setRefFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              className="w-4 h-4 mt-0.5"
              checked={refConsent}
              onChange={(e) => setRefConsent(e.target.checked)}
            />
            본인이 권리를 가졌거나 비공개 개인용 비교 목적으로만 사용함에 동의합니다
          </label>
          {refError && <p className="text-sm text-red-600">{refError}</p>}
          <button
            onClick={handleReferenceUpload}
            disabled={refSubmitting || !refFile}
            className="min-h-11 rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {refSubmitting ? "업로드 중..." : "워너비 사진 저장"}
          </button>
        </div>
      )}
    </div>
  );
}

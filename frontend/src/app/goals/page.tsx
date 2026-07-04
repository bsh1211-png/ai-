"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Goal } from "@/lib/api";
import { AuthedImage } from "@/components/authed-image";

export default function GoalsPage() {
  const [goalText, setGoalText] = useState("");
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [refConsent, setRefConsent] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refSubmitting, setRefSubmitting] = useState(false);

  const ensureGoal = async (): Promise<Goal> => {
    if (activeGoal) return activeGoal;
    const created = await api.post<Goal>("/goals", { goal_text: "" });
    setActiveGoal(created);
    return created;
  };

  useEffect(() => {
    api
      .get<Goal | null>("/goals/active")
      .then((g) => {
        setActiveGoal(g);
        if (g?.goal_text) setGoalText(g.goal_text);
      })
      .catch(() => setActiveGoal(null));
  }, []);

  useEffect(() => {
    if (!refFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 선택 파일 변경에 맞춰 미리보기 URL 동기화
      setRefPreview(null);
      return;
    }
    const url = URL.createObjectURL(refFile);
    setRefPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [refFile]);

  const handleSaveText = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSavedMsg(null);
    try {
      const goal = await api.post<Goal>("/goals", { goal_text: goalText });
      setActiveGoal(goal);
      setSavedMsg("✅ 목표가 저장되었어요. 다음 신체 분석부터 이 목표 대비 일치율과 방향 조언이 표시됩니다.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "목표 설정 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReferenceUpload = async () => {
    if (!refFile) return;
    if (!refConsent) {
      setRefError("사진 사용 동의가 필요합니다");
      return;
    }
    setRefSubmitting(true);
    setRefError(null);
    try {
      const goal = await ensureGoal();
      const form = new FormData();
      form.append("file", refFile);
      form.append("consent", "true");
      const updated = await api.postForm<Goal>(`/goals/${goal.id}/reference-image`, form);
      setActiveGoal(updated);
      if (updated.goal_text) setGoalText(updated.goal_text);
      setRefFile(null);
      setSavedMsg(
        updated.goal_text
          ? `✅ 워너비 사진을 분석했어요! AI가 파악한 목표 체형: "${updated.goal_text}"`
          : "✅ 워너비 사진이 저장되었어요."
      );
    } catch (err) {
      setRefError(err instanceof ApiError ? err.message : "업로드 중 오류가 발생했습니다");
    } finally {
      setRefSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="label">Your Goal <span className="text-text-secondary normal-case">· 목표 설정</span></p>
        <h1 className="hero-headline-kr text-text-primary mt-1">워너비 체형을 설정하세요</h1>
      </div>

      {/* 현재 설정된 목표 */}
      {activeGoal?.goal_text ? (
        <div className="card" style={{ borderColor: "var(--color-accent-cyan)" }}>
          <p className="label mb-1" style={{ color: "var(--color-accent-cyan)" }}>Current Goal <span className="normal-case" style={{ color: "var(--color-text-secondary)" }}>· 현재 목표</span></p>
          <p className="text-sm text-text-primary">🎯 {activeGoal.goal_text}</p>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          아직 설정된 목표가 없어요. 사진이나 글로 워너비 체형을 등록하면, 신체 분석 때 목표 일치율과 방향 조언을 받을 수 있어요.
        </p>
      )}

      {/* 저장 완료 알림 */}
      {savedMsg && (
        <div className="card" style={{ borderColor: "var(--color-accent-green)", background: "rgba(57,255,20,0.06)" }}>
          <p className="text-sm text-text-primary leading-relaxed">{savedMsg}</p>
        </div>
      )}

      {/* 워너비 사진 업로드 */}
      <div className="space-y-3">
        <label
          className="w-full flex flex-col items-center justify-center gap-2 rounded py-8 cursor-pointer relative overflow-hidden"
          style={{ border: "2px dashed var(--color-accent-cyan)", boxShadow: "0 0 24px rgba(0,184,255,0.12) inset" }}
        >
          {refPreview || activeGoal?.reference_image_path ? (
            <>
              {refPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={refPreview} alt="워너비 미리보기" className="w-full h-40 object-cover rounded analysis-photo" />
              ) : (
                activeGoal && (
                  <AuthedImage
                    path={`/goals/${activeGoal.id}/reference-image/file`}
                    alt="워너비 목표 사진"
                    className="w-full h-40 object-cover rounded analysis-photo"
                  />
                )
              )}
              <span className="badge-info text-xs px-2 py-1 rounded-md absolute top-2 right-2">변경</span>
            </>
          ) : (
            <>
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: "var(--color-surface-hover)" }}
              >
                📷
              </span>
              <p className="text-sm font-medium text-text-primary">워너비 몸 사진 업로드</p>
              <p className="text-xs text-text-secondary text-center px-6">
                목표로 하는 체형 사진을 올려주세요. AI가 비교 분석합니다
              </p>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setRefFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {refFile && (
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5"
                checked={refConsent}
                onChange={(e) => setRefConsent(e.target.checked)}
              />
              본인이 권리를 가졌거나 비공개 개인용 비교 목적으로만 사용함에 동의합니다
            </label>
            {refError && <p className="text-sm text-accent-red">{refError}</p>}
            <button onClick={handleReferenceUpload} disabled={refSubmitting} className="btn-secondary w-full">
              {refSubmitting ? "업로드 중..." : "워너비 사진 저장"}
            </button>
          </div>
        )}
      </div>

      {/* 텍스트 설명 */}
      <form onSubmit={handleSaveText} className="space-y-3">
        <label className="text-sm font-medium text-text-primary">글로 설명하기</label>
        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder="예: 어깨가 넓고 허리가 가는 역삼각형 체형, 복근이 선명한 몸"
          className="w-full h-28"
        />
        {error && <p className="text-sm text-accent-red">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
          {submitting ? "저장 중..." : "목표 저장"}
        </button>
      </form>
    </div>
  );
}

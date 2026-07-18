"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Goal } from "@/lib/api";
import { AuthedImage } from "@/components/authed-image";
import { useI18n } from "@/lib/i18n";

export default function GoalsPage() {
  const { t } = useI18n();
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
      setSavedMsg(t("goals.saved_text"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("goals.error_save"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReferenceUpload = async () => {
    if (!refFile) return;
    if (!refConsent) {
      setRefError(t("goals.consent_needed"));
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
          ? t("goals.analyzed").replace("{text}", updated.goal_text)
          : t("goals.ref_saved")
      );
    } catch (err) {
      setRefError(err instanceof ApiError ? err.message : t("goals.error_upload"));
    } finally {
      setRefSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="label">{t("goals.tag")} <span className="text-text-secondary normal-case">{t("goals.tag_sub")}</span></p>
        <h1 className="hero-headline-kr text-text-primary mt-1">{t("goals.title")}</h1>
      </div>

      {/* 현재 설정된 목표 */}
      {activeGoal?.goal_text ? (
        <div className="card" style={{ borderColor: "var(--color-accent-cyan)" }}>
          <p className="label mb-1" style={{ color: "var(--color-accent-cyan)" }}>{t("goals.current")} <span className="normal-case" style={{ color: "var(--color-text-secondary)" }}>{t("goals.current_sub")}</span></p>
          <p className="text-sm text-text-primary">🎯 {activeGoal.goal_text}</p>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">{t("goals.none")}</p>
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
                <img src={refPreview} alt={t("goals.ref_preview_alt")} className="w-full h-40 object-cover rounded analysis-photo" />
              ) : (
                activeGoal && (
                  <AuthedImage
                    path={`/goals/${activeGoal.id}/reference-image/file`}
                    alt={t("goals.ref_alt")}
                    className="w-full h-40 object-cover rounded analysis-photo"
                  />
                )
              )}
              <span className="badge-info text-xs px-2 py-1 rounded-md absolute top-2 right-2">{t("goals.change")}</span>
            </>
          ) : (
            <>
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: "var(--color-surface-hover)" }}
              >
                📷
              </span>
              <p className="text-sm font-medium text-text-primary">{t("goals.upload_title")}</p>
              <p className="text-xs text-text-secondary text-center px-6">
                {t("goals.upload_desc")}
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
              {t("goals.consent_label")}
            </label>
            {refError && <p className="text-sm text-accent-red">{refError}</p>}
            <button onClick={handleReferenceUpload} disabled={refSubmitting} className="btn-secondary w-full">
              {refSubmitting ? t("goals.uploading") : t("goals.save_ref")}
            </button>
          </div>
        )}
      </div>

      {/* 텍스트 설명 */}
      <form onSubmit={handleSaveText} className="space-y-3">
        <label className="text-sm font-medium text-text-primary">{t("goals.text_label")}</label>
        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder={t("goals.text_placeholder")}
          className="w-full h-28"
        />
        {error && <p className="text-sm text-accent-red">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
          {submitting ? t("goals.saving") : t("goals.save_goal")}
        </button>
      </form>
    </div>
  );
}

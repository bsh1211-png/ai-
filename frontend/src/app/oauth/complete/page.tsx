"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type SignupResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function OAuthCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const token = searchParams.get("token");
  const pendingToken = searchParams.get("pending");
  const email = searchParams.get("email");
  const initialError = searchParams.get("error");

  const [birthDate, setBirthDate] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    login(token).then(() => router.push("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    if (!acceptTerms || !acceptPrivacy) {
      setError("이용약관과 개인정보 수집·이용 동의는 필수입니다");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<SignupResponse>("/auth/oauth/complete-signup", {
        pending_token: pendingToken,
        birth_date: birthDate,
        accept_terms: acceptTerms,
        accept_privacy: acceptPrivacy,
        accept_marketing: acceptMarketing,
      });
      await login(result.access_token);
      router.push("/onboarding/body-image-consent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "가입 처리 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (token) {
    return <p className="text-sm text-text-secondary">로그인 처리 중...</p>;
  }

  if (!pendingToken) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-accent-red">{error ?? "잘못된 접근입니다"}</p>
        <a href="/login" className="text-sm underline text-text-secondary">
          로그인으로 돌아가기
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="text-xl font-semibold text-text-primary">추가 정보 입력</h1>
      <p className="text-sm text-text-secondary">
        {email}로 소셜 로그인했습니다. 가입을 마치려면 정보를 입력해주세요.
      </p>

      <div className="space-y-1">
        <label className="text-sm font-medium text-text-primary">생년월일</label>
        <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full" />
        <p className="text-xs text-text-secondary">만 14세 미만은 가입할 수 없습니다.</p>
      </div>

      <div className="card space-y-2">
        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
          <span>(필수) 이용약관에 동의합니다</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            required
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
          />
          <span>(필수) 개인정보 수집·이용에 동의합니다</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={acceptMarketing}
            onChange={(e) => setAcceptMarketing(e.target.checked)}
          />
          <span>(선택) 마케팅 정보 수신에 동의합니다</span>
        </label>
      </div>

      {error && <p className="text-sm text-accent-red">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !acceptTerms || !acceptPrivacy}
        className="btn-primary disabled:opacity-50"
      >
        {submitting ? "처리 중..." : "가입 완료"}
      </button>
    </form>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <OAuthCompleteInner />
    </Suspense>
  );
}

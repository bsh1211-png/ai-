"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type SignupResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [devGuardianToken, setDevGuardianToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<SignupResponse>("/auth/signup", {
        email,
        password,
        birth_date: birthDate,
        accept_terms: acceptTerms,
        accept_privacy: acceptPrivacy,
        accept_marketing: acceptMarketing,
        guardian_email: guardianEmail || undefined,
      });
      await login(result.access_token);

      if (result.is_minor && result.guardian_consent_dev_token) {
        setDevGuardianToken(result.guardian_consent_dev_token);
        return;
      }
      router.push("/onboarding/body-image-consent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "가입 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (devGuardianToken) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">가입 완료 — 법정대리인 동의 필요</h1>
        <p className="text-sm text-gray-600">
          미성년자 계정은 법정대리인 동의가 완료되어야 신체 사진을 업로드할 수 있습니다. 실제
          서비스에서는 법정대리인 이메일로 동의 링크가 발송되지만, 개발 환경에서는 아래 버튼으로
          바로 테스트할 수 있습니다.
        </p>
        <a
          href={`/consents/guardian-confirm?token=${devGuardianToken}`}
          className="inline-block rounded bg-black text-white px-4 py-2 text-sm"
        >
          (개발용) 법정대리인 동의 페이지로 이동
        </a>
        <div>
          <button
            onClick={() => router.push("/onboarding/body-image-consent")}
            className="text-sm text-gray-500 underline"
          >
            나중에 하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="text-xl font-semibold">회원가입</h1>

      <div className="space-y-1">
        <label className="text-sm font-medium">이메일</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">비밀번호 (8자 이상)</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">생년월일</label>
        <input
          type="date"
          required
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <p className="text-xs text-gray-500">
          만 14세 미만은 가입할 수 없으며, 만 14~18세는 법정대리인 동의가 필요합니다.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">법정대리인 이메일 (미성년자만 필요)</label>
        <input
          type="email"
          value={guardianEmail}
          onChange={(e) => setGuardianEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="space-y-2 border rounded p-4 bg-gray-50">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            required
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          <span>(필수) 이용약관에 동의합니다</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            required
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
          />
          <span>
            (필수) 개인정보 수집·이용에 동의합니다 (이메일, 생년월일 등 계정 정보를 서비스
            제공 목적으로 수집합니다)
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acceptMarketing}
            onChange={(e) => setAcceptMarketing(e.target.checked)}
          />
          <span>(선택) 마케팅 정보 수신에 동의합니다</span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
      >
        {submitting ? "처리 중..." : "가입하기"}
      </button>
    </form>
  );
}

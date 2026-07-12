"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function BodyImageConsentPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConsent = async (consented: boolean) => {
    if (!consented) {
      router.push("/");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/consents/body-image", { consented: true });
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "동의 처리 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-text-primary">신체 사진 수집·보관 동의</h1>
      <div className="space-y-3 text-sm text-text-secondary">
        <p>
          신체 분석·기록 기능을 사용하려면 촬영 또는 업로드한 사진이 필요합니다. 아래 내용에
          동의하시면 다음과 같이 처리됩니다.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-text-primary">촬영·업로드</span> — 신체 사진을 촬영하거나 업로드합니다.
          </li>
          <li>
            <span className="text-text-primary">AI 분석</span> — 사진은 자세 분석과 신체 코멘트 생성을 위해
            AI(Google Gemini)로 전송·분석됩니다.
          </li>
          <li>
            <span className="text-text-primary">히스토리 저장·보관</span> — 시간에 따른 몸의 변화를
            기록·비교(before/after)하기 위해 사진을 <span className="text-text-primary">암호화된 저장소에 보관</span>합니다.
          </li>
          <li>
            <span className="text-text-primary">보유기간 및 삭제</span> — <span className="text-text-primary">동의를 철회하거나
            회원 탈퇴하면 저장된 사진과 분석 데이터는 즉시 완전 삭제</span>됩니다. 개별 기록도 언제든 삭제할 수 있습니다.
          </li>
          <li>동의를 거부해도 다른 기능은 이용할 수 있으며, 신체 분석·기록 기능만 제한됩니다.</li>
        </ul>
        <p className="text-xs text-text-dim">
          자세한 내용은{" "}
          <Link href="/privacy" className="underline text-text-secondary hover:text-text-primary">
            개인정보처리방침
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </div>

      {error && <p className="text-sm text-accent-red">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => handleConsent(true)} disabled={submitting} className="btn-primary flex-1">
          동의하고 계속하기
        </button>
        <button onClick={() => handleConsent(false)} disabled={submitting} className="btn-secondary flex-1">
          동의하지 않음
        </button>
      </div>
    </div>
  );
}

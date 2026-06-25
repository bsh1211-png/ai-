"use client";

import { useState } from "react";
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
      <h1 className="text-xl font-semibold text-text-primary">카메라/신체 사진 사용 동의</h1>
      <div className="space-y-3 text-sm text-text-secondary">
        <p>
          신체 분석 기능을 사용하려면 사진(직접 촬영 또는 업로드)이 필요합니다. 동의하시면
          다음과 같이 사진이 사용됩니다.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>업로드한 사진은 AI(자세 분석, 신체 코멘트 생성)에만 사용됩니다.</li>
          <li>사진은 암호화된 저장소에 보관되며, 마이페이지에서 언제든 삭제할 수 있습니다.</li>
          <li>동의를 거부해도 다른 기능은 계속 이용할 수 있으며, 신체 분석 기능만 제한됩니다.</li>
          <li>이 동의는 카메라 권한 요청 전에 별도로 받는 동의이며, 마이페이지에서 언제든 철회할 수 있습니다.</li>
        </ul>
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

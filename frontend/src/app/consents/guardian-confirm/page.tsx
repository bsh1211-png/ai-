"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

function GuardianConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 쿼리 토큰 부재를 마운트 시점에 1회 확인
      setStatus("error");
      setMessage("동의 링크가 올바르지 않습니다 (토큰 없음)");
      return;
    }
    setStatus("loading");
    api
      .post("/consents/guardian/confirm", { token })
      .then(() => {
        setStatus("done");
        setMessage("법정대리인 동의가 완료되었습니다. 이제 자녀 계정에서 신체 분석을 이용할 수 있습니다.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "동의 처리 중 오류가 발생했습니다");
      });
  }, [token]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">법정대리인 동의</h1>
      {status === "loading" && <p className="text-sm text-text-secondary">처리 중...</p>}
      {status === "done" && <p className="text-sm text-accent-green">{message}</p>}
      {status === "error" && <p className="text-sm text-accent-red">{message}</p>}
    </div>
  );
}

export default function GuardianConfirmPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text-secondary">불러오는 중...</p>}>
      <GuardianConfirmInner />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type SignupResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SocialLoginButtons } from "@/components/social-login-buttons";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<Pick<SignupResponse, "access_token">>("/auth/login", {
        email,
        password,
      });
      await login(result.access_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="text-xl font-semibold text-text-primary">로그인</h1>
      <div className="space-y-1">
        <label className="text-sm font-medium text-text-primary">이메일</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-text-primary">비밀번호</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full"
        />
      </div>
      {error && <p className="text-sm text-accent-red">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
        {submitting ? "처리 중..." : "로그인"}
      </button>

      <div className="flex items-center gap-2 text-xs text-text-dim">
        <div className="flex-1 border-t" style={{ borderColor: "var(--color-border)" }} />
        또는
        <div className="flex-1 border-t" style={{ borderColor: "var(--color-border)" }} />
      </div>
      <SocialLoginButtons />
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type State = "working" | "done" | "needlogin" | "error";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>("working");
  const [friendName, setFriendName] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // 로그인 후 자동 수락되도록 코드 저장 (auth-context가 처리)
      window.localStorage.setItem("pending_invite", code);
      setState("needlogin");
      return;
    }
    api
      .post<{ friend_name: string }>("/friends/accept", { code })
      .then((r) => {
        setFriendName(r.friend_name);
        setState("done");
        setTimeout(() => router.push("/ranking"), 1500);
      })
      .catch(() => setState("error"));
  }, [user, loading, code, router]);

  return (
    <div className="space-y-6 pt-10 text-center">
      <div>
        <p className="label">Friend Duel</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">친구 대결 초대</h1>
      </div>

      {state === "working" && <p className="text-sm text-text-secondary">초대를 처리하는 중...</p>}

      {state === "needlogin" && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            로그인하면 친구와의 대결에 바로 참여할 수 있어요. 💪
          </p>
          <Link href="/login" className="btn-primary inline-block text-center">
            로그인하고 참여하기
          </Link>
        </div>
      )}

      {state === "done" && (
        <div className="space-y-3">
          <p className="text-2xl font-display gradient-score">연결 완료! 🔥</p>
          <p className="text-sm text-text-secondary">
            {friendName}님과 친구가 되었습니다. 랭킹으로 이동합니다...
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-4">
          <p className="text-sm text-accent-red">유효하지 않거나 만료된 초대입니다.</p>
          <Link href="/ranking" className="btn-secondary inline-block text-center">
            내 랭킹 보기
          </Link>
        </div>
      )}
    </div>
  );
}

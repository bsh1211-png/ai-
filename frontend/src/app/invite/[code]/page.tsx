"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

type State = "working" | "done" | "needlogin" | "error";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useI18n();
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
        <p className="label">{t("invite.tag")}</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">{t("invite.title")}</h1>
      </div>

      {state === "working" && <p className="text-sm text-text-secondary">{t("invite.working")}</p>}

      {state === "needlogin" && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">{t("invite.needlogin")}</p>
          <Link href="/login" className="btn-primary inline-block text-center">
            {t("invite.login_join")}
          </Link>
        </div>
      )}

      {state === "done" && (
        <div className="space-y-3">
          <p className="text-2xl font-display gradient-score">{t("invite.done")}</p>
          <p className="text-sm text-text-secondary">
            {t("invite.done_desc").replace("{name}", friendName)}
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-4">
          <p className="text-sm text-accent-red">{t("invite.error")}</p>
          <Link href="/ranking" className="btn-secondary inline-block text-center">
            {t("invite.view_ranking")}
          </Link>
        </div>
      )}
    </div>
  );
}

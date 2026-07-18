"use client";

import Link from "next/link";
import { SocialLoginButtons } from "@/components/social-login-buttons";
import { useI18n } from "@/lib/i18n";

// 로그아웃 상태에서 처음 진입 시 보여주는 로그인 화면. 홈(/)과 /login에서 공용으로 사용.
export function LoginScreen() {
  const { t } = useI18n();
  return (
    <div className="space-y-8 pt-2 sm:pt-8">
      <div>
        <p className="label">
          {t("login.tag")} <span className="text-text-secondary normal-case">{t("login.tag_sub")}</span>
        </p>
        <h1 className="hero-headline text-text-primary mt-3">
          {t("login.headline1")}<br />
          <span className="text-accent-cyan cyan-glow">{t("login.headline2")}</span>
        </h1>
        <p className="text-sm text-text-secondary mt-4">{t("login.desc")}</p>
      </div>
      <SocialLoginButtons />
      <p className="text-center text-sm">
        <Link href="/about" className="text-text-secondary underline hover:text-text-primary">
          {t("login.what_is")}
        </Link>
      </p>
      <p className="hashtag text-center text-lg">#SWOLEMETER</p>
      <div className="flex justify-center gap-4 text-xs text-text-dim pt-2">
        <Link href="/about" className="hover:text-text-secondary">{t("login.footer_about")}</Link>
        <Link href="/privacy" className="hover:text-text-secondary">{t("login.footer_privacy")}</Link>
      </div>
    </div>
  );
}

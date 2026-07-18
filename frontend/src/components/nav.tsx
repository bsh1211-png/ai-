"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export function Nav() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 border-b border-border"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(20px)" }}
    >
      <div className="max-w-[440px] sm:max-w-[600px] lg:max-w-[720px] mx-auto px-5 sm:px-8 h-16 flex items-center gap-5 text-sm">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span
            className="w-7 h-7 rounded-sm flex items-center justify-center font-display font-extrabold text-sm"
            style={{ background: "#00B8FF", color: "#000" }}
          >
            S
          </span>
          <span className="label-big text-text-primary text-xl" style={{ letterSpacing: "1px" }}>
            SWOLEMETER
          </span>
        </Link>

        <div className="flex-1" />

        <button
          onClick={() => setLang(lang === "ko" ? "en" : "ko")}
          className="text-text-dim hover:text-text-secondary text-xs border border-border rounded px-1.5 py-0.5"
          aria-label="Toggle language"
        >
          {t("nav.lang_toggle")}
        </button>

        {user ? (
          <>
            {!user.is_minor && (
              <Link href="/ranking" className="text-text-secondary hover:text-text-primary text-xs">
                {t("common.ranking")}
              </Link>
            )}
            <Link href="/settings" className="text-text-dim hover:text-text-secondary text-xs">
              {t("common.settings")}
            </Link>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="text-text-dim hover:text-text-secondary text-xs"
            >
              {t("common.logout")}
            </button>
          </>
        ) : (
          <Link href="/login" className="text-text-secondary hover:text-text-primary text-sm">
            {t("common.login")}
          </Link>
        )}
      </div>
    </nav>
  );
}

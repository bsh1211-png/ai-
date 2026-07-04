"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function Nav() {
  const { user, logout } = useAuth();
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

        {user ? (
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="text-text-dim hover:text-text-secondary text-xs"
          >
            로그아웃
          </button>
        ) : (
          <Link href="/login" className="text-text-secondary hover:text-text-primary text-sm">
            로그인
          </Link>
        )}
      </div>
    </nav>
  );
}

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
      style={{ background: "rgba(10,10,15,0.7)", backdropFilter: "blur(20px)" }}
    >
      <div className="max-w-[480px] mx-auto px-5 h-16 flex items-center gap-5 text-sm">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-extrabold text-bg text-sm"
            style={{ background: "linear-gradient(135deg, #00E5FF, #A855F7)" }}
          >
            S
          </span>
          <span className="font-display font-bold text-text-primary" style={{ letterSpacing: "1px" }}>
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

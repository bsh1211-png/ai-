"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function Nav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <nav className="border-b border-black/10 px-6 py-3 flex items-center gap-6 text-sm">
      <Link href="/" className="font-semibold">
        피지크 분석
      </Link>
      {user && (
        <>
          <Link href="/scan/new">신체 분석</Link>
          <Link href="/goals">목표 몸</Link>
          <Link href="/history">기록</Link>
        </>
      )}
      <div className="flex-1" />
      {user ? (
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="text-gray-500 hover:underline"
        >
          로그아웃 ({user.email})
        </button>
      ) : (
        <>
          <Link href="/login">로그인</Link>
          <Link href="/signup">가입</Link>
        </>
      )}
    </nav>
  );
}

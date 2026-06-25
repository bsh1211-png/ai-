"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">내 몸을 분석하고, 목표 몸에 맞는 운동을 추천받자</h1>
        <p className="text-gray-600">
          사진으로 신체를 분석하고, 부족한 부위에 맞는 운동과 루틴을 추천받는 개인 PT 에이전트입니다.
        </p>
        <div className="flex gap-3">
          <Link href="/signup" className="rounded bg-black text-white px-4 py-2 text-sm">
            시작하기
          </Link>
          <Link href="/login" className="rounded border px-4 py-2 text-sm">
            로그인
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">안녕하세요, {user.email}님</h1>
      <div className="flex gap-3 flex-wrap">
        <Link href="/scan/new" className="rounded bg-black text-white px-4 py-2 text-sm">
          신체 분석 시작
        </Link>
        <Link href="/goals" className="rounded border px-4 py-2 text-sm">
          목표 몸 설정
        </Link>
        <Link href="/history" className="rounded border px-4 py-2 text-sm">
          기록 보기
        </Link>
      </div>
    </div>
  );
}

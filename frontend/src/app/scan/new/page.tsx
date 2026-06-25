"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ScanSession } from "@/lib/api";

const CATEGORIES = [
  { value: "full_360", label: "전신 360도 (전면/후면/측면)" },
  { value: "upper_front", label: "상체 전면부" },
  { value: "upper_back", label: "상체 후면부" },
  { value: "lower", label: "하체" },
  { value: "custom", label: "직접 선택" },
];

const ANGLES = [
  { value: "front", label: "전면" },
  { value: "back", label: "후면" },
  { value: "side", label: "측면" },
  { value: "upper", label: "상체" },
  { value: "lower", label: "하체" },
];

export default function NewScanPage() {
  const router = useRouter();
  const [category, setCategory] = useState("full_360");
  const [session, setSession] = useState<ScanSession | null>(null);
  const [angle, setAngle] = useState("front");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<ScanSession>("/scans", { category });
      setSession(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "세션 생성 중 오류가 발생했습니다");
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async () => {
    if (!session || !file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const updated = await api.postForm<ScanSession>(
        `/scans/${session.id}/images?angle=${angle}`,
        form
      );
      setSession(updated);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "업로드 중 오류가 발생했습니다");
    } finally {
      setBusy(false);
    }
  };

  const startAnalysis = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/scans/${session.id}/analyze`);
      router.push(`/scan/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "분석 요청 중 오류가 발생했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-xl font-semibold">신체 분석 시작</h1>

      {!session && (
        <div className="space-y-3">
          <label className="text-sm font-medium">분석 카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            onClick={createSession}
            disabled={busy}
            className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}

      {session && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-2">
              업로드된 사진 ({session.images.length}장)
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              {session.images.map((img) => (
                <li key={img.id}>
                  {ANGLES.find((a) => a.value === img.angle)?.label ?? img.angle}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 border rounded p-4">
            <label className="text-sm font-medium">각도 선택</label>
            <select
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {ANGLES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <button
              onClick={uploadImage}
              disabled={busy || !file}
              className="rounded border px-4 py-2 text-sm disabled:opacity-50"
            >
              사진 추가
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={startAnalysis}
            disabled={busy || session.images.length === 0}
            className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            분석 시작
          </button>
        </div>
      )}

      {error && !session && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

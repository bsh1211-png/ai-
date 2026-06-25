"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type ProgressLog, type ScanSession } from "@/lib/api";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadAll = () => {
    api.get<ScanSession[]>("/scans").then(setSessions);
    api.get<ProgressLog[]>("/progress").then(setLogs);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/progress", {
        weight_kg: weight ? Number(weight) : undefined,
        notes: notes || undefined,
      });
      setWeight("");
      setNotes("");
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "기록 추가 중 오류가 발생했습니다");
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold mb-4">분석 기록</h1>
        {sessions.length === 0 && <p className="text-sm text-gray-500">아직 분석 기록이 없습니다.</p>}
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="border rounded p-3 flex justify-between items-center text-sm">
              <div>
                <p>{new Date(s.scan_date).toLocaleDateString("ko-KR")}</p>
                <p className="text-xs text-gray-500">{s.category} · {s.status}</p>
              </div>
              <Link href={`/scan/${s.id}`} className="text-sm underline">
                보기
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">몸무게/메모 기록</h2>
        <form onSubmit={addLog} className="flex gap-2 mb-4">
          <input
            type="number"
            step="0.1"
            placeholder="몸무게(kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="border rounded px-3 py-2 w-32"
          />
          <input
            type="text"
            placeholder="메모"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
          <button type="submit" className="rounded bg-black text-white px-4 py-2 text-sm">
            기록 추가
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <ul className="space-y-1 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="text-gray-600">
              {new Date(l.logged_at).toLocaleDateString("ko-KR")} —{" "}
              {l.weight_kg ? `${l.weight_kg}kg` : ""} {l.notes}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

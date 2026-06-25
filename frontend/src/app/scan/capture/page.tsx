"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type ScanSession } from "@/lib/api";

const ANGLE_LABEL: Record<string, string> = {
  front: "전면",
  back: "후면",
  side: "측면",
};

type Phase = "loading_camera" | "ready" | "countdown" | "scanning" | "analyzing" | "done" | "error";

function CaptureInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const angles = (searchParams.get("angles") || "front").split(",");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("loading_camera");
  const [angleIndex, setAngleIndex] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentAngle = angles[angleIndex];

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPhase("ready");
      })
      .catch(() => {
        setErrorMessage("카메라에 접근할 수 없습니다. 브라우저의 카메라 권한을 허용해주세요.");
        setPhase("error");
      });

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const captureFrame = (): Promise<{ blob: Blob; dataUrl: string } | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return resolve(null);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          resolve({ blob, dataUrl: canvas.toDataURL("image/jpeg", 0.9) });
        },
        "image/jpeg",
        0.9
      );
    });
  };

  const startCountdown = () => {
    setPhase("countdown");
    setCountdown(5);
  };

  const runCaptureAndUpload = async () => {
    const result = await captureFrame();
    if (!result) {
      setErrorMessage("촬영에 실패했습니다. 다시 시도해주세요.");
      setPhase("ready");
      return;
    }
    setCapturedDataUrl(result.dataUrl);
    setPhase("scanning");

    try {
      const form = new FormData();
      form.append("file", result.blob, `${currentAngle}.jpg`);
      await api.postForm<ScanSession>(`/scans/${sessionId}/images?angle=${currentAngle}`, form);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "업로드 중 오류가 발생했습니다");
      setPhase("error");
      return;
    }

    // 스캔 연출 최소 노출 시간
    setTimeout(() => {
      if (angleIndex + 1 < angles.length) {
        setAngleIndex((i) => i + 1);
        setCapturedDataUrl(null);
        setPhase("ready");
      } else {
        void startAnalysis();
      }
    }, 1800);
  };

  const startAnalysis = async () => {
    setPhase("analyzing");
    try {
      await api.post(`/scans/${sessionId}/analyze`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "분석 요청 중 오류가 발생했습니다");
      setPhase("error");
      return;
    }

    const poll = async () => {
      try {
        const session = await api.get<ScanSession>(`/scans/${sessionId}`);
        if (session.status === "completed") {
          setPhase("done");
          return;
        }
        if (session.status === "failed") {
          setErrorMessage(session.error_message ?? "분석에 실패했습니다");
          setPhase("error");
          return;
        }
      } catch {
        // 네트워크 일시 오류는 다음 polling에서 재시도
      }
      setTimeout(poll, 3000);
    };
    poll();
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 카운트다운이 0이 되는 순간 바로 촬영 트리거
      void runCaptureAndUpload();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  if (phase === "error") {
    return (
      <div className="space-y-4 text-center pt-10">
        <p className="text-accent-red text-sm">{errorMessage}</p>
        <button onClick={() => router.push("/scan/new")} className="btn-secondary">
          처음으로
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50 px-6"
        style={{ background: "rgba(10,10,15,0.85)" }}
      >
        <div className="card text-center space-y-6 max-w-xs w-full py-8">
          <p className="text-2xl font-bold font-display gradient-score">분석 완료! 🔥</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => router.push(`/scan/${sessionId}`)} className="btn-primary">
              결과 보기
            </button>
            <button onClick={() => router.push("/scan/new")} className="btn-secondary">
              재분석
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed left-0 right-0 bottom-0 top-16 z-30" style={{ background: "var(--color-bg)" }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover ${
          phase === "scanning" || phase === "analyzing" ? "invisible" : ""
        }`}
      />

      {(phase === "scanning" || phase === "analyzing") && capturedDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={capturedDataUrl} alt="촬영된 사진" className="absolute inset-0 w-full h-full object-cover" />
      )}

      {(phase === "scanning" || phase === "analyzing") && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="scan-laser-line" />
          <div className="absolute inset-x-0 bottom-24 text-center">
            <p className="text-white text-lg font-semibold drop-shadow">몸 상태 스캔 중...</p>
          </div>
        </div>
      )}

      {phase === "loading_camera" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-text-secondary text-sm">카메라를 불러오는 중...</p>
        </div>
      )}

      {(phase === "ready" || phase === "countdown") && (
        <div className="absolute inset-x-0 top-6 text-center">
          <span className="badge-info text-sm inline-block px-3 py-1 rounded-full font-display">
            {ANGLE_LABEL[currentAngle] ?? currentAngle} 촬영 ({angleIndex + 1}/{angles.length})
          </span>
        </div>
      )}

      {phase === "countdown" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p
            className="font-display font-extrabold"
            style={{ fontSize: "clamp(4rem, 25vw, 10rem)", color: "#00E5FF" }}
          >
            {countdown === 0 ? "📸" : countdown}
          </p>
        </div>
      )}

      {phase === "ready" && (
        <div className="absolute inset-x-0 bottom-10 flex justify-center px-6">
          <button
            onClick={startCountdown}
            aria-label="촬영 시작"
            className="w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition"
            style={{ border: "4px solid #00E5FF" }}
          >
            <span
              className="w-14 h-14 rounded-full"
              style={{ background: "linear-gradient(135deg, #00E5FF, #A855F7)" }}
            />
          </button>
        </div>
      )}
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={null}>
      <CaptureInner />
    </Suspense>
  );
}

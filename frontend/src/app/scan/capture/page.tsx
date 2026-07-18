"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type ScanSession } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Phase = "loading_camera" | "ready" | "countdown" | "scanning" | "analyzing" | "done" | "error";

function CaptureInner() {
  const router = useRouter();
  const { t } = useI18n();
  const ANGLE_LABEL: Record<string, string> = {
    front: t("angle_short.front"),
    back: t("angle_short.back"),
    side: t("angle_short.side"),
  };
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
  // 전면(user) / 후면(environment) 카메라 전환. 전신 촬영은 후면 카메라 화질이 좋다.
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const currentAngle = angles[angleIndex];

  // facingMode가 바뀌면 기존 스트림을 끊고 해당 카메라로 다시 연결한다.
  useEffect(() => {
    let cancelled = false;
    setPhase("loading_camera");
    // 이전 스트림 정리
    streamRef.current?.getTracks().forEach((t) => t.stop());

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPhase("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage(t("capture.camera_error"));
        setPhase("error");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  // 모바일 카메라 원본은 매우 커서(업로드 지연·서버 메모리 부담·분석 오류의 원인)
  // 긴 변 기준 1280px로 축소해 인코딩한다. 자세 인식/AI 분석에는 충분한 해상도.
  const MAX_DIM = 1280;
  const captureFrame = (): Promise<{ blob: Blob; dataUrl: string } | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return resolve(null);
      let w = video.videoWidth;
      let h = video.videoHeight;
      const longest = Math.max(w, h);
      if (longest > MAX_DIM) {
        const scale = MAX_DIM / longest;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          resolve({ blob, dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
        },
        "image/jpeg",
        0.85
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
      setErrorMessage(t("capture.capture_fail"));
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
      setErrorMessage(err instanceof ApiError ? err.message : t("capture.upload_error"));
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
      setErrorMessage(err instanceof ApiError ? err.message : t("capture.analyze_error"));
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
          setErrorMessage(session.error_message ?? t("capture.analyze_fail"));
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
          {t("capture.to_start")}
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
          <p className="text-2xl font-bold font-display gradient-score">{t("capture.done")}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => router.push(`/scan/${sessionId}`)} className="btn-primary">
              {t("capture.view_result")}
            </button>
            <button onClick={() => router.push("/scan/new")} className="btn-secondary">
              {t("capture.reanalyze")}
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
        <img src={capturedDataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}

      {(phase === "scanning" || phase === "analyzing") && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="scan-laser-line" />
          <div className="absolute inset-x-0 bottom-24 text-center">
            <p className="text-white text-lg font-semibold drop-shadow">{t("capture.scanning")}</p>
          </div>
        </div>
      )}

      {phase === "loading_camera" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-text-secondary text-sm">{t("capture.loading_camera")}</p>
        </div>
      )}

      {(phase === "ready" || phase === "countdown") && (
        <>
          {/* 가이드 프레임 — 시안 글로우 코너 마커 */}
          <div className="absolute inset-8 pointer-events-none">
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <span
                key={corner}
                className="absolute w-10 h-10"
                style={{
                  top: corner.startsWith("t") ? 0 : "auto",
                  bottom: corner.startsWith("b") ? 0 : "auto",
                  left: corner.endsWith("l") ? 0 : "auto",
                  right: corner.endsWith("r") ? 0 : "auto",
                  borderTop: corner.startsWith("t") ? "3px solid #00E5FF" : "none",
                  borderBottom: corner.startsWith("b") ? "3px solid #00E5FF" : "none",
                  borderLeft: corner.endsWith("l") ? "3px solid #00E5FF" : "none",
                  borderRight: corner.endsWith("r") ? "3px solid #00E5FF" : "none",
                  filter: "drop-shadow(0 0 8px rgba(0,229,255,0.8))",
                }}
              />
            ))}
          </div>
          <div className="absolute inset-x-0 top-6 text-center">
            <p className="label-big text-accent-cyan text-2xl cyan-glow">
              CAPTURE {angleIndex + 1} OF {angles.length}
            </p>
            <p className="label mt-1" style={{ color: "#fff" }}>
              {ANGLE_LABEL[currentAngle] ?? currentAngle} · {t("capture.capture_of").replace("{i}", String(angleIndex + 1)).replace("{total}", String(angles.length))}
            </p>
          </div>
        </>
      )}

      {phase === "ready" && (
        <button
          onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
          aria-label="Toggle front/rear camera"
          className="absolute top-6 right-5 rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 active:scale-95 transition"
          style={{
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            border: "1px solid rgba(0,229,255,0.5)",
            backdropFilter: "blur(4px)",
          }}
        >
          🔄 {facingMode === "user" ? t("capture.to_rear") : t("capture.to_front")}
        </button>
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
            aria-label="Start capture"
            className="w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition"
            style={{ border: "4px solid #00E5FF", boxShadow: "0 0 30px rgba(0,229,255,0.6)" }}
          >
            <span className="w-14 h-14 rounded-full" style={{ background: "#00B8FF" }} />
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

import type { HeadlineStats } from "./api";
import type { Lang } from "./translations";

const WIDTH = 1080;
const HEIGHT = 1350;
export const SERVICE_URL = "swolemeter.vercel.app";

const CARD_LABELS: Record<Lang, { top: string; sync: string; bodyfat: string; symmetry: string; tagline: string }> = {
  ko: { top: "일반인 대비 상위", sync: "목표 일치율", bodyfat: "체지방", symmetry: "대칭", tagline: "AI 체형 분석 · 지금 나의 순위는?" },
  en: { top: "RANKED IN TOP", sync: "GOAL MATCH", bodyfat: "BODY FAT", symmetry: "SYMMETRY", tagline: "AI Physique Analysis · Where do you rank?" },
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function generateShareCardBlob(
  stats: HeadlineStats,
  dateLabel: string,
  lang: Lang = "ko"
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  await document.fonts.ready;
  const L = CARD_LABELS[lang];

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 배경 — 순수 블랙 + 상단 라디얼 글로우
  ctx.fillStyle = "#050507";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(WIDTH / 2, 560, 60, WIDTH / 2, 560, 820);
  glow.addColorStop(0, "rgba(0,184,255,0.28)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 얇은 시안 테두리 프레임
  ctx.strokeStyle = "rgba(0,184,255,0.35)";
  ctx.lineWidth = 3;
  roundRect(ctx, 40, 40, WIDTH - 80, HEIGHT - 80, 40);
  ctx.stroke();

  ctx.textAlign = "center";

  // ── 상단 로고 바 ──
  ctx.font = "800 44px Outfit, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("SWOLEMETER", WIDTH / 2, 160);
  ctx.font = "500 24px Pretendard, sans-serif";
  ctx.fillStyle = "#00B8FF";
  ctx.fillText(L.tagline, WIDTH / 2, 205);

  // ── 상위 % 라벨 ──
  ctx.font = "700 38px Pretendard, sans-serif";
  ctx.fillStyle = "#8A8A92";
  ctx.fillText(L.top, WIDTH / 2, 400);

  // ── 거대 퍼센트 — TOP 워드 + 큰 숫자 ──
  const pct = stats.percentile;
  ctx.save();
  ctx.shadowColor = "rgba(0,229,255,0.7)";
  ctx.shadowBlur = 70;
  if (pct === null || pct === undefined) {
    ctx.font = "400 200px 'Bebas Neue', 'Archivo Black', sans-serif";
    ctx.fillStyle = "#00B8FF";
    ctx.fillText("—", WIDTH / 2, 700);
  } else {
    // "TOP" 워드마크
    ctx.font = "400 90px 'Bebas Neue', 'Archivo Black', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("TOP", WIDTH / 2, 540);
    // 큰 숫자 + %
    ctx.font = "400 360px 'Bebas Neue', 'Archivo Black', sans-serif";
    ctx.fillStyle = "#00B8FF";
    ctx.fillText(`${pct}%`, WIDTH / 2, 830);
  }
  ctx.restore();

  // ── 목표 일치율 (있을 때) ──
  let y = 950;
  if (stats.sync_rate !== null && stats.sync_rate !== undefined) {
    ctx.font = "700 34px Pretendard, sans-serif";
    ctx.fillStyle = "#8A8A92";
    ctx.fillText(L.sync, WIDTH / 2, y);
    ctx.font = "400 100px 'Bebas Neue', 'Archivo Black', sans-serif";
    ctx.fillStyle = "#FF6B35";
    ctx.fillText(`${stats.sync_rate}%`, WIDTH / 2, y + 100);
    y += 150;
  }

  // ── 미니 스탯 뱃지 (체지방 / 대칭) ──
  const badgeY = 1140;
  const badges: [string, string, string][] = [
    [L.bodyfat, stats.body_fat_estimate_pct != null ? `${stats.body_fat_estimate_pct}%` : "-", "#39FF14"],
    [L.symmetry, stats.symmetry_score != null ? `${stats.symmetry_score}` : "-", "#00B8FF"],
  ];
  const spacing = (WIDTH - 160) / 2;
  badges.forEach(([label, value, color], i) => {
    const x = 80 + spacing * i + spacing / 2;
    ctx.font = "700 26px Pretendard, sans-serif";
    ctx.fillStyle = "#8A8A92";
    ctx.fillText(label, x, badgeY);
    ctx.font = "400 68px 'Bebas Neue', 'Archivo Black', sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(value, x, badgeY + 72);
  });

  // ── 하단 워터마크 (해시태그 + 서비스 URL) ──
  ctx.font = "400 46px 'Bebas Neue', 'Archivo Black', sans-serif";
  ctx.fillStyle = "#00B8FF";
  ctx.fillText("#SWOLEMETER", WIDTH / 2, 1265);

  // 서비스 URL — 이 이미지만 봐도 어디서 만든 건지 알 수 있게
  ctx.font = "700 30px Pretendard, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(SERVICE_URL, WIDTH / 2, 1310);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

// 네이티브 공유 시트로 이미지 파일 공유 (모바일: 인스타/X/왓츠앱 등 선택 가능)
export async function shareCardImage(blob: Blob, filename: string, text: string): Promise<"shared" | "unsupported"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch {
      // 사용자가 취소 — 조용히 무시
      return "shared";
    }
  }
  return "unsupported";
}

export function downloadCard(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 하위호환: 기존 호출부(공유 or 다운로드 폴백)
export async function shareOrDownloadCard(blob: Blob, filename: string): Promise<void> {
  const result = await shareCardImage(blob, filename, "Swolemeter");
  if (result === "unsupported") downloadCard(blob, filename);
}

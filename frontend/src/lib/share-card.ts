import type { HeadlineStats } from "./api";

const WIDTH = 1080;
const HEIGHT = 1350;

export async function generateShareCardBlob(stats: HeadlineStats, dateLabel: string): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0A0A0F";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, 420, 80, WIDTH / 2, 420, 700);
  glow.addColorStop(0, "rgba(0,229,255,0.18)");
  glow.addColorStop(1, "rgba(10,10,15,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 로고
  ctx.textAlign = "center";
  ctx.fillStyle = "#8888A0";
  ctx.font = "600 32px Outfit, sans-serif";
  ctx.fillText("SWOLEMETER", WIDTH / 2, 140);

  // 상위 %
  ctx.font = "800 64px Outfit, sans-serif";
  ctx.fillStyle = "#E8E8EC";
  ctx.fillText("일반인 대비 상위", WIDTH / 2, 420);

  const percentileGradient = ctx.createLinearGradient(WIDTH / 2 - 200, 0, WIDTH / 2 + 200, 0);
  percentileGradient.addColorStop(0, "#00E5FF");
  percentileGradient.addColorStop(1, "#A855F7");
  ctx.font = "900 180px Outfit, sans-serif";
  ctx.fillStyle = percentileGradient;
  ctx.fillText(`${stats.percentile ?? "-"}%`, WIDTH / 2, 600);

  if (stats.sync_rate !== null) {
    ctx.font = "700 40px Outfit, sans-serif";
    ctx.fillStyle = "#E8E8EC";
    ctx.fillText("목표 싱크율", WIDTH / 2, 760);
    ctx.font = "900 100px Outfit, sans-serif";
    ctx.fillStyle = "#FF6B35";
    ctx.fillText(`${stats.sync_rate}%`, WIDTH / 2, 880);
  }

  const badgeY = 1050;
  const badges: [string, string | number, string][] = [
    ["체지방", `${stats.body_fat_estimate_pct ?? "-"}%`, "#39FF14"],
    ["복근선명도", `${stats.ab_definition_score ?? "-"}/10`, "#FF6B35"],
    ["대칭", stats.symmetry_score !== null ? `${stats.symmetry_score}` : "-", "#00E5FF"],
  ];
  const spacing = WIDTH / 3;
  badges.forEach(([label, value, color], i) => {
    const x = spacing * i + spacing / 2;
    ctx.font = "600 28px Pretendard, sans-serif";
    ctx.fillStyle = "#8888A0";
    ctx.fillText(label, x, badgeY);
    ctx.font = "800 44px Outfit, sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(String(value), x, badgeY + 60);
  });

  ctx.font = "500 28px Pretendard, sans-serif";
  ctx.fillStyle = "#555570";
  ctx.fillText(dateLabel, WIDTH / 2, 1250);
  ctx.fillText("AI 추정 · 엔터테인먼트 목적", WIDTH / 2, 1290);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export async function shareOrDownloadCard(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Swolemeter 분석 결과" });
      return;
    } catch {
      // 사용자가 공유를 취소한 경우 등 - 다운로드로 폴백
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, 520, 80, WIDTH / 2, 520, 760);
  glow.addColorStop(0, "rgba(0,184,255,0.22)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = "center";

  // 로고
  ctx.fillStyle = "#8A8A92";
  ctx.font = "700 30px Outfit, sans-serif";
  ctx.fillText("SWOLEMETER", WIDTH / 2, 150);

  // 상위 % 라벨
  ctx.font = "700 40px Pretendard, sans-serif";
  ctx.fillStyle = "#8A8A92";
  ctx.fillText("일반인 대비 상위", WIDTH / 2, 400);

  // 거대 퍼센트 — 단색 시안 + 글로우
  ctx.save();
  ctx.shadowColor = "rgba(0,229,255,0.6)";
  ctx.shadowBlur = 60;
  ctx.font = "400 320px 'Bebas Neue', 'Archivo Black', sans-serif";
  ctx.fillStyle = "#00B8FF";
  ctx.fillText(`${stats.percentile ?? "-"}%`, WIDTH / 2, 720);
  ctx.restore();

  if (stats.sync_rate !== null) {
    ctx.font = "700 36px Pretendard, sans-serif";
    ctx.fillStyle = "#8A8A92";
    ctx.fillText("목표 일치율", WIDTH / 2, 850);
    ctx.font = "400 110px 'Bebas Neue', 'Archivo Black', sans-serif";
    ctx.fillStyle = "#FF6B35";
    ctx.fillText(`${stats.sync_rate}%`, WIDTH / 2, 960);
  }

  const badgeY = 1110;
  const badges: [string, string | number, string][] = [
    ["체지방", `${stats.body_fat_estimate_pct ?? "-"}%`, "#39FF14"],
    ["대칭", stats.symmetry_score !== null ? `${stats.symmetry_score}` : "-", "#00B8FF"],
  ];
  const spacing = WIDTH / 2;
  badges.forEach(([label, value, color], i) => {
    const x = spacing * i + spacing / 2;
    ctx.font = "700 28px Pretendard, sans-serif";
    ctx.fillStyle = "#8A8A92";
    ctx.fillText(label, x, badgeY);
    ctx.font = "400 64px 'Bebas Neue', 'Archivo Black', sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(String(value), x, badgeY + 70);
  });

  // 해시태그 풋터
  ctx.font = "400 44px 'Bebas Neue', 'Archivo Black', sans-serif";
  ctx.fillStyle = "#00B8FF";
  ctx.fillText("#SWOLEMETER", WIDTH / 2, 1270);

  ctx.font = "500 26px Pretendard, sans-serif";
  ctx.fillStyle = "#4A4A52";
  ctx.fillText(dateLabel, WIDTH / 2, 1320);

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

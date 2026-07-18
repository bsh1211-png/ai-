import type { Lang } from "./translations";

export const MUSCLE_KO: Record<string, string> = {
  chest: "가슴",
  shoulders: "어깨",
  triceps: "삼두",
  biceps: "이두",
  forearms: "전완",
  lats: "광배근",
  traps: "승모근",
  "middle back": "등 중부",
  "lower back": "허리",
  abdominals: "복근",
  "serratus anterior": "전거근",
  glutes: "둔근",
  quadriceps: "대퇴사두근",
  hamstrings: "햄스트링",
  calves: "종아리",
  abductors: "외전근",
  adductors: "내전근",
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// 한국어: "가슴 (chest)", 영어: "Chest"
export function muscleLabel(part: string, lang: Lang = "ko"): string {
  if (lang === "en") return titleCase(part);
  const ko = MUSCLE_KO[part.toLowerCase()];
  return ko ? `${ko} (${part})` : part;
}

export const CATEGORY_KO: Record<string, string> = {
  full_body: "전신",
  upper: "상체",
  lower: "하체",
};

const CATEGORY_EN: Record<string, string> = {
  full_body: "Full Body",
  upper: "Upper Body",
  lower: "Lower Body",
};

export function categoryLabel(category: string, lang: Lang = "ko"): string {
  const map = lang === "en" ? CATEGORY_EN : CATEGORY_KO;
  return map[category] ?? category;
}

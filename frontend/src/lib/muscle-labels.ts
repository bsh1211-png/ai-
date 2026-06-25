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

export function muscleLabel(part: string): string {
  const ko = MUSCLE_KO[part.toLowerCase()];
  return ko ? `${ko} (${part})` : part;
}

export const CATEGORY_KO: Record<string, string> = {
  full_body: "전신",
  upper: "상체",
  lower: "하체",
};

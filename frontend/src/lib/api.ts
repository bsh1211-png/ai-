export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("access_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem("access_token", token);
  else window.localStorage.removeItem("access_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let message = `요청에 실패했습니다 (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // 응답 본문이 JSON이 아닌 경우 기본 메시지 사용
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface User {
  id: string;
  email: string;
  is_minor: boolean;
  is_banned: boolean;
}

export interface SignupResponse {
  access_token: string;
  is_minor: boolean;
}

export interface ConsentStatus {
  is_minor: boolean;
  body_image_consent_active: boolean;
  can_upload: boolean;
  blocked_reason: string | null;
}

export interface ScanImage {
  id: string;
  angle: string;
  uploaded_at: string;
}

export interface ScanSession {
  id: string;
  category: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  scan_date: string;
  error_message: string | null;
  images: ScanImage[];
}

export interface WeakPoint {
  part: string;
  severity: string;
  comment: string;
  goal_action?: "grow" | "reduce" | "definition" | "maintain";
}

export interface GoalComparison {
  goal_type: string;
  goal_text: string | null;
  sync_rate?: number | null;
  direction?: "bulk_up" | "slim_down" | "recomposition" | "maintain" | null;
  feedback?: string | null;
}

export interface HeadlineStats {
  percentile: number | null;
  sync_rate: number | null;
  body_fat_estimate_pct: number | null;
  ab_definition_score: number | null;
  symmetry_score: number | null;
  is_estimate: boolean;
}

export interface RoutineItem {
  exercise_id: string;
  exercise_name: string;
  target_part: string;
  sets: number | null;
  reps: number | null;
  rest_seconds: number | null;
  duration_minutes?: number;
}

export interface Routine {
  name: string;
  items: RoutineItem[];
}

export interface AnalysisReport {
  id: string;
  summary: string;
  weak_points: WeakPoint[];
  recommended_exercise_ids: string[];
  goal_comparison: GoalComparison | null;
  headline_stats: HeadlineStats | null;
  recommended_routine: Routine | null;
  created_at: string;
}

export interface Exercise {
  id: string;
  name_en: string;
  name_ko: string | null;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string | null;
  level: string | null;
  image_paths: string[];
  youtube_video_ids: string[];
}

export interface Goal {
  id: string;
  goal_type: string;
  goal_text: string | null;
  reference_image_path: string | null;
  reference_image_consent: boolean;
  is_active: boolean;
  created_at: string;
}

export interface HistorySummary {
  summary: string;
  generated_at: string;
  has_enough_data: boolean;
}

export interface ProgressLog {
  id: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  logged_at: string;
}

export interface RankingProfile {
  invite_code: string;
  display_name: string | null;
  score: number | null;
  percentile: number | null;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  is_me: boolean;
  score: number | null;
  percentile: number | null;
  rank: number | null;
}

export function exerciseImageUrl(relativePath: string): string {
  // 절대 URL(예: CDN/GitHub 호스팅 이미지)은 그대로 사용
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${API_URL}/media/${relativePath}`;
}

export async function fetchAuthedBlobUrl(path: string): Promise<string> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new ApiError(response.status, "이미지를 불러오지 못했습니다");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

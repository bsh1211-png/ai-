import { API_URL } from "@/lib/api";

const PROVIDERS = [
  { id: "google", label: "Google로 계속하기", className: "bg-white border text-gray-900" },
  { id: "kakao", label: "카카오로 계속하기", className: "bg-[#FEE500] text-black" },
  { id: "naver", label: "네이버로 계속하기", className: "bg-[#03C75A] text-white" },
];

export function SocialLoginButtons() {
  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => (
        <a
          key={p.id}
          href={`${API_URL}/auth/oauth/${p.id}/start`}
          className={`block min-h-11 w-full rounded-xl px-4 py-3 text-sm font-medium text-center ${p.className}`}
        >
          {p.label}
        </a>
      ))}
    </div>
  );
}

// 인증 확인/네트워크 대기 중 보여주는 브랜드 로딩 화면.
// Render 무료 플랜 콜드스타트(~수십 초) 동안 검은 빈 화면 대신 이 화면을 노출한다.
export function LoadingScreen({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-32">
      <span
        className="inline-block rounded-full animate-spin"
        style={{
          width: 44,
          height: 44,
          border: "3px solid rgba(0,184,255,0.15)",
          borderTopColor: "var(--color-accent-cyan)",
          filter: "drop-shadow(0 0 6px rgba(0,184,255,0.5))",
        }}
      />
      <p className="text-sm text-text-secondary tracking-wide">{label}</p>
    </div>
  );
}

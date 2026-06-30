import { SocialLoginButtons } from "@/components/social-login-buttons";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary">로그인 / 회원가입</h1>
        <p className="text-sm text-text-secondary">Google 계정으로 바로 시작하세요</p>
      </div>
      <SocialLoginButtons />
    </div>
  );
}

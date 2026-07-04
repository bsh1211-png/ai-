import { SocialLoginButtons } from "@/components/social-login-buttons";

export default function LoginPage() {
  return (
    <div className="space-y-8 pt-2 sm:pt-8">
      <div>
        <p className="label">Sign In <span className="text-text-secondary normal-case">· 로그인</span></p>
        <h1 className="hero-headline text-text-primary mt-3">
          KNOW YOUR<br />
          <span className="text-accent-cyan cyan-glow">BODY</span>
        </h1>
        <p className="text-sm text-text-secondary mt-4">Google 계정으로 바로 시작하세요</p>
      </div>
      <SocialLoginButtons />
      <p className="hashtag text-center text-lg">#SWOLEMETER</p>
    </div>
  );
}

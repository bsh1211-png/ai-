import Link from "next/link";

export const metadata = {
  title: "서비스 소개 · Swolemeter",
  description:
    "Swolemeter는 AI가 체형 사진을 분석해 상위 %, 체지방·대칭 추정치, 보완 부위와 맞춤 운동 루틴을 제안하는 AI 퍼스널 트레이닝 웹 서비스입니다.",
};

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-1.5">
      <p className="label-big text-accent-cyan text-lg">{title}</p>
      <p className="text-sm text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-display text-sm"
        style={{ background: "rgba(0,184,255,0.15)", color: "var(--color-accent-cyan)" }}
      >
        {n}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-sm text-text-secondary leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-text-primary">{q}</p>
      <p className="text-sm text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="space-y-10 pb-16">
      {/* 히어로 */}
      <div>
        <p className="label">About Swolemeter</p>
        <h1 className="hero-headline text-text-primary mt-2">
          YOUR AI<br />
          <span className="text-accent-cyan cyan-glow">PT COACH</span>
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mt-5">
          Swolemeter(스웰미터)는 AI가 당신의 체형 사진을 분석해 현재 몸 상태를 진단하고, 목표 몸에
          다가가기 위한 맞춤 운동과 루틴을 제안하는 AI 퍼스널 트레이닝 웹 서비스입니다. 값비싼 PT 없이도,
          내 몸을 객관적으로 바라보고 무엇을 개선해야 할지 방향을 잡을 수 있습니다.
        </p>
      </div>

      {/* 주요 기능 */}
      <section className="space-y-3">
        <p className="section-label">Features <span className="sub">· 주요 기능</span></p>
        <div className="space-y-3">
          <Feature title="AI 체형 분석">
            촬영하거나 업로드한 사진을 AI가 분석해 전 세계 일반인 대비 상위 몇 %인지, 체지방률·좌우 대칭
            점수 등 추정치를 제공합니다. 모든 수치는 재미와 동기부여를 위한 추정치이며 의학적 진단이
            아닙니다.
          </Feature>
          <Feature title="목표 대비 진단">
            원하는 몸(워너비)을 설정하면, 현재 몸과의 일치율과 어떤 부위를 키우고 줄여야 하는지 방향을
            구체적으로 짚어줍니다.
          </Feature>
          <Feature title="맞춤 운동 · 루틴 추천">
            보완이 필요한 부위에 맞춰 운동과 세트·횟수 루틴을 추천합니다. 각 운동은 참고 영상과 함께
            제공됩니다.
          </Feature>
          <Feature title="변화 기록 (히스토리)">
            분석을 반복하며 시간에 따른 몸의 변화를 기록하고 비교할 수 있습니다. 꾸준함을 눈으로 확인하며
            동기를 유지하세요.
          </Feature>
          <Feature title="친구 대결 · 랭킹">
            친구를 초대해 점수를 겨루는 리더보드로 재미를 더합니다. 친구에게는 닉네임과 점수만 공개되며,
            신체 사진은 절대 노출되지 않습니다.
          </Feature>
        </div>
      </section>

      {/* 사용 방법 */}
      <section className="space-y-4">
        <p className="section-label">How It Works <span className="sub">· 이용 방법</span></p>
        <div className="space-y-4">
          <Step n={1} title="Google 계정으로 시작">
            별도 가입 없이 Google 계정으로 간편하게 로그인합니다.
          </Step>
          <Step n={2} title="촬영 또는 업로드">
            전신·상체·하체 중 원하는 부위를 카메라로 촬영하거나 사진을 업로드합니다.
          </Step>
          <Step n={3} title="AI 분석 결과 확인">
            수십 초 안에 상위 %, 체지방 추정치, 보완 부위, 맞춤 운동 루틴을 담은 리포트를 받습니다.
          </Step>
          <Step n={4} title="기록하고 개선">
            추천 루틴을 따라 운동하고, 다시 분석해 변화를 기록하며 목표에 다가갑니다.
          </Step>
        </div>
      </section>

      {/* 개인정보 안내 */}
      <section className="space-y-3">
        <p className="section-label">Your Privacy <span className="sub">· 개인정보 보호</span></p>
        <div className="card space-y-2">
          <p className="text-sm text-text-secondary leading-relaxed">
            신체 사진은 민감한 정보입니다. Swolemeter는 사진을 암호화된 저장소에 보관하며, 본인만 조회할 수
            있습니다. 동의를 철회하거나 회원 탈퇴하면 저장된 사진과 분석 데이터는 즉시 완전 삭제됩니다.
          </p>
          <Link href="/privacy" className="text-sm underline text-accent-cyan">
            개인정보처리방침 자세히 보기 →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <p className="section-label">FAQ <span className="sub">· 자주 묻는 질문</span></p>
        <div className="space-y-4">
          <Faq q="분석 결과의 수치는 정확한가요?">
            상위 %, 체지방률 등은 사진을 기반으로 한 AI 추정치로, 재미와 동기부여를 위한 참고 값입니다.
            정밀 측정이나 의학적 진단이 아니므로 건강 관련 판단은 전문가와 상의하세요.
          </Faq>
          <Faq q="사진은 안전하게 보관되나요?">
            네. 암호화된 저장소에 보관되며 본인만 접근할 수 있습니다. 원하실 때 언제든 개별 기록을 삭제하거나,
            동의 철회·탈퇴로 전체를 즉시 삭제할 수 있습니다.
          </Faq>
          <Faq q="비용이 드나요?">
            기본 분석 기능은 무료로 제공됩니다.
          </Faq>
          <Faq q="미성년자도 이용할 수 있나요?">
            만 14세 이상부터 이용할 수 있습니다. 미성년 이용자에게는 자존감을 해치지 않는 코멘트만 제공하며,
            점수 경쟁(랭킹) 기능에서 제외됩니다.
          </Faq>
        </div>
      </section>

      {/* CTA */}
      <div className="space-y-3 pt-2 text-center">
        <Link href="/" className="btn-primary block cyan-glow-strong">
          지금 시작하기
        </Link>
        <p className="hashtag text-lg">#SWOLEMETER</p>
      </div>
    </div>
  );
}

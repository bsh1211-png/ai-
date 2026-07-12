import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 · Swolemeter",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <div className="space-y-1.5 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6 pb-16">
      <div>
        <p className="label">Privacy Policy</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">개인정보처리방침</h1>
        <p className="text-xs text-text-dim mt-2">최종 개정일: 2026-07-12 · 버전 v1</p>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">
        Swolemeter(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 중요하게 생각하며, 개인정보보호법 등 관련
        법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 어떤 목적으로 수집·이용·보관하고, 이용자가 어떤
        권리를 갖는지 설명합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <ul className="list-disc pl-5 space-y-1">
          <li>계정 정보: 이메일 주소, 생년월일(미성년 여부 확인용), 소셜 로그인 식별자</li>
          <li>
            <span className="text-text-primary">신체 사진</span>: 이용자가 촬영·업로드한 신체 이미지 및 목표(워너비)
            참조 이미지 <span className="text-text-dim">(민감할 수 있는 정보)</span>
          </li>
          <li>분석 결과 및 기록: AI 분석 수치(상위 %, 체지방 추정치 등), 코멘트, 진행 기록</li>
          <li>서비스 이용 과정에서 생성되는 접속 로그, IP 주소</li>
        </ul>
      </Section>

      <Section title="2. 수집·이용 목적">
        <ul className="list-disc pl-5 space-y-1">
          <li>회원 식별 및 로그인, 미성년자 보호 조치</li>
          <li>신체 사진에 대한 AI 자세 분석 및 체형 코멘트 제공</li>
          <li>
            <span className="text-text-primary">시간에 따른 신체 변화 기록·비교(히스토리)</span> 제공을 위한 사진 및
            분석 결과 보관
          </li>
        </ul>
      </Section>

      <Section title="3. 보유 및 이용 기간">
        <p>
          수집한 개인정보는 회원 탈퇴 시 또는 해당 동의를 철회하는 즉시 파기합니다. 특히
          <span className="text-text-primary"> 신체 사진과 분석 데이터는 동의 철회 또는 탈퇴 즉시 저장소에서
          완전히 삭제</span>됩니다. 이용자는 개별 기록도 언제든 직접 삭제할 수 있습니다. 관련 법령에 따라
          별도 보관 의무가 있는 경우에는 해당 기간 동안 분리 보관 후 파기합니다.
        </p>
      </Section>

      <Section title="4. 제3자 제공 및 처리위탁">
        <p>서비스는 개인정보를 외부에 판매하지 않습니다. 다만 서비스 제공을 위해 아래 업체에 처리를 위탁합니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="text-text-primary">Google (Gemini AI)</span> — 신체 사진 분석 처리. 분석을 위해 사진이
            Google로 전송됩니다.
          </li>
          <li>
            <span className="text-text-primary">Google (OAuth)</span> — 소셜 로그인 인증.
          </li>
          <li>
            <span className="text-text-primary">Supabase</span> — 데이터베이스 및 사진 저장(암호화).
          </li>
          <li>
            <span className="text-text-primary">Render / Vercel</span> — 서버 및 웹 호스팅.
          </li>
        </ul>
      </Section>

      <Section title="5. 이용자의 권리">
        <p>
          이용자는 언제든 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있으며, 동의를 철회하거나
          회원 탈퇴를 할 수 있습니다. 이는{" "}
          <Link href="/settings" className="underline text-text-secondary hover:text-text-primary">
            설정
          </Link>{" "}
          화면에서 직접 수행할 수 있습니다.
        </p>
      </Section>

      <Section title="6. 안전성 확보 조치">
        <p>
          신체 사진은 접근이 제한된 암호화 저장소에 보관되며, 인증된 본인만 조회할 수 있습니다. 전송 구간은
          HTTPS로 암호화됩니다.
        </p>
      </Section>

      <Section title="7. 미성년자 보호">
        <p>
          만 14세 미만 아동의 경우 법정대리인의 동의가 필요하며, 미성년 이용자에게는 자존감을 해치지 않는
          범위의 코멘트를 제공하도록 조치하고 있습니다.
        </p>
      </Section>

      <Section title="8. 문의처">
        <p>
          개인정보 관련 문의는 서비스 운영자 이메일(baeseunghyeok.bsh@gmail.com)로 연락 주시기 바랍니다.
        </p>
      </Section>

      <div className="pt-4">
        <Link href="/" className="btn-secondary inline-block text-center">
          홈으로
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <div className="space-y-1.5 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  const { lang } = useI18n();
  const en = lang === "en";

  return (
    <div className="space-y-6 pb-16">
      <div>
        <p className="label">Privacy Policy</p>
        <h1 className="hero-headline-kr text-text-primary mt-1">{en ? "Privacy Policy" : "개인정보처리방침"}</h1>
        <p className="text-xs text-text-dim mt-2">{en ? "Last updated: 2026-07-18 · v2" : "최종 개정일: 2026-07-18 · 버전 v2"}</p>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">
        {en
          ? "Swolemeter (“the Service”) values your privacy and complies with applicable data protection laws. This policy explains what information the Service collects, how it is used and stored, and what rights you have."
          : "Swolemeter(이하 “서비스”)는 이용자의 개인정보를 중요하게 생각하며, 개인정보보호법 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 어떤 목적으로 수집·이용·보관하고, 이용자가 어떤 권리를 갖는지 설명합니다."}
      </p>

      <Section title={en ? "1. Information We Collect" : "1. 수집하는 개인정보 항목"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>{en ? "Account info: email address, date of birth (to verify minor status), social login identifier" : "계정 정보: 이메일 주소, 생년월일(미성년 여부 확인용), 소셜 로그인 식별자"}</li>
          <li>
            <span className="text-text-primary">{en ? "Body photos" : "신체 사진"}</span>
            {en ? ": body images you capture or upload, and inspiration (goal) reference images " : ": 이용자가 촬영·업로드한 신체 이미지 및 목표(워너비) 참조 이미지 "}
            <span className="text-text-dim">{en ? "(potentially sensitive)" : "(민감할 수 있는 정보)"}</span>
          </li>
          <li>{en ? "Analysis results and records: AI figures (top %, body-fat estimate, etc.), comments, progress logs" : "분석 결과 및 기록: AI 분석 수치(상위 %, 체지방 추정치 등), 코멘트, 진행 기록"}</li>
          <li>{en ? "Access logs and IP address generated while using the Service" : "서비스 이용 과정에서 생성되는 접속 로그, IP 주소"}</li>
        </ul>
      </Section>

      <Section title={en ? "2. Purpose of Use" : "2. 수집·이용 목적"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>{en ? "Member identification and login, minor protection measures" : "회원 식별 및 로그인, 미성년자 보호 조치"}</li>
          <li>{en ? "AI pose analysis and body commentary on your photos" : "신체 사진에 대한 AI 자세 분석 및 체형 코멘트 제공"}</li>
          <li>
            <span className="text-text-primary">{en ? "Recording and comparing body changes over time (history)" : "시간에 따른 신체 변화 기록·비교(히스토리)"}</span>
            {en ? " — storing photos and analysis results for this purpose" : " 제공을 위한 사진 및 분석 결과 보관"}
          </li>
        </ul>
      </Section>

      <Section title={en ? "3. Retention & Use Period" : "3. 보유 및 이용 기간"}>
        <p>
          {en
            ? "Collected personal data is destroyed upon account deletion or immediately when you revoke the relevant consent. In particular, "
            : "수집한 개인정보는 회원 탈퇴 시 또는 해당 동의를 철회하는 즉시 파기합니다. 특히"}
          <span className="text-text-primary">
            {en ? "body photos and analysis data are permanently deleted from storage immediately upon consent revocation or account deletion" : " 신체 사진과 분석 데이터는 동의 철회 또는 탈퇴 즉시 저장소에서 완전히 삭제"}
          </span>
          {en ? ". You may also delete individual records yourself at any time. Where retention is required by law, data is stored separately for that period and then destroyed." : "됩니다. 이용자는 개별 기록도 언제든 직접 삭제할 수 있습니다. 관련 법령에 따라 별도 보관 의무가 있는 경우에는 해당 기간 동안 분리 보관 후 파기합니다."}
        </p>
      </Section>

      <Section title={en ? "4. Third Parties & Processors" : "4. 제3자 제공 및 처리위탁"}>
        <p>{en ? "The Service does not sell personal data. To provide the Service, processing is entrusted to the following providers." : "서비스는 개인정보를 외부에 판매하지 않습니다. 다만 서비스 제공을 위해 아래 업체에 처리를 위탁합니다."}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="text-text-primary">Google (Gemini AI)</span>
            {en ? " — body photo analysis. Photos are sent to Google for analysis." : " — 신체 사진 분석 처리. 분석을 위해 사진이 Google로 전송됩니다."}
          </li>
          <li>
            <span className="text-text-primary">Google (OAuth)</span>
            {en ? " — social login authentication." : " — 소셜 로그인 인증."}
          </li>
          <li>
            <span className="text-text-primary">Supabase</span>
            {en ? " — database and photo storage (encrypted)." : " — 데이터베이스 및 사진 저장(암호화)."}
          </li>
          <li>
            <span className="text-text-primary">Render / Vercel</span>
            {en ? " — server and web hosting." : " — 서버 및 웹 호스팅."}
          </li>
          <li>
            <span className="text-text-primary">Google AdSense</span>
            {en ? " — ad delivery and performance measurement (uses cookies / advertising identifiers). Body photos and analysis data are not provided to advertisers." : " — 광고 게재 및 성과 측정(쿠키·광고 식별자 이용). 신체 사진·분석 데이터는 광고 사업자에게 제공되지 않습니다."}
          </li>
        </ul>
      </Section>

      <Section title={en ? "5. Your Rights" : "5. 이용자의 권리"}>
        <p>
          {en ? "You may request access, correction, deletion, or suspension of processing of your personal data at any time, and may revoke consent or delete your account. This can be done directly in " : "이용자는 언제든 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있으며, 동의를 철회하거나 회원 탈퇴를 할 수 있습니다. 이는 "}
          <Link href="/settings" className="underline text-text-secondary hover:text-text-primary">
            {en ? "Settings" : "설정"}
          </Link>
          {en ? "." : " 화면에서 직접 수행할 수 있습니다."}
        </p>
      </Section>

      <Section title={en ? "6. Security Measures" : "6. 안전성 확보 조치"}>
        <p>
          {en
            ? "Body photos are kept in access-restricted encrypted storage and can only be viewed by the authenticated owner. Transmission is encrypted via HTTPS."
            : "신체 사진은 접근이 제한된 암호화 저장소에 보관되며, 인증된 본인만 조회할 수 있습니다. 전송 구간은 HTTPS로 암호화됩니다."}
        </p>
      </Section>

      <Section title={en ? "7. Protection of Minors" : "7. 미성년자 보호"}>
        <p>{en ? "The Service applies the following measures to protect minors." : "서비스는 미성년 이용자를 보호하기 위해 다음 조치를 적용합니다."}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{en ? "Users under 14 cannot sign up." : "만 14세 미만은 회원가입이 제한됩니다."}</li>
          <li>{en ? "Minors aged 14+ receive only constructive comments and are not subject to the harsh (blunt) critique mode." : "만 14세 이상 미성년 이용자에게는 자존감을 해치지 않는 범위의 건설적인 코멘트만 제공하며, 매운맛(직설적 독설) 평가를 적용하지 않습니다."}</li>
          <li>
            {en ? "Minors are " : "미성년 이용자는 신체 점수를 서로 비교하는 "}
            <span className="text-text-primary">{en ? "excluded from the score competition (ranking) feature" : "경쟁(랭킹) 기능에서 제외"}</span>
            {en ? ", and their scores are not shown on other users' leaderboards." : "되며, 다른 이용자의 순위표에도 점수가 노출되지 않습니다."}
          </li>
          <li>{en ? "A note about physical changes during growth is shown on the analysis result screen." : "분석 결과 화면에 성장기 체형 변화에 대한 안내를 함께 제공합니다."}</li>
        </ul>
      </Section>

      <Section title={en ? "8. Advertising & Cookies" : "8. 광고 및 쿠키"}>
        <p>
          {en
            ? "To cover operating costs, the Service may display ads via Google AdSense. Cookies and similar technologies are used in this process."
            : "서비스는 운영 비용 충당을 위해 Google AdSense를 통한 광고를 게재할 수 있습니다. 이 과정에서 쿠키 및 유사 기술이 사용됩니다."}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{en ? "Third-party ad vendors including Google may use cookies to serve ads based on your prior visits." : "Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다."}</li>
          <li>{en ? "Google's use of advertising cookies (e.g., the DoubleClick cookie) enables Google and its partners to serve ads based on your visits." : "Google이 광고 쿠키(예: DoubleClick 쿠키)를 사용함으로써, Google 및 파트너는 이용자의 방문 정보를 토대로 광고를 제공합니다."}</li>
          <li>
            {en ? "You may opt out of personalized ads at " : "이용자는 "}
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="underline text-text-secondary hover:text-text-primary">
              {en ? "Google Ads Settings" : "Google 광고 설정"}
            </a>
            {en ? ", and opt out of third-party cookies at " : "에서 맞춤 광고를 해제할 수 있으며, "}
            <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className="underline text-text-secondary hover:text-text-primary">
              www.aboutads.info
            </a>
            {en ? "." : "에서 제3자 쿠키 사용을 거부할 수 있습니다."}
          </li>
          <li>
            <span className="text-text-primary">
              {en ? "Body photos and analysis data (figures/comments) are not used for advertising or provided to advertisers." : "신체 사진과 분석 데이터(수치·코멘트)는 광고 목적으로 이용되거나 광고 사업자에게 제공되지 않습니다."}
            </span>
            {en ? " Users identified as minors are not served personalized ads." : " 또한 미성년으로 확인된 이용자에게는 맞춤형(개인화) 광고를 제공하지 않습니다."}
          </li>
        </ul>
      </Section>

      <Section title={en ? "9. Contact" : "9. 문의처"}>
        <p>
          {en
            ? "For privacy inquiries, please contact the service operator at baeseunghyeok.bsh@gmail.com."
            : "개인정보 관련 문의는 서비스 운영자 이메일(baeseunghyeok.bsh@gmail.com)로 연락 주시기 바랍니다."}
        </p>
      </Section>

      <div className="pt-4">
        <Link href="/" className="btn-secondary inline-block text-center">
          {en ? "Home" : "홈으로"}
        </Link>
      </div>
    </div>
  );
}

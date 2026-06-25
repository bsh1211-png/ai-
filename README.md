# 피지크 분석 (개인 PT 에이전트)

웨이트 트레이닝을 하는 10~20대를 위한 신체 분석 + 목표 비교 + 운동/루틴 추천 웹 서비스.

## 구조

- `frontend/` — Next.js (TypeScript, Tailwind)
- `backend/` — FastAPI + SQLAlchemy/Alembic + MediaPipe(자세 분석) + Gemini(정성 분석)

## 백엔드 최초 셋업

mediapipe가 아직 Python 3.14를 지원하지 않으므로 **Python 3.13**으로 venv를 만들어야 한다.

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # GEMINI_API_KEY, JWT_SECRET 채우기

python -m scripts.download_pose_model      # pose landmark 모델(.task) 1회 다운로드
alembic upgrade head                        # DB 스키마 생성
python -m scripts.seed_free_exercise_db     # Free Exercise DB(CC0) 운동 데이터 시딩 (873건)

uvicorn app.main:app --reload
```

테스트: `pytest` (Gemini API를 실제로 호출하지 않도록 vision_service는 mock 처리되어 있음)

## 프론트엔드

```bash
cd frontend && npm run dev
```

## 화면 흐름 (2026-06-25 개편)

업로드 대신 라이브 카메라 촬영으로 전환됨: `/scan/new`(전신/상체/하체 선택) → `/scan/angles`(세부 각도 선택, 세션 생성) →
`/scan/capture`(카메라+3초 카운트다운+스캔 애니메이션, 각도별 순차 촬영 → 분석 트리거 → 완료 모달) → `/scan/[id]`(결과).
결과 화면은 상위%/싱크로율을 큰 폰트로 강조하고, "보완이 필요한 부위", 추천 운동(영상 최대 2개), 추천 루틴(세트/횟수)을 보여준다.
목표(`/goals`)는 텍스트 + 워너비 사진(권리/용도 동의 체크 필수)을 함께 저장할 수 있고, 분석 시 두 번째 이미지로 Gemini에 전달된다.

## 알려진 제약/후속 작업

- **카메라 기능은 브라우저 도구로 직접 클릭 테스트하지 못했다** (이 환경엔 카메라 장치/브라우저 자동화가 없음). `getUserMedia`/캔버스 캡처/3초 카운트다운/스캔 애니메이션은 코드 리뷰 + 빌드/타입체크로만 검증했으니, 실제 스마트폰 브라우저에서 한 번 확인 필요.
- 상위%/싱크로율/체지방률/복근선명도(`headline_stats`)는 AI가 사진의 명암·실루엣만으로 "엔터테인먼트 목적"으로 유추한 추정치다. 실제 측정값이 아니며, 화면에 항상 "AI 추정치" 문구를 함께 표시한다.
- YouTube 영상 추천은 `YOUTUBE_API_KEY`가 없으면 빈 목록을 반환한다 (무료 키 발급 필요, 채널 화이트리스트는 추후 직접 큐레이션 필요).
- Gemini Pro는 현재 무료 등급 한도가 0으로 잡혀 있어 항상 Flash로 폴백된다 (구글 쪽에서 한도가 열리면 코드 변경 없이 자동으로 Pro부터 시도함).
- 신체이미지 동의 철회(`DELETE /consents/body-image`) 시 향후 업로드만 차단하며, 과거 업로드 이미지를 자동으로 삭제하지는 않는다 (수동 `DELETE /scans/{id}`로 개별 삭제 필요). 실 사용자 데이터를 다루기 전에 보강 필요.
- 워너비 사진은 업로드 시 체크박스 동의만 받고 있다 (제3자 초상권 관련 법무 검토는 아직 안 됨).
- 이미지 접근 audit log, 보관기간 만료 자동 삭제 배치는 아직 없음.

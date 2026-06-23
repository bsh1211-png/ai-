# 피지크 분석 (개인 PT 에이전트)

웨이트 트레이닝을 하는 10~20대를 위한 신체 분석 + 목표 비교 + 운동/루틴 추천 웹 서비스.

## 구조

- `frontend/` — Next.js (TypeScript, Tailwind)
- `backend/` — FastAPI

## 개발 환경 실행

```bash
# frontend
cd frontend && npm run dev

# backend
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload
```

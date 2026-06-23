import json
import logging
import re

from google import genai
from google.genai import errors
from sqlalchemy.orm import Session

from app.config import settings
from app.core.constants import GUARDIAN_CONSENT_REMINDER
from app.models.quota import ApiQuotaEvent, QuotaEventType

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=settings.gemini_api_key)

# RetryInfo.retryDelay가 이 값보다 길면 "오늘 안에는 회복 안 됨"으로 보고 일일 한도 초과로 취급.
# 단순 분당 쿨다운은 보통 수십 초 단위로 내려오기 때문에 5분을 경계값으로 둔다.
DAILY_RETRY_DELAY_THRESHOLD_SECONDS = 300

ALLOWED_MUSCLE_TAGS = [
    "chest", "shoulders", "triceps", "biceps", "forearms", "lats", "traps",
    "lower back", "abdominals", "glutes", "quadriceps", "hamstrings", "calves",
]

_SYSTEM_INSTRUCTION = f"""너는 웨이트 트레이닝 신체 분석 보조 AI다. 다음 규칙을 반드시 지켜라.
- 의학적 진단을 내리지 말고, 체지방률·질병 관련 단정적 표현을 쓰지 않는다.
- 결핍이 아닌 성장 가능성의 관점으로 서술한다 (예: "부족하다" 대신 "성장 여지가 있다").
- 사용자가 제공한 정량 데이터(어깨/골반 비율, 좌우 대칭성)를 참고하되, 그 자체를 그대로 출력하지 말고 자연스러운 코멘트로 풀어 설명한다.
- 반드시 다음 문장을 overall_comment 마지막에 포함한다: "{GUARDIAN_CONSENT_REMINDER}"
- weak_points의 part 값은 반드시 다음 목록 중에서만 고른다: {", ".join(ALLOWED_MUSCLE_TAGS)}
- 응답은 다음 JSON 스키마를 따른다:
{{
  "body_part_assessment": {{"<부위>": "<코멘트>"}},
  "weak_points": [{{"part": "<부위>", "severity": "low|medium|high", "comment": "<코멘트>"}}],
  "overall_comment": "<종합 코멘트>"
}}
"""


class DailyQuotaExceeded(Exception):
    pass


class StillAnalyzing(Exception):
    pass


def _retry_delay_seconds(error: errors.APIError) -> float | None:
    details = getattr(error, "details", None) or {}
    for detail in details.get("error", {}).get("details", []):
        if detail.get("@type", "").endswith("RetryInfo"):
            match = re.match(r"([\d.]+)s", detail.get("retryDelay", ""))
            if match:
                return float(match.group(1))
    return None


def _is_daily_quota_error(error: errors.APIError) -> bool:
    delay = _retry_delay_seconds(error)
    return delay is not None and delay > DAILY_RETRY_DELAY_THRESHOLD_SECONDS


def _log_quota_event(db: Session, model: str, event_type: QuotaEventType) -> None:
    db.add(ApiQuotaEvent(provider="gemini", model=model, event_type=event_type))
    db.commit()


def _build_prompt(pose_summary: dict, goal_text: str | None) -> str:
    lines = [
        "다음은 사용자의 신체 사진과 자동 측정된 정량 데이터다.",
        f"정량 데이터: {json.dumps(pose_summary, ensure_ascii=False)}",
    ]
    if goal_text:
        lines.append(f"사용자가 원하는 목표 몸 설명: {goal_text}")
    lines.append("위 정보를 참고해 신체를 분석하고 지정된 JSON 스키마로만 응답하라.")
    return "\n".join(lines)


def _call_model(model_name: str, image_bytes: bytes, prompt: str) -> dict:
    response = _client.models.generate_content(
        model=model_name,
        contents=[
            genai.types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            prompt,
        ],
        config=genai.types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


def analyze_body_image(db: Session, image_bytes: bytes, pose_summary: dict, goal_text: str | None) -> dict:
    prompt = _build_prompt(pose_summary, goal_text)

    try:
        return _call_model(settings.gemini_pro_model, image_bytes, prompt)
    except errors.APIError as error:
        if error.code == 429 and _is_daily_quota_error(error):
            _log_quota_event(db, settings.gemini_pro_model, QuotaEventType.daily_quota_exceeded)
            raise DailyQuotaExceeded() from error
        _log_quota_event(db, settings.gemini_pro_model, QuotaEventType.rate_limit)
        logger.info("Gemini Pro 응답 실패(%s), Flash로 폴백", error.code)

    try:
        return _call_model(settings.gemini_flash_model, image_bytes, prompt)
    except errors.APIError as error:
        if error.code == 429 and _is_daily_quota_error(error):
            _log_quota_event(db, settings.gemini_flash_model, QuotaEventType.daily_quota_exceeded)
            raise DailyQuotaExceeded() from error
        _log_quota_event(db, settings.gemini_flash_model, QuotaEventType.rate_limit)
        raise StillAnalyzing() from error

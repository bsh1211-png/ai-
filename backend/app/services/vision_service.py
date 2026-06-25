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

# 분석 카테고리별로 실제 사진에 안 보이는 부위까지 weak_points로 잡아내는 문제(예: 하체 사진인데 복근이 나옴)를
# 막기 위해 카테고리별로 허용 근육 태그를 분리한다. "전거근"은 Free Exercise DB 분류에는 없는 부위라
# 운동 매칭은 별도 curated 데이터로 보강한다 (scripts/seed_curated_exercises.py).
UPPER_MUSCLE_TAGS = [
    "chest", "shoulders", "triceps", "biceps", "forearms", "lats", "traps",
    "middle back", "lower back", "abdominals", "serratus anterior",
]
LOWER_MUSCLE_TAGS = ["glutes", "quadriceps", "hamstrings", "calves", "abductors", "adductors"]

CATEGORY_MUSCLE_TAGS = {
    "upper": UPPER_MUSCLE_TAGS,
    "lower": LOWER_MUSCLE_TAGS,
    "full_body": UPPER_MUSCLE_TAGS + LOWER_MUSCLE_TAGS,
}


def _allowed_muscle_tags(category: str | None) -> list[str]:
    return CATEGORY_MUSCLE_TAGS.get(category or "full_body", CATEGORY_MUSCLE_TAGS["full_body"])


def _build_system_instruction(category: str | None) -> str:
    allowed_tags = _allowed_muscle_tags(category)
    return f"""너는 아주 날카롭고 솔직한 전문 피트니스 트레이너이자 체형 분석가이다.
완벽한 정밀 측정은 불가능하므로, 사진의 명암, 근육의 경계선(복근/어깨 등), 실루엣, 체형 비율을 기반으로
'엔터테인먼트 및 동기부여' 목적의 그럴싸하고 디테일한 수치를 정교하게 유추하여 스토리텔링과 함께 전달하라.
다음 규칙을 반드시 지켜라.
- 좋은 부분은 화끈하게 칭찬하고, 보완이 필요한 부위는 직설적이고 솔직하게 짚어준다 (눈치 보지 말고 트레이너답게 솔직하게).
- 의학적 진단(질병명 등)은 내리지 않는다. 체지방률/상위%/싱크로율은 추정치이며 실측이 아님을 내부적으로 인지하되,
  사용자에게 보여줄 코멘트에는 자신감 있게 단정적으로 서술한다 (이건 동기부여용 엔터테인먼트 콘텐츠다).
- overall_comment 마지막 문장에는 반드시 다음을 포함한다: "{GUARDIAN_CONSENT_REMINDER}"
- 사진에 실제로 보이는 부위만 평가한다. weak_points의 part 값은 반드시 다음 목록 중에서만 고른다
  (이 사진의 분석 범위 밖의 부위는 절대 언급하지 말 것): {", ".join(allowed_tags)}
- headline_stats.percentile은 1~99 사이 정수로, "전 세계 동성 일반 인구(헬스장 이용자가 아니라
  운동을 전혀 하지 않는 사람까지 포함한 전체 일반인) 대비 상위 X%"를 의미한다 (작을수록 상위).
  기준 모집단이 비운동인구까지 포함하는 전체 일반인이라는 점을 반드시 반영해서, 조금이라도 단련된
  체형이라면 상당히 높은(좋은) 순위로 평가하라.
- 워너비(목표) 이미지가 함께 주어진 경우에만 headline_stats.sync_rate(0~100 정수, 목표 몸과의 싱크로율)를 채운다. 없으면 null.
- headline_stats.is_estimate는 항상 true로 고정한다.
- 응답은 다음 JSON 스키마를 따른다:
{{
  "body_part_assessment": {{"<부위>": "<코멘트>"}},
  "weak_points": [{{"part": "<부위>", "severity": "low|medium|high", "comment": "<직설적이고 솔직한 코멘트>"}}],
  "overall_comment": "<종합 코멘트, 좋은 점은 화끈한 칭찬으로 시작>",
  "headline_stats": {{
    "percentile": <int>,
    "sync_rate": <int|null>,
    "body_fat_estimate_pct": <number>,
    "ab_definition_score": <int 1-10>,
    "is_estimate": true
  }}
}}
"""

HISTORY_SUMMARY_SYSTEM_INSTRUCTION = """너는 사용자의 누적된 신체 분석 기록을 보고 변화 추이를 짚어주는 피트니스 코치다.
과거 기록들의 요약과 진행 기록(체중 등)을 보고 시간에 따른 변화를 평가하라.
좋아졌으면 화끈하게 격려하고, 정체/악화됐으면 직설적으로 경고하라. 단정적이고 자신감 있는 톤으로 2~4문장으로 답하라.
의학적 진단은 내리지 말 것. 다음 JSON 스키마로만 응답하라: {"summary": "<총평>"}
"""

GOAL_IMAGE_DESCRIPTION_SYSTEM_INSTRUCTION = """너는 피트니스 트레이너다. 사용자가 업로드한 "워너비(목표) 몸" 사진을 보고,
그 사람의 체형 특징(어깨/허리/가슴/복근/하체 등 눈에 보이는 비율과 발달 정도)을 1~2문장의 한국어 목표 설명으로 요약하라.
실제 인물을 특정하지 말고 체형 특징만 묘사한다 (예: "어깨가 넓고 허리가 가는 역삼각형 체형, 복근이 선명함").
다음 JSON 스키마로만 응답하라: {"goal_text": "<체형 설명>"}
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


def _call_model(model_name: str, contents: list, system_instruction: str) -> dict:
    response = _client.models.generate_content(
        model=model_name,
        contents=contents,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


def generate_with_fallback(db: Session, contents: list, system_instruction: str) -> dict:
    """Pro -> Flash 폴백, 한도초과 이벤트 로깅을 공통으로 처리하는 Gemini 호출 헬퍼."""
    try:
        return _call_model(settings.gemini_pro_model, contents, system_instruction)
    except errors.APIError as error:
        if error.code == 429 and _is_daily_quota_error(error):
            _log_quota_event(db, settings.gemini_pro_model, QuotaEventType.daily_quota_exceeded)
            raise DailyQuotaExceeded() from error
        _log_quota_event(db, settings.gemini_pro_model, QuotaEventType.rate_limit)
        logger.info("Gemini Pro 응답 실패(%s), Flash로 폴백", error.code)

    try:
        return _call_model(settings.gemini_flash_model, contents, system_instruction)
    except errors.APIError as error:
        if error.code == 429 and _is_daily_quota_error(error):
            _log_quota_event(db, settings.gemini_flash_model, QuotaEventType.daily_quota_exceeded)
            raise DailyQuotaExceeded() from error
        _log_quota_event(db, settings.gemini_flash_model, QuotaEventType.rate_limit)
        raise StillAnalyzing() from error


def _build_prompt(pose_summary: dict, goal_text: str | None, has_goal_image: bool) -> str:
    lines = [
        "다음은 사용자의 신체 사진과 자동 측정된 정량 데이터다.",
        f"정량 데이터: {json.dumps(pose_summary, ensure_ascii=False)}",
    ]
    if goal_text:
        lines.append(f"사용자가 원하는 목표 몸 설명: {goal_text}")
    if has_goal_image:
        lines.append("두 번째로 첨부된 이미지는 사용자가 원하는 목표(워너비) 몸 사진이다. 이 사진과 비교해 싱크로율을 추정하라.")
    lines.append("위 정보를 참고해 신체를 분석하고 지정된 JSON 스키마로만 응답하라.")
    return "\n".join(lines)


def analyze_body_image(
    db: Session,
    image_bytes: bytes,
    pose_summary: dict,
    goal_text: str | None,
    goal_image_bytes: bytes | None = None,
    category: str | None = None,
) -> dict:
    prompt = _build_prompt(pose_summary, goal_text, goal_image_bytes is not None)
    contents: list = [genai.types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")]
    if goal_image_bytes:
        contents.append(genai.types.Part.from_bytes(data=goal_image_bytes, mime_type="image/jpeg"))
    contents.append(prompt)

    return generate_with_fallback(db, contents, _build_system_instruction(category))


def generate_history_summary(db: Session, history_context: str) -> str:
    result = generate_with_fallback(db, [history_context], HISTORY_SUMMARY_SYSTEM_INSTRUCTION)
    return result.get("summary", "")


def describe_goal_image(db: Session, image_bytes: bytes) -> str:
    contents = [genai.types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")]
    result = generate_with_fallback(db, contents, GOAL_IMAGE_DESCRIPTION_SYSTEM_INSTRUCTION)
    return result.get("goal_text", "")

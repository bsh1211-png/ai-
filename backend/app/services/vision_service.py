import json
import logging
import re

from google import genai
from google.genai import errors
from sqlalchemy.orm import Session

from app.config import settings
from app.core.constants import ANALYSIS_DISCLAIMER
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


def _build_system_instruction(category: str | None, is_minor: bool = False) -> str:
    allowed_tags = _allowed_muscle_tags(category)
    if is_minor:
        tone_rules = (
            "사용자는 미성년자다. 점수·수치(percentile, 체지방 등)는 아래 기준대로 정직하고 깐깐하게 매기되, "
            "코멘트 톤은 성장기의 자존감을 해치지 않도록 '솔직하되 격려 중심의 건설적인 조언'으로 쓴다. "
            "외모 비하·체형 조롱·모욕성 독설은 절대 쓰지 않고, 부족한 점은 따뜻하게 개선 방향으로 제시한다."
        )
    else:
        tone_rules = (
            "너의 기본 태도는 '냉정하고 깐깐한 프로 트레이너'다. 절대 후하게 주지 말고 짜게 평가한다. "
            "칭찬은 진짜로 뛰어난 부분에만 아껴서 하고, 대부분은 부족한 점을 직설적이고 매섭게 짚는다. "
            "어설픈 위로나 두루뭉술한 칭찬은 금지. 단, 인격 비하·모욕이 아니라 '이걸 이렇게 고쳐라'는 개선 지향의 매운 독설이어야 한다."
        )
    return f"""너는 아주 날카롭고 솔직한 전문 피트니스 트레이너이자 체형 분석가이다.
완벽한 정밀 측정은 불가능하므로, 사진의 명암, 근육의 경계선(복근/어깨 등), 실루엣, 체형 비율을 기반으로
'엔터테인먼트 및 동기부여' 목적의 그럴싸하고 디테일한 수치를 정교하게 유추하여 스토리텔링과 함께 전달하라.
{tone_rules}
다음 규칙을 반드시 지켜라.
- 위에서 정한 톤을 모든 코멘트에 일관되게 적용한다. 보완이 필요한 부위는 직설적으로 짚는다.
- 의학적 진단(질병명 등)은 내리지 않는다. 체지방률/상위%/싱크로율은 추정치이며 실측이 아님을 내부적으로 인지하되,
  사용자에게 보여줄 코멘트에는 자신감 있게 단정적으로 서술한다 (이건 동기부여용 엔터테인먼트 콘텐츠다).
- 상의 탈의, 속옷, 운동복, 비키니/수영복 차림은 체형 분석을 위한 정상적인 사진이므로 보수적으로 굴지 말고 그대로 분석한다.
  단, 성기/항문 노출, 성행위, 명백히 성적인 의도의 이미지는 분석 대상이 아니다 (아래 content_rating 참고).
- content_rating: 위 기준에서 정상 체형 사진이면 "safe", 성기/성행위 등 노골적 성적 콘텐츠가 포함되면 "explicit"으로 표기한다.
- overall_comment는 '목표와 무관하게' 현재 몸 자체에 대한 전체적이고 객관적인 평가를 담는다. 위에서 정한 톤을 그대로 적용해
  전반적 인상·비율·발달 정도·약점을 구체적으로 콕콕 짚는다 (두루뭉술한 칭찬·위로성 멘트 금지, 진짜 뛰어난 부분만 짧게 인정). 목표(워너비) 관련 이야기는 여기 넣지 말고 goal_alignment.feedback에만 담는다.
- overall_comment 마지막 문장에는 반드시 다음을 포함한다: "{ANALYSIS_DISCLAIMER}"
- 사진에 실제로 보이는 부위만 평가한다. weak_points의 part 값은 반드시 다음 목록 중에서만 고른다
  (이 사진의 분석 범위 밖의 부위는 절대 언급하지 말 것): {", ".join(allowed_tags)}
- headline_stats.percentile은 1~99 사이 정수로, "전 세계 동성 일반 인구 대비 상위 X%"를 의미한다 (작을수록 상위=우수).
  절대 후하게 주지 말고, 반드시 아래 기준표에 따라 '짜게' 매긴다:
    · 상위 1~5%: 대회 출전급/피트니스 모델 수준 (선명한 데피니션 + 낮은 체지방 + 발달한 근육이 모두 충족될 때만).
    · 상위 6~15%: 수년간 꾸준히 웨이트한 티가 확실히 나는, 근육이 잘 발달한 몸.
    · 상위 16~35%: 운동한 티는 조금 나지만 근육량·데피니션이 평범한 수준.
    · 상위 40~65%: 운동을 거의/전혀 안 한 일반인의 기본 구간 (근육 발달이 눈에 잘 안 띄면 여기).
    · 상위 70~95%: 근육량이 적고 체지방이 많거나 자세·균형이 무너진 몸.
  운동을 안 하는 평범한 사람을 상위 30% 안쪽으로 주는 것은 명백한 과대평가다. 확신이 없으면 더 낮게(=숫자를 더 크게) 매긴다.
- 목표(워너비) 정보(텍스트 설명 또는 이미지)가 주어지면 headline_stats.sync_rate(0~100 정수, 목표 몸과의 일치율)를
  반드시 채우고 goal_alignment도 채운다. 목표 정보가 전혀 없으면 sync_rate=null, goal_alignment=null로 둔다.
- goal_alignment.direction: 현재 몸에서 목표 몸으로 가려면 어떤 방향인지 판단한다.
  "bulk_up"(전반적으로 더 키워야 함), "slim_down"(전반적으로 감량·볼륨 축소가 필요), "recomposition"(부위별로 키울 곳/줄일 곳이 섞임), "maintain"(거의 도달, 유지) 중 하나.
- 방향성 있는 전문 조언을 반드시 한다. 예를 들어 이미 덩치가 크고 근육량이 많은 사람이 "슬림하고 탄탄한" 몸을 목표로 하면,
  고중량 저반복 대신 중량을 낮추고 반복수를 늘린 훈련 + 유산소 비중 확대를 권하고, 목표 대비 과하게 발달한 부위(예: 승모근/가슴 볼륨)는
  '줄이는' 방향을, 부족한 부위(데피니션/밸런스)는 '키우는' 방향을 구체적으로 짚어준다. 무조건 "더 키우세요"라고만 하지 말 것.
- weak_points의 각 항목에는 goal_action을 붙인다: "grow"(더 키움), "reduce"(목표 대비 과해서 볼륨/체지방을 줄임),
  "definition"(크기보다 선명도·데피니션 개선), "maintain"(유지) 중 하나. 목표가 없으면 기본값 "grow".
- headline_stats.is_estimate는 항상 true로 고정한다.
- 응답은 다음 JSON 스키마를 따른다:
{{
  "content_rating": "safe|explicit",
  "body_part_assessment": {{"<부위>": "<코멘트>"}},
  "weak_points": [{{"part": "<부위>", "severity": "low|medium|high", "goal_action": "grow|reduce|definition|maintain", "comment": "<직설적이고 솔직한 코멘트, 목표가 있으면 목표 대비 방향을 담아서>"}}],
  "overall_comment": "<목표와 무관한 전체적·객관적 몸 평가. 위에서 정한 톤(성인=깐깐한 매운맛/미성년자=건설적)으로 냉정하게 서술>",
  "goal_alignment": {{
    "sync_rate": <int 0-100|null>,
    "direction": "bulk_up|slim_down|recomposition|maintain|null",
    "feedback": "<목표 몸과 얼마나 일치하는지, 무엇이 부족하고 무엇이 과한지, 어떤 훈련 방식(고중량/고반복/유산소/볼륨조절)으로 접근해야 하는지 담은 2~4문장의 전문 조언. 목표 없으면 null>"
  }},
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
상의 탈의/속옷/운동복/수영복은 정상이며, 성기·성행위 등 노골적 성적 콘텐츠면 content_rating을 "explicit"으로 표기한다.
다음 JSON 스키마로만 응답하라: {"content_rating": "safe|explicit", "goal_text": "<체형 설명>"}
"""


class DailyQuotaExceeded(Exception):
    pass


class StillAnalyzing(Exception):
    pass


class ExplicitContentDetected(Exception):
    """노골적 성적 콘텐츠가 감지된 경우. 분석을 중단하고 경고/스트라이크 처리에 사용한다."""

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


def _extract_json(response) -> dict:
    """Gemini 응답에서 JSON을 추출. 안전 필터(성적 콘텐츠 등)로 차단되면 ExplicitContentDetected."""
    candidates = getattr(response, "candidates", None)
    if not candidates:
        # prompt 자체가 안전 필터에 막힌 경우
        raise ExplicitContentDetected()
    finish_reason = getattr(candidates[0], "finish_reason", None)
    if finish_reason is not None and "SAFETY" in str(finish_reason).upper():
        raise ExplicitContentDetected()
    text = getattr(response, "text", None)
    if not text:
        raise ExplicitContentDetected()
    return json.loads(text)


def _call_model(model_name: str, contents: list, system_instruction: str) -> dict:
    response = _client.models.generate_content(
        model=model_name,
        contents=contents,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
        ),
    )
    return _extract_json(response)


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
    has_goal = bool(goal_text) or has_goal_image
    if goal_text:
        lines.append(f"사용자가 원하는 목표 몸 설명: {goal_text}")
    if has_goal_image:
        lines.append("두 번째로 첨부된 이미지는 사용자가 원하는 목표(워너비) 몸 사진이다.")
    if has_goal:
        lines.append(
            "현재 몸과 목표 몸을 비교해 일치율(sync_rate)과 goal_alignment(방향/부족·과한 부위/훈련 방식 조언)를 반드시 채우고, "
            "weak_points 각 항목에 goal_action을 지정하라. 무조건 키우라고만 하지 말고, 목표 대비 과한 부위는 줄이는 방향도 제시하라."
        )
    lines.append("위 정보를 참고해 신체를 분석하고 지정된 JSON 스키마로만 응답하라.")
    return "\n".join(lines)


def analyze_body_image(
    db: Session,
    image_bytes: bytes,
    pose_summary: dict,
    goal_text: str | None,
    goal_image_bytes: bytes | None = None,
    category: str | None = None,
    is_minor: bool = False,
) -> dict:
    prompt = _build_prompt(pose_summary, goal_text, goal_image_bytes is not None)
    contents: list = [genai.types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")]
    if goal_image_bytes:
        contents.append(genai.types.Part.from_bytes(data=goal_image_bytes, mime_type="image/jpeg"))
    contents.append(prompt)

    result = generate_with_fallback(db, contents, _build_system_instruction(category, is_minor))
    if str(result.get("content_rating", "safe")).lower() == "explicit":
        raise ExplicitContentDetected()
    return result


def generate_history_summary(db: Session, history_context: str) -> str:
    result = generate_with_fallback(db, [history_context], HISTORY_SUMMARY_SYSTEM_INSTRUCTION)
    return result.get("summary", "")


def describe_goal_image(db: Session, image_bytes: bytes) -> str:
    contents = [genai.types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")]
    result = generate_with_fallback(db, contents, GOAL_IMAGE_DESCRIPTION_SYSTEM_INSTRUCTION)
    if str(result.get("content_rating", "safe")).lower() == "explicit":
        raise ExplicitContentDetected()
    return result.get("goal_text", "")

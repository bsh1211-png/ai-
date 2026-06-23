import httpx

from app.config import settings

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


def search_exercise_video(exercise_name_en: str) -> str | None:
    """운동명으로 YouTube 영상을 검색해 videoId를 반환.

    YOUTUBE_API_KEY가 없으면 None을 반환한다 (영상 없이도 서비스는 동작).
    채널 화이트리스트는 운영 단계에서 검증된 channelId 목록을 확보한 뒤
    params에 channelId 필터를 추가해 적용한다 (현재는 검색어 기반).
    """
    if not settings.youtube_api_key:
        return None

    params = {
        "part": "snippet",
        "q": f"{exercise_name_en} exercise form",
        "type": "video",
        "maxResults": 1,
        "key": settings.youtube_api_key,
    }
    try:
        response = httpx.get(YOUTUBE_SEARCH_URL, params=params, timeout=5.0)
        response.raise_for_status()
    except httpx.HTTPError:
        return None

    items = response.json().get("items", [])
    if not items:
        return None
    return items[0]["id"]["videoId"]

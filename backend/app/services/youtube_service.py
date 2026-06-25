import httpx

from app.config import settings

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


def search_exercise_videos(exercise_name_en: str, max_results: int = 2) -> list[str]:
    """운동명으로 YouTube 영상을 검색해 videoId 목록(최대 max_results개)을 반환.

    YOUTUBE_API_KEY가 없으면 빈 목록을 반환한다 (영상 없이도 서비스는 동작).
    채널 화이트리스트는 운영 단계에서 검증된 channelId 목록을 확보한 뒤
    params에 channelId 필터를 추가해 적용한다 (현재는 검색어 기반).
    """
    if not settings.youtube_api_key:
        return []

    params = {
        "part": "snippet",
        "q": f"{exercise_name_en} exercise form",
        "type": "video",
        "maxResults": max_results,
        "key": settings.youtube_api_key,
    }
    try:
        response = httpx.get(YOUTUBE_SEARCH_URL, params=params, timeout=5.0)
        response.raise_for_status()
    except httpx.HTTPError:
        return []

    items = response.json().get("items", [])
    return [item["id"]["videoId"] for item in items]

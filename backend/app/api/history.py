import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.history_summary import HistorySummary
from app.models.progress import ProgressLog
from app.models.scan import AnalysisReport, BodyScanSession
from app.models.user import User
from app.schemas.history import HistorySummaryResponse
from app.services import vision_service

router = APIRouter(prefix="/history", tags=["history"])

MIN_REPORTS_FOR_SUMMARY = 2


def _build_history_context(db: Session, user_id) -> tuple[str, int]:
    reports = (
        db.query(AnalysisReport)
        .join(BodyScanSession, AnalysisReport.session_id == BodyScanSession.id)
        .filter(BodyScanSession.user_id == user_id)
        .order_by(AnalysisReport.created_at.asc())
        .limit(10)
        .all()
    )
    logs = (
        db.query(ProgressLog)
        .filter(ProgressLog.user_id == user_id)
        .order_by(ProgressLog.logged_at.asc())
        .limit(20)
        .all()
    )

    timeline = [
        {
            "date": r.created_at.date().isoformat(),
            "summary": r.summary,
            "weak_points": [wp.get("part") for wp in (r.weak_points or [])],
            "headline_stats": r.headline_stats,
        }
        for r in reports
    ]
    weight_trend = [
        {"date": log.logged_at.date().isoformat(), "weight_kg": log.weight_kg} for log in logs if log.weight_kg
    ]

    context = (
        f"분석 기록 타임라인: {json.dumps(timeline, ensure_ascii=False)}\n"
        f"체중 변화 기록: {json.dumps(weight_trend, ensure_ascii=False)}"
    )
    return context, len(reports)


@router.get("/dashboard-summary", response_model=HistorySummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HistorySummaryResponse:
    context, report_count = _build_history_context(db, current_user.id)

    if report_count < MIN_REPORTS_FOR_SUMMARY:
        return HistorySummaryResponse(
            summary="분석 기록이 더 쌓이면 변화 추이를 종합해서 짚어드릴게요. 일단 분석을 한 번 더 해보세요.",
            generated_at=datetime.now(timezone.utc),
            has_enough_data=False,
        )

    latest_report_at = (
        db.query(AnalysisReport)
        .join(BodyScanSession, AnalysisReport.session_id == BodyScanSession.id)
        .filter(BodyScanSession.user_id == current_user.id)
        .order_by(AnalysisReport.created_at.desc())
        .first()
        .created_at
    )

    cached = db.query(HistorySummary).filter(HistorySummary.user_id == current_user.id).first()
    if cached and cached.generated_at >= latest_report_at:
        return HistorySummaryResponse(
            summary=cached.summary, generated_at=cached.generated_at, has_enough_data=True
        )

    try:
        summary_text = vision_service.generate_history_summary(db, context)
    except (vision_service.DailyQuotaExceeded, vision_service.StillAnalyzing):
        # 실패한 폴백 메시지는 캐싱하지 않는다 -> 다음 호출에서 다시 Gemini를 시도하게 둔다.
        fallback = "지금은 분석 요청이 많아 종합 총평을 생성할 수 없어요. 잠시 후 다시 확인해주세요."
        return HistorySummaryResponse(
            summary=fallback,
            generated_at=cached.generated_at if cached else datetime.now(timezone.utc),
            has_enough_data=True,
        )

    now = datetime.now(timezone.utc)
    if cached:
        cached.summary = summary_text
        cached.generated_at = now
    else:
        db.add(HistorySummary(user_id=current_user.id, summary=summary_text, generated_at=now))
    db.commit()

    return HistorySummaryResponse(summary=summary_text, generated_at=now, has_enough_data=True)

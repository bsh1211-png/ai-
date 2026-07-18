import uuid

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, get_current_user
from app.db import get_db
from app.models.scan import BodyGoal, GoalType
from app.models.user import User
from app.schemas.goal import GoalCreateRequest, GoalResponse
from app.services import moderation, vision_service
from app.services.storage_service import storage_service

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("", response_model=GoalResponse)
def set_goal(
    payload: GoalCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BodyGoal:
    # 활성 목표가 있으면 그 자리에서 텍스트만 갱신(워너비 사진 연결을 유지),
    # 없으면 새로 만든다. 매번 새 row를 만들면 이미 업로드된 사진과의 연결이 끊어진다.
    goal = (
        db.query(BodyGoal)
        .filter(BodyGoal.user_id == current_user.id, BodyGoal.is_active.is_(True))
        .order_by(BodyGoal.created_at.desc())
        .first()
    )
    if goal is None:
        goal = BodyGoal(user_id=current_user.id, goal_type=GoalType.text, is_active=True)
        db.add(goal)

    goal.goal_text = payload.goal_text
    if goal.reference_image_path:
        goal.goal_type = GoalType.combined
    db.commit()
    db.refresh(goal)
    return goal


@router.post("/{goal_id}/reference-image", response_model=GoalResponse)
async def upload_reference_image(
    goal_id: uuid.UUID,
    consent: bool = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
    x_lang: str = Header("ko", alias="X-Lang"),
) -> BodyGoal:
    goal = db.get(BodyGoal, goal_id)
    if goal is None or goal.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="목표를 찾을 수 없습니다")
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="본인이 권리를 가졌거나 비공개 개인용 비교 목적으로만 사용함에 대한 동의가 필요합니다",
        )

    content = await file.read()

    # 사진에 맞춰 목표 텍스트를 자동으로 조정. 노골적 성적 이미지면 저장하지 않고 거부 + 스트라이크.
    described = None
    try:
        described = vision_service.describe_goal_image(db, content, "en" if x_lang == "en" else "ko")
    except vision_service.ExplicitContentDetected:
        strikes, banned = moderation.register_nsfw_strike(db, current_user)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN if banned else status.HTTP_400_BAD_REQUEST,
            detail=moderation.nsfw_warning_message(strikes, banned),
        )
    except (vision_service.DailyQuotaExceeded, vision_service.StillAnalyzing):
        pass

    suffix = "." + (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg")
    storage_path = storage_service.save_bytes(f"goal_images/{current_user.id}", content, suffix=suffix)

    goal.reference_image_path = storage_path
    goal.reference_image_consent = True
    goal.goal_type = GoalType.combined if goal.goal_text else GoalType.reference_image
    if described:
        goal.goal_text = described
        goal.goal_type = GoalType.combined

    db.commit()
    db.refresh(goal)
    return goal


@router.get("/{goal_id}/reference-image/file")
def get_reference_image_file(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    goal = db.get(BodyGoal, goal_id)
    if goal is None or goal.user_id != current_user.id or not goal.reference_image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="이미지를 찾을 수 없습니다")
    content = storage_service.read_bytes(goal.reference_image_path)
    return Response(content=content, media_type="image/jpeg")


@router.get("/active", response_model=GoalResponse | None)
def get_active_goal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BodyGoal | None:
    return (
        db.query(BodyGoal)
        .filter(BodyGoal.user_id == current_user.id, BodyGoal.is_active.is_(True))
        .order_by(BodyGoal.created_at.desc())
        .first()
    )

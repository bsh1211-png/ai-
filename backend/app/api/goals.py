import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.scan import BodyGoal, GoalType
from app.models.user import User
from app.schemas.goal import GoalCreateRequest, GoalResponse
from app.services import vision_service
from app.services.storage_service import storage_service

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("", response_model=GoalResponse)
def set_goal(
    payload: GoalCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BodyGoal:
    db.query(BodyGoal).filter(BodyGoal.user_id == current_user.id, BodyGoal.is_active.is_(True)).update(
        {"is_active": False}
    )
    goal = BodyGoal(
        user_id=current_user.id,
        goal_type=GoalType.text,
        goal_text=payload.goal_text,
        is_active=True,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.post("/{goal_id}/reference-image", response_model=GoalResponse)
async def upload_reference_image(
    goal_id: uuid.UUID,
    consent: bool = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    suffix = "." + (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg")
    storage_path = storage_service.save_bytes(f"goal_images/{current_user.id}", content, suffix=suffix)

    goal.reference_image_path = storage_path
    goal.reference_image_consent = True
    goal.goal_type = GoalType.combined if goal.goal_text else GoalType.reference_image

    # 사진에 맞춰 목표 텍스트를 자동으로 조정. 실패해도 사진 업로드 자체는 성공시킨다.
    try:
        described = vision_service.describe_goal_image(db, content)
        if described:
            goal.goal_text = described
            goal.goal_type = GoalType.combined
    except (vision_service.DailyQuotaExceeded, vision_service.StillAnalyzing):
        pass

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

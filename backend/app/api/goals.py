from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.scan import BodyGoal, GoalType
from app.models.user import User
from app.schemas.goal import GoalCreateRequest, GoalResponse

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

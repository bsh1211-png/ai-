import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.exercise import Exercise
from app.schemas.exercise import ExerciseResponse

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
def list_exercises(
    muscle: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> list[Exercise]:
    query = db.query(Exercise)
    if muscle:
        # JSON 컬럼이라 DB 레벨 필터링 대신 애플리케이션 레벨에서 필터링
        all_rows = query.all()
        muscle_lower = muscle.lower()
        filtered = [
            e
            for e in all_rows
            if muscle_lower in [m.lower() for m in (e.primary_muscles or []) + (e.secondary_muscles or [])]
        ]
        return filtered[:limit]
    return query.limit(limit).all()


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(exercise_id: uuid.UUID, db: Session = Depends(get_db)) -> Exercise:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="운동을 찾을 수 없습니다")
    return exercise

"""sync enum values (scancategory, goaltype) with models

Postgres에서 이전 마이그레이션이 batch 모드로 enum 라벨을 바꾸려 했으나
이미 존재하던 타입의 라벨은 갱신되지 않아 모델과 어긋남.
실제 사용되는 값(full_body/upper, combined)을 누락 없이 추가한다.

Revision ID: a1b2c3d4e5f6
Revises: 265330ffdca4
Create Date: 2026-06-30

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '265330ffdca4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # ScanCategory: full_body / upper / lower 가 모델 값. 누락분 추가.
        op.execute("ALTER TYPE scancategory ADD VALUE IF NOT EXISTS 'full_body'")
        op.execute("ALTER TYPE scancategory ADD VALUE IF NOT EXISTS 'upper'")
        # GoalType: text / reference_image / combined. combined 누락분 추가.
        op.execute("ALTER TYPE goaltype ADD VALUE IF NOT EXISTS 'combined'")
    # sqlite는 enum을 별도 타입으로 강제하지 않으므로 별도 작업 불필요


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres는 ENUM 라벨 제거를 직접 지원하지 않음. 추가된 값은 무해하므로 no-op.
    pass

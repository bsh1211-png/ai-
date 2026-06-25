"""oauth social login support

Revision ID: 265330ffdca4
Revises: 1649e64384b7
Create Date: 2026-06-25 16:37:12.273009

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '265330ffdca4'
down_revision: Union[str, Sequence[str], None] = '1649e64384b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # sqlite는 ALTER COLUMN/ADD CONSTRAINT를 직접 지원하지 않아 batch 모드(테이블 재생성)로 처리
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('oauth_provider', sa.Enum('google', 'kakao', 'naver', name='oauthprovider'), nullable=True))
        batch_op.add_column(sa.Column('oauth_id', sa.String(length=255), nullable=True))
        batch_op.alter_column('password_hash', existing_type=sa.VARCHAR(length=255), nullable=True)
        batch_op.create_unique_constraint('uq_users_oauth', ['oauth_provider', 'oauth_id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('uq_users_oauth', type_='unique')
        batch_op.alter_column('password_hash', existing_type=sa.VARCHAR(length=255), nullable=False)
        batch_op.drop_column('oauth_id')
        batch_op.drop_column('oauth_provider')

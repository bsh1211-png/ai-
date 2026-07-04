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
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Postgres는 ALTER ADD COLUMN/ADD CONSTRAINT를 직접 지원. enum 타입은 먼저 명시적으로 생성해야 함.
        oauthprovider = sa.Enum('google', 'kakao', 'naver', name='oauthprovider')
        oauthprovider.create(bind, checkfirst=True)
        op.add_column('users', sa.Column('oauth_provider', sa.Enum('google', 'kakao', 'naver', name='oauthprovider', create_type=False), nullable=True))
        op.add_column('users', sa.Column('oauth_id', sa.String(length=255), nullable=True))
        op.alter_column('users', 'password_hash', existing_type=sa.VARCHAR(length=255), nullable=True)
        op.create_unique_constraint('uq_users_oauth', 'users', ['oauth_provider', 'oauth_id'])
    else:
        # sqlite는 ALTER COLUMN/ADD CONSTRAINT를 직접 지원하지 않아 batch 모드(테이블 재생성)로 처리
        with op.batch_alter_table('users') as batch_op:
            batch_op.add_column(sa.Column('oauth_provider', sa.Enum('google', 'kakao', 'naver', name='oauthprovider'), nullable=True))
            batch_op.add_column(sa.Column('oauth_id', sa.String(length=255), nullable=True))
            batch_op.alter_column('password_hash', existing_type=sa.VARCHAR(length=255), nullable=True)
            batch_op.create_unique_constraint('uq_users_oauth', ['oauth_provider', 'oauth_id'])


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_constraint('uq_users_oauth', 'users', type_='unique')
        op.alter_column('users', 'password_hash', existing_type=sa.VARCHAR(length=255), nullable=False)
        op.drop_column('users', 'oauth_id')
        op.drop_column('users', 'oauth_provider')
        sa.Enum(name='oauthprovider').drop(bind, checkfirst=True)
    else:
        with op.batch_alter_table('users') as batch_op:
            batch_op.drop_constraint('uq_users_oauth', type_='unique')
            batch_op.alter_column('password_hash', existing_type=sa.VARCHAR(length=255), nullable=False)
            batch_op.drop_column('oauth_id')
            batch_op.drop_column('oauth_provider')

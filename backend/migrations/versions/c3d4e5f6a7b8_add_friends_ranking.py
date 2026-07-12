"""add friends/ranking: user display_name & invite_code, friendships table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('display_name', sa.String(length=30), nullable=True))
    op.add_column('users', sa.Column('invite_code', sa.String(length=16), nullable=True))
    op.create_index('ix_users_invite_code', 'users', ['invite_code'], unique=True)

    op.create_table(
        'friendships',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('friend_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['friend_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'friend_id', name='uq_friendship_pair'),
    )
    op.create_index('ix_friendships_user_id', 'friendships', ['user_id'], unique=False)
    op.create_index('ix_friendships_friend_id', 'friendships', ['friend_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_friendships_friend_id', table_name='friendships')
    op.drop_index('ix_friendships_user_id', table_name='friendships')
    op.drop_table('friendships')
    op.drop_index('ix_users_invite_code', table_name='users')
    op.drop_column('users', 'invite_code')
    op.drop_column('users', 'display_name')

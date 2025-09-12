"""add parking fields to properties table
Revision ID: ef329ce616a4
Revises: 9d17558ad3df
Create Date: 2025-09-12 14:54:19.207713-03:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ef329ce616a4'
down_revision = '9d17558ad3df'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Adicionar colunas com valores padrão
    op.add_column('properties', sa.Column('parking_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('properties', sa.Column('parking_spots_total', sa.Integer(), nullable=True))
    op.add_column('properties', sa.Column('parking_policy', sa.String(length=20), nullable=True, server_default='integral'))
    op.add_column('reservations', sa.Column('parking_requested', sa.Boolean(), nullable=False, server_default='false'))

def downgrade() -> None:
    op.drop_column('reservations', 'parking_requested')
    op.drop_column('properties', 'parking_policy')
    op.drop_column('properties', 'parking_spots_total')
    op.drop_column('properties', 'parking_enabled')

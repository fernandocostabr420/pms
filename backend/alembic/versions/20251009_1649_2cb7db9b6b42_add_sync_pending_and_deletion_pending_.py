"""add sync_pending and deletion_pending to wubook_room_mappings

Revision ID: 2cb7db9b6b42
Revises: 695c4db255b5
Create Date: 2025-10-09 16:49:30.771104-03:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2cb7db9b6b42"
down_revision = "695c4db255b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add sync_pending and deletion_pending fields to wubook_room_mappings"""
    
    # Add sync_pending column
    op.add_column("wubook_room_mappings", 
        sa.Column("sync_pending", sa.Boolean(), nullable=False, server_default="false")
    )
    
    # Add deletion_pending column  
    op.add_column("wubook_room_mappings",
        sa.Column("deletion_pending", sa.Boolean(), nullable=False, server_default="false")
    )
    
    # Create index for sync_pending (frequently used in queries)
    op.create_index(
        op.f("ix_wubook_room_mappings_sync_pending"), 
        "wubook_room_mappings", 
        ["sync_pending"], 
        unique=False
    )


def downgrade() -> None:
    """Remove sync_pending and deletion_pending fields from wubook_room_mappings"""
    
    # Remove index
    op.drop_index(op.f("ix_wubook_room_mappings_sync_pending"), table_name="wubook_room_mappings")
    
    # Remove columns
    op.drop_column("wubook_room_mappings", "deletion_pending")
    op.drop_column("wubook_room_mappings", "sync_pending")

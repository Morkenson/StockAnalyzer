"""Add RentCast listing cache.

Revision ID: 20260609_0009
Revises: 20260609_0008
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa

revision = "20260609_0009"
down_revision = "20260609_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    datetime_type = sa.DateTime(timezone=dialect == "postgresql")
    now_default = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "rentcast_listing_cache",
        sa.Column("provider", sa.String(length=40), primary_key=True),
        sa.Column("cache_key", sa.String(length=255), primary_key=True),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("fetched_at", datetime_type, server_default=now_default),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index(
        "idx_rentcast_listing_cache_fetched_at", "rentcast_listing_cache", ["fetched_at"], if_not_exists=True
    )


def downgrade() -> None:
    op.drop_index("idx_rentcast_listing_cache_fetched_at", table_name="rentcast_listing_cache", if_exists=True)
    op.drop_table("rentcast_listing_cache", if_exists=True)

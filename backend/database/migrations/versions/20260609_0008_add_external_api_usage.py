"""Add external API usage counters.

Revision ID: 20260609_0008
Revises: 20260609_0007
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa

revision = "20260609_0008"
down_revision = "20260609_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    datetime_type = sa.DateTime(timezone=dialect == "postgresql")
    now_default = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "external_api_usage",
        sa.Column("provider", sa.String(length=40), primary_key=True),
        sa.Column("period_start", sa.Date(), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_table("external_api_usage", if_exists=True)

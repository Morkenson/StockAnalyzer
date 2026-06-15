"""Add tax profiles table.

Revision ID: 20260614_0010
Revises: 20260609_0009
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa

revision = "20260614_0010"
down_revision = "20260609_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    datetime_type = sa.DateTime(timezone=dialect == "postgresql")
    row_id_type = sa.UUID(as_uuid=False) if dialect == "postgresql" else sa.String(length=36)
    now_default = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "tax_profiles",
        sa.Column("id", row_id_type, primary_key=True),
        sa.Column("user_id", row_id_type, nullable=False),
        sa.Column("tax_year", sa.Integer(), nullable=False, server_default="2025"),
        sa.Column("filing_status", sa.String(length=32), nullable=False, server_default="single"),
        sa.Column("gross_income", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("pre_tax_contributions", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("use_itemized", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("itemized_deduction", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("withholdings_paid", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index("idx_tax_profiles_user_id", "tax_profiles", ["user_id"], unique=True, if_not_exists=True)


def downgrade() -> None:
    op.drop_index("idx_tax_profiles_user_id", table_name="tax_profiles", if_exists=True)
    op.drop_table("tax_profiles", if_exists=True)

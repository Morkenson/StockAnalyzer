"""Add real estate properties table.

Revision ID: 20260609_0007
Revises: 20260605_0006
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa

revision = "20260609_0007"
down_revision = "20260605_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    datetime_type = sa.DateTime(timezone=dialect == "postgresql")
    row_id_type = sa.UUID(as_uuid=False) if dialect == "postgresql" else sa.String(length=36)
    now_default = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "real_estate_properties",
        sa.Column("id", row_id_type, primary_key=True),
        sa.Column("user_id", row_id_type, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("property_type", sa.String(length=80), nullable=True),
        sa.Column("currency", sa.String(length=8), server_default="USD"),
        sa.Column("purchase_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("down_payment_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("closing_costs", sa.Numeric(14, 2), server_default="0"),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("loan_term_years", sa.Integer(), nullable=False),
        sa.Column("monthly_rent", sa.Numeric(14, 2), nullable=False),
        sa.Column("vacancy_rate_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("property_tax_annual", sa.Numeric(14, 2), server_default="0"),
        sa.Column("insurance_annual", sa.Numeric(14, 2), server_default="0"),
        sa.Column("hoa_monthly", sa.Numeric(14, 2), server_default="0"),
        sa.Column("maintenance_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("management_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("other_monthly_costs", sa.Numeric(14, 2), server_default="0"),
        sa.Column("appreciation_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("hold_years", sa.Integer(), server_default="10"),
        sa.Column("monthly_cash_flow", sa.Numeric(14, 2), nullable=False),
        sa.Column("cap_rate", sa.Numeric(8, 4), nullable=False),
        sa.Column("cash_on_cash_return", sa.Numeric(8, 4), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index("idx_real_estate_properties_user_id", "real_estate_properties", ["user_id"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("idx_real_estate_properties_user_id", table_name="real_estate_properties", if_exists=True)
    op.drop_table("real_estate_properties", if_exists=True)

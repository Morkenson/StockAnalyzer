"""Fix account snapshot id UUID type.

Revision ID: 20260605_0006
Revises: 20260605_0005
Create Date: 2026-06-05
"""

from alembic import op

revision = "20260605_0006"
down_revision = "20260605_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'snaptrade_account_balance_snapshots'
                  AND column_name = 'id'
                  AND data_type = 'character varying'
            ) THEN
                ALTER TABLE snaptrade_account_balance_snapshots ALTER COLUMN id DROP DEFAULT;
                ALTER TABLE snaptrade_account_balance_snapshots ALTER COLUMN id TYPE UUID USING id::uuid;
                ALTER TABLE snaptrade_account_balance_snapshots ALTER COLUMN id SET DEFAULT uuid_generate_v4();
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    pass

"""Finish UUID normalization for databases already stamped at 0003.

Revision ID: 20260602_0004
Revises: 20260602_0003
Create Date: 2026-06-02
"""

from alembic import op

revision = "20260602_0004"
down_revision = "20260602_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    _drop_app_data_policies()
    _drop_stale_user_fks()
    _drop_watchlist_item_fk()
    _convert_varchar_ids_to_uuid()
    _recreate_watchlist_item_fk()
    _recreate_app_data_policies()


def downgrade() -> None:
    pass


def _drop_app_data_policies() -> None:
    """Temporarily drop RLS policies that can block ALTER COLUMN TYPE."""
    op.execute(
        """
        CREATE TEMP TABLE IF NOT EXISTS _alembic_dropped_policies (
            schemaname TEXT,
            tablename TEXT,
            policyname TEXT,
            permissive TEXT,
            roles TEXT[],
            cmd TEXT,
            qual TEXT,
            with_check TEXT
        ) ON COMMIT DROP;

        INSERT INTO _alembic_dropped_policies
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename IN ('loans', 'assets', 'watchlists', 'watchlist_items')
          AND NOT EXISTS (
              SELECT 1 FROM _alembic_dropped_policies saved
              WHERE saved.schemaname = pg_policies.schemaname
                AND saved.tablename = pg_policies.tablename
                AND saved.policyname = pg_policies.policyname
          );

        DO $$
        DECLARE
            policy_row RECORD;
        BEGIN
            FOR policy_row IN
                SELECT tablename, policyname FROM _alembic_dropped_policies
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_row.policyname, policy_row.tablename);
            END LOOP;
        END $$;
        """
    )


def _recreate_app_data_policies() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            policy_row RECORD;
            role_list TEXT;
        BEGIN
            IF to_regclass('pg_temp._alembic_dropped_policies') IS NULL THEN
                RETURN;
            END IF;

            FOR policy_row IN
                SELECT * FROM _alembic_dropped_policies
            LOOP
                SELECT string_agg(quote_ident(role_name), ', ')
                INTO role_list
                FROM unnest(policy_row.roles) AS role_name;

                EXECUTE format(
                    'CREATE POLICY %I ON %I AS %s FOR %s TO %s%s%s',
                    policy_row.policyname,
                    policy_row.tablename,
                    policy_row.permissive,
                    policy_row.cmd,
                    role_list,
                    CASE WHEN policy_row.qual IS NOT NULL THEN ' USING (' || policy_row.qual || ')' ELSE '' END,
                    CASE WHEN policy_row.with_check IS NOT NULL THEN ' WITH CHECK (' || policy_row.with_check || ')' ELSE '' END
                );
            END LOOP;
        END $$;
        """
    )


def _drop_stale_user_fks() -> None:
    for table, constraint in [
        ("loans", "loans_user_id_fkey"),
        ("watchlists", "watchlists_user_id_fkey"),
        ("assets", "assets_user_id_fkey"),
    ]:
        _drop_constraint_if_exists(table, constraint)


def _drop_watchlist_item_fk() -> None:
    _drop_constraint_if_exists("watchlist_items", "watchlist_items_watchlist_id_fkey")


def _drop_constraint_if_exists(table: str, constraint: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_schema = current_schema()
                  AND table_name = '{table}'
                  AND constraint_name = '{constraint}'
            ) THEN
                ALTER TABLE {table} DROP CONSTRAINT {constraint};
            END IF;
        END $$;
        """
    )


def _convert_col(table: str, column: str) -> None:
    default_sql = f"ALTER TABLE {table} ALTER COLUMN id SET DEFAULT uuid_generate_v4();" if column == "id" else ""
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = '{table}'
                  AND column_name = '{column}'
                  AND data_type = 'character varying'
            ) THEN
                ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT;
                ALTER TABLE {table} ALTER COLUMN {column} TYPE UUID USING {column}::uuid;
                {default_sql}
            END IF;
        END $$;
        """
    )


def _convert_varchar_ids_to_uuid() -> None:
    for table, column in [
        ("loans", "id"),
        ("loans", "user_id"),
        ("assets", "id"),
        ("assets", "user_id"),
        ("watchlists", "id"),
        ("watchlists", "user_id"),
        ("watchlist_items", "id"),
        ("watchlist_items", "watchlist_id"),
    ]:
        _convert_col(table, column)


def _recreate_watchlist_item_fk() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_schema = current_schema()
                  AND table_name = 'watchlist_items'
                  AND constraint_name = 'watchlist_items_watchlist_id_fkey'
            ) THEN
                ALTER TABLE watchlist_items
                    ADD CONSTRAINT watchlist_items_watchlist_id_fkey
                    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE;
            END IF;
        END $$;
        """
    )

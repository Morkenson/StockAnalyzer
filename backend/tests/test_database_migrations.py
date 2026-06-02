from sqlalchemy import inspect

from database import engine, init_db


def test_init_db_adds_snaptrade_preference_schema():
    init_db()
    inspector = inspect(engine)

    assert "alembic_version" in inspector.get_table_names()
    assert "snaptrade_recurring_investment_preferences" in inspector.get_table_names()
    account_columns = {column["name"] for column in inspector.get_columns("snaptrade_account_preferences")}
    assert "margin_balance" in account_columns
    assert "margin_interest_rate" in account_columns
    dividend_columns = {column["name"] for column in inspector.get_columns("snaptrade_dividend_preferences")}
    assert "hidden" in dividend_columns

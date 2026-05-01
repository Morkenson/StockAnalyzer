import pytest
from services.stock_data_service import _parse_decimal, _parse_int
from models.common import _to_camel


class TestParseDecimal:
    def test_none_returns_default(self):
        assert _parse_decimal(None) == 0.0

    def test_none_with_custom_default(self):
        assert _parse_decimal(None, 5.0) == 5.0

    def test_float_string(self):
        assert _parse_decimal("3.14") == pytest.approx(3.14)

    def test_int_value(self):
        assert _parse_decimal(5) == 5.0

    def test_invalid_string_returns_default(self):
        assert _parse_decimal("N/A") == 0.0

    def test_empty_string_returns_default(self):
        assert _parse_decimal("") == 0.0


class TestParseInt:
    def test_none_returns_default(self):
        assert _parse_int(None) == 0

    def test_string_integer(self):
        assert _parse_int("42") == 42

    def test_float_string_truncates(self):
        assert _parse_int("3.7") == 3

    def test_int_value(self):
        assert _parse_int(10) == 10

    def test_invalid_string_returns_default(self):
        assert _parse_int("N/A") == 0


class TestToCamel:
    def test_single_word(self):
        assert _to_camel("price") == "price"

    def test_two_words(self):
        assert _to_camel("change_percent") == "changePercent"

    def test_three_words(self):
        assert _to_camel("high_52_week") == "high52Week"

"""Tests for production env validation and optional env var logging in main.py."""
import logging

import pytest

from main import (
    OPTIONAL_ENV_VARS,
    REQUIRED_PROD_ENV_VARS,
    _log_optional_env_vars,
    _validate_production_env,
)

# A complete, valid production environment. Every required var is set explicitly
# so the happy-path test never depends on the developer's machine env.
VALID_PROD_ENV = {
    "APP_ENV": "production",
    "JWT_SECRET": "prod-jwt-secret-value",
    "PLAID_TOKEN_ENCRYPTION_KEY": "prod-plaid-token-encryption-key",
    "SNAPTRADE_SECRET_ENCRYPTION_KEY": "prod-snaptrade-secret-encryption-key",
    "FRONTEND_ORIGINS": "https://example.com",
    "SNAPTRADE_CALLBACK_REDIRECT": "https://example.com/callback",
    "DATABASE_URL": "postgresql://example.invalid/proddb",
    "RESEND_API_KEY": "re_prod_key",
    "COOKIE_SECURE": "true",
}


def _set_valid_prod_env(monkeypatch):
    for name, value in VALID_PROD_ENV.items():
        monkeypatch.setenv(name, value)
    # conftest sets DEBUG_EXPOSE_RESET_TOKEN=1; a valid prod env must not have it
    monkeypatch.delenv("DEBUG_EXPOSE_RESET_TOKEN", raising=False)


class TestValidateProductionEnv:
    def test_missing_app_env_raises(self, monkeypatch):
        monkeypatch.delenv("APP_ENV", raising=False)
        with pytest.raises(RuntimeError, match="APP_ENV must be set explicitly"):
            _validate_production_env()

    def test_empty_app_env_raises(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "")
        with pytest.raises(RuntimeError, match="APP_ENV must be set explicitly"):
            _validate_production_env()

    def test_unrecognized_app_env_raises(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "staging")
        with pytest.raises(RuntimeError, match="not a recognized value"):
            _validate_production_env()

    def test_development_returns_without_prod_checks(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "development")
        # Even with required prod vars missing, development must not raise.
        for name in REQUIRED_PROD_ENV_VARS:
            monkeypatch.delenv(name, raising=False)
        _validate_production_env()

    def test_test_env_returns_without_prod_checks(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "test")
        for name in REQUIRED_PROD_ENV_VARS:
            monkeypatch.delenv(name, raising=False)
        _validate_production_env()

    def test_app_env_is_case_insensitive(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "Development")
        _validate_production_env()

    def test_production_with_all_required_vars_passes(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        _validate_production_env()

    @pytest.mark.parametrize("missing_var", REQUIRED_PROD_ENV_VARS)
    def test_production_missing_required_var_raises_with_name(self, monkeypatch, missing_var):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.delenv(missing_var, raising=False)
        with pytest.raises(RuntimeError) as exc_info:
            _validate_production_env()
        assert "missing required env vars" in str(exc_info.value)
        assert missing_var in str(exc_info.value)

    def test_production_missing_resend_api_key_raises(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.delenv("RESEND_API_KEY", raising=False)
        with pytest.raises(RuntimeError, match="RESEND_API_KEY"):
            _validate_production_env()

    @pytest.mark.parametrize("value", ["false", "False", "0", ""])
    def test_production_cookie_secure_not_true_raises(self, monkeypatch, value):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv("COOKIE_SECURE", value)
        with pytest.raises(RuntimeError, match="misconfigured env vars"):
            _validate_production_env()

    def test_production_cookie_secure_uppercase_true_passes(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv("COOKIE_SECURE", "TRUE")
        _validate_production_env()

    def test_production_debug_expose_reset_token_raises(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv("DEBUG_EXPOSE_RESET_TOKEN", "1")
        with pytest.raises(RuntimeError, match="forbidden env vars set in production") as exc_info:
            _validate_production_env()
        assert "DEBUG_EXPOSE_RESET_TOKEN" in str(exc_info.value)

    @pytest.mark.parametrize(
        "shared_var", ["PLAID_TOKEN_ENCRYPTION_KEY", "SNAPTRADE_SECRET_ENCRYPTION_KEY"]
    )
    def test_production_encryption_key_equal_to_jwt_secret_raises(self, monkeypatch, shared_var):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv(shared_var, VALID_PROD_ENV["JWT_SECRET"])
        with pytest.raises(RuntimeError, match=f"{shared_var} must not be equal to JWT_SECRET"):
            _validate_production_env()

    def test_production_multiple_problems_are_all_reported(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.delenv("RESEND_API_KEY", raising=False)
        monkeypatch.setenv("COOKIE_SECURE", "false")
        monkeypatch.setenv("DEBUG_EXPOSE_RESET_TOKEN", "1")
        with pytest.raises(RuntimeError) as exc_info:
            _validate_production_env()
        message = str(exc_info.value)
        assert "missing required env vars" in message
        assert "misconfigured env vars" in message
        assert "forbidden env vars set in production" in message


class TestLogOptionalEnvVars:
    def test_warns_when_optional_vars_unset(self, monkeypatch, caplog):
        monkeypatch.delenv("TWELVE_DATA_API_KEY", raising=False)
        with caplog.at_level(logging.WARNING, logger="main"):
            _log_optional_env_vars()
        assert any(
            "env vars not set" in record.getMessage() and "TWELVE_DATA_API_KEY" in record.getMessage()
            for record in caplog.records
        )

    def test_logs_info_when_all_optional_vars_set(self, monkeypatch, caplog):
        for name in OPTIONAL_ENV_VARS:
            monkeypatch.setenv(name, "set-for-test")
        with caplog.at_level(logging.INFO, logger="main"):
            _log_optional_env_vars()
        assert any("all known env vars are set" in record.getMessage() for record in caplog.records)

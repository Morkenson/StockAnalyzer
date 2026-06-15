"""Tests for email_service console fallbacks: OTP codes and reset links must never reach logs in production."""
import asyncio
import logging
from unittest.mock import patch

from services import email_service

OTP_CODE = "123456"
RESET_LINK = "https://app.example.com/reset-password?token=secret-reset-token"


def _send_otp(monkeypatch, app_env, api_key=None, send_fails=False):
    # Alembic's fileConfig (run during test setup) disables pre-existing loggers.
    email_service.logger.disabled = False
    monkeypatch.setenv("APP_ENV", app_env)
    if api_key:
        monkeypatch.setenv("RESEND_API_KEY", api_key)
    else:
        monkeypatch.delenv("RESEND_API_KEY", raising=False)
    side_effect = RuntimeError("provider down") if send_fails else None
    with patch.object(email_service, "_send_otp_sync", side_effect=side_effect):
        asyncio.run(email_service.send_otp_email("user@example.com", OTP_CODE))


def _send_reset(monkeypatch, app_env, api_key=None, send_fails=False):
    email_service.logger.disabled = False
    monkeypatch.setenv("APP_ENV", app_env)
    if api_key:
        monkeypatch.setenv("RESEND_API_KEY", api_key)
    else:
        monkeypatch.delenv("RESEND_API_KEY", raising=False)
    side_effect = RuntimeError("provider down") if send_fails else None
    with patch.object(email_service, "_send_password_reset_sync", side_effect=side_effect):
        asyncio.run(email_service.send_password_reset_email("user@example.com", RESET_LINK))


def test_otp_logged_to_console_in_dev_without_api_key(monkeypatch, caplog):
    with caplog.at_level(logging.WARNING, logger="services.email_service"):
        _send_otp(monkeypatch, "development")
    assert OTP_CODE in caplog.text


def test_otp_fallback_logged_in_dev_on_send_failure(monkeypatch, caplog):
    with caplog.at_level(logging.WARNING, logger="services.email_service"):
        _send_otp(monkeypatch, "development", api_key="rk_test", send_fails=True)
    assert OTP_CODE in caplog.text


def test_otp_never_logged_in_production_without_api_key(monkeypatch, caplog):
    with caplog.at_level(logging.DEBUG, logger="services.email_service"):
        _send_otp(monkeypatch, "production")
    assert OTP_CODE not in caplog.text
    assert "not delivered" in caplog.text


def test_otp_never_logged_in_production_on_send_failure(monkeypatch, caplog):
    with caplog.at_level(logging.DEBUG, logger="services.email_service"):
        _send_otp(monkeypatch, "production", api_key="rk_test", send_fails=True)
    assert OTP_CODE not in caplog.text
    assert "Failed to send OTP email" in caplog.text


def test_reset_link_logged_to_console_in_dev_without_api_key(monkeypatch, caplog):
    with caplog.at_level(logging.WARNING, logger="services.email_service"):
        _send_reset(monkeypatch, "development")
    assert RESET_LINK in caplog.text


def test_reset_link_never_logged_in_production_without_api_key(monkeypatch, caplog):
    with caplog.at_level(logging.DEBUG, logger="services.email_service"):
        _send_reset(monkeypatch, "production")
    assert RESET_LINK not in caplog.text
    assert "not delivered" in caplog.text


def test_reset_link_never_logged_in_production_on_send_failure(monkeypatch, caplog):
    with caplog.at_level(logging.DEBUG, logger="services.email_service"):
        _send_reset(monkeypatch, "production", api_key="rk_test", send_fails=True)
    assert RESET_LINK not in caplog.text
    assert "Failed to send password reset email" in caplog.text

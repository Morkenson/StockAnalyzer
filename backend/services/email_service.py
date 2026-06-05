"""Email sending via Resend. Falls back to console logging in dev when RESEND_API_KEY is unset."""
import asyncio
import logging
import os

logger = logging.getLogger(__name__)

_FROM_EMAIL = os.getenv("EMAIL_FROM", "onboarding@resend.dev")


def _send_otp_sync(api_key: str, to_email: str, code: str) -> None:
    import resend

    resend.api_key = api_key
    resend.Emails.send(
        {
            "from": _FROM_EMAIL,
            "to": [to_email],
            "subject": "Your sign-in code",
            "html": f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 0;background:#0b0e13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:420px;margin:0 auto;background:#15191f;border:1px solid #303843;border-radius:10px;padding:40px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">Mork Wealth</p>
    <h2 style="margin:0 0 12px;font-size:22px;color:#f7f4ee;">Sign-in verification</h2>
    <p style="margin:0 0 28px;font-size:14px;color:#8994a3;">Enter this code to complete your sign-in. It expires in 10 minutes.</p>
    <div style="background:#20262f;border-radius:8px;padding:20px 32px;text-align:center;letter-spacing:14px;font-size:34px;font-weight:700;color:#f7f4ee;margin-bottom:28px;">{code}</div>
    <p style="margin:0;font-size:12px;color:#4b5565;">If you didn't request this, you can safely ignore this email.</p>
  </div>
</body>
</html>
""",
        }
    )


async def send_otp_email(to_email: str, code: str) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("[DEV] OTP for %s: %s", to_email, code)
        return
    try:
        await asyncio.to_thread(_send_otp_sync, api_key, to_email, code)
        logger.info("OTP email sent to %s", to_email)
    except Exception:
        logger.exception("Failed to send OTP email to %s — falling back to console", to_email)
        logger.warning("[FALLBACK] OTP for %s: %s", to_email, code)


def _send_password_reset_sync(api_key: str, to_email: str, reset_link: str) -> None:
    import resend

    resend.api_key = api_key
    resend.Emails.send(
        {
            "from": _FROM_EMAIL,
            "to": [to_email],
            "subject": "Reset your password",
            "html": f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 0;background:#0b0e13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:420px;margin:0 auto;background:#15191f;border:1px solid #303843;border-radius:10px;padding:40px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">Mork Wealth</p>
    <h2 style="margin:0 0 12px;font-size:22px;color:#f7f4ee;">Reset your password</h2>
    <p style="margin:0 0 28px;font-size:14px;color:#8994a3;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 30 minutes.</p>
    <a href="{reset_link}" style="display:block;background:#14b8a6;border-radius:8px;padding:14px 32px;text-align:center;font-size:15px;font-weight:600;color:#0b0e13;text-decoration:none;margin-bottom:28px;">Reset password</a>
    <p style="margin:0 0 8px;font-size:12px;color:#8994a3;">Or paste this link into your browser:</p>
    <p style="margin:0 0 28px;font-size:12px;color:#14b8a6;word-break:break-all;">{reset_link}</p>
    <p style="margin:0;font-size:12px;color:#4b5565;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  </div>
</body>
</html>
""",
        }
    )


async def send_password_reset_email(to_email: str, reset_link: str) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("[DEV] Password reset link for %s: %s", to_email, reset_link)
        return
    try:
        await asyncio.to_thread(_send_password_reset_sync, api_key, to_email, reset_link)
        logger.info("Password reset email sent to %s", to_email)
    except Exception:
        logger.exception("Failed to send password reset email to %s — falling back to console", to_email)
        logger.warning("[FALLBACK] Password reset link for %s: %s", to_email, reset_link)

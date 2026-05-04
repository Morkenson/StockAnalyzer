"""Email sending via Resend. Falls back to console logging in dev when RESEND_API_KEY is unset."""
import asyncio
import logging
import os

logger = logging.getLogger(__name__)

_RESEND_API_KEY = os.getenv("RESEND_API_KEY")
_FROM_EMAIL = os.getenv("EMAIL_FROM", "onboarding@resend.dev")


def _send_otp_sync(to_email: str, code: str) -> None:
    import resend

    resend.api_key = _RESEND_API_KEY
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
    if not _RESEND_API_KEY:
        logger.warning("[DEV] OTP for %s: %s", to_email, code)
        return
    await asyncio.to_thread(_send_otp_sync, to_email, code)

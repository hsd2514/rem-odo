"""Email service – sends password reset emails via Google SMTP."""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, user_name: str, reset_token: str) -> bool:
    """Send a password reset link to the user. Returns True on success."""
    reset_link = f"{settings.frontend_url}/auth?mode=reset&token={reset_token}"

    html_body = f"""
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e3a5f; margin-bottom: 8px;">Reimburse</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">Password Reset Request</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="color: #374151; font-size: 15px;">Hi <strong>{user_name}</strong>,</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password.
            This link expires in <strong>{settings.password_reset_exp_minutes} minutes</strong>.
        </p>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{reset_link}"
               style="display: inline-block; padding: 12px 32px; background: #1e3a5f; color: #ffffff;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                Reset Password
            </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
            If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            Can't click the button? Copy and paste this link:<br/>
            <a href="{reset_link}" style="color: #1e3a5f; word-break: break-all;">{reset_link}</a>
        </p>
    </div>
    """

    text_body = (
        f"Hi {user_name},\n\n"
        f"We received a request to reset your password.\n"
        f"Use the link below to set a new password (expires in {settings.password_reset_exp_minutes} min):\n\n"
        f"{reset_link}\n\n"
        f"If you didn't request this, ignore this email.\n"
    )

    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP credentials not configured – printing reset link instead")
        print(f"\n{'='*50}")
        print(f"  PASSWORD RESET LINK (SMTP not configured)")
        print(f"  User:  {to_email}")
        print(f"  Link:  {reset_link}")
        print(f"{'='*50}\n")
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your Reimburse password"
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, to_email, msg.as_string())
        logger.info("Password reset email sent to %s", to_email)
        return True
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        return False

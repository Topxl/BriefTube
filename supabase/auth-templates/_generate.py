#!/usr/bin/env python3
"""
Generate all BriefTube-branded Supabase Auth email templates as static HTML
files in this directory, then build a single JSON payload to PATCH the
Supabase Management API.

Usage:
    python3 _generate.py            # writes HTML files only
    bash apply.sh                   # uses the generated files to PATCH Supabase
"""
import json
from pathlib import Path

BRAND = "BriefTube"
SITE = "brief-tube.com"
RED = "#ef4444"

WORDMARK = (
    '<div style="margin-bottom:24px;font-weight:700;font-size:22px;'
    'letter-spacing:-0.3px;line-height:1;white-space:nowrap;">'
    '<span style="color:#ffffff;">Brief</span>'
    f'<span style="color:{RED};">Tube</span></div>'
)


def render(heading: str, body: str, cta_label: str | None = None,
           cta_url: str | None = None, footer_note: str | None = None) -> str:
    cta_block = ""
    if cta_label and cta_url:
        cta_block = (
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0">'
            f'<tr><td bgcolor="{RED}" style="border-radius:8px;">'
            f'<a href="{cta_url}" style="display:inline-block;padding:12px 28px;'
            'color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;'
            f'font-family:Arial,Helvetica,sans-serif;">{cta_label}</a>'
            '</td></tr></table>'
            '<p style="color:#71717a;font-size:13px;line-height:1.5;margin:28px 0 0;">'
            'If the button doesn&#39;t work, paste this URL into your browser:</p>'
            '<p style="color:#a1a1aa;font-size:13px;line-height:1.5;'
            f'word-break:break-all;margin:6px 0 0;">{cta_url}</p>'
        )

    note = footer_note or (
        "If you didn&#39;t request this, you can safely ignore this email."
    )

    return (
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
        '<body style="background-color:#0a0a0a;font-family:Arial,Helvetica,sans-serif;'
        'margin:0;padding:0;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'border="0" bgcolor="#0a0a0a"><tr><td align="center" style="padding:40px 20px;">'
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'border="0" bgcolor="#111111" style="max-width:520px;border-radius:12px;">'
        '<tr><td style="padding:32px;">'
        f'{WORDMARK}'
        f'<h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 12px;">'
        f'{heading}</h1>'
        f'<p style="color:#a1a1aa;font-size:15px;line-height:1.5;margin:0 0 24px;">'
        f'{body}</p>'
        f'{cta_block}'
        '<hr style="border:none;border-top:1px solid #1f1f1f;margin:28px 0;">'
        f'<p style="color:#52525b;font-size:12px;line-height:1.5;margin:0;">{note}</p>'
        '</td></tr></table>'
        '<p style="color:#52525b;font-size:12px;line-height:1.5;margin:20px 0 0;">'
        f'{BRAND} &middot; {SITE}</p>'
        '</td></tr></table></body></html>'
    )


# Each entry → (filename, supabase field name for body, supabase field name
# for subject, subject text, heading, body html, cta label, cta url, footer note)
TEMPLATES = [
    (
        "confirmation.html",
        "mailer_templates_confirmation_content",
        "mailer_subjects_confirmation",
        "Welcome to BriefTube — confirm your email",
        "Welcome to BriefTube",
        "Confirm your email to start summarizing your YouTube channels. The link expires in 60 minutes.",
        "Confirm email",
        "{{ .ConfirmationURL }}",
        None,
    ),
    (
        "magic-link.html",
        "mailer_templates_magic_link_content",
        "mailer_subjects_magic_link",
        "Sign in to BriefTube",
        "Sign in to BriefTube",
        "Click the button below to sign in. The link expires in 60 minutes and can only be used once.",
        "Sign in",
        "{{ .ConfirmationURL }}",
        None,
    ),
    (
        "invite.html",
        "mailer_templates_invite_content",
        "mailer_subjects_invite",
        "You've been invited to BriefTube",
        "You've been invited",
        "Someone invited you to BriefTube. Accept the invitation to start receiving AI audio summaries of the YouTube channels that matter to you.",
        "Accept invite",
        "{{ .ConfirmationURL }}",
        None,
    ),
    (
        "recovery.html",
        "mailer_templates_recovery_content",
        "mailer_subjects_recovery",
        "Reset your BriefTube password",
        "Reset your password",
        "Click the button below to set a new password. The link expires in 60 minutes.",
        "Reset password",
        "{{ .ConfirmationURL }}",
        None,
    ),
    (
        "email-change.html",
        "mailer_templates_email_change_content",
        "mailer_subjects_email_change",
        "Confirm your new email",
        "Confirm your new email",
        "You requested to change the email on your BriefTube account. Click the button to confirm the new address. The link expires in 60 minutes.",
        "Confirm new email",
        "{{ .ConfirmationURL }}",
        None,
    ),
    (
        "reauthentication.html",
        "mailer_templates_reauthentication_content",
        "mailer_subjects_reauthentication",
        "Verify it's you — BriefTube",
        "Verify it's you",
        "We need to verify your identity before completing this sensitive action. Enter the code below in BriefTube to continue. The code expires in 60 minutes.<br><br><span style=\"display:inline-block;background:#1f1f1f;color:#ffffff;font-family:Menlo,Consolas,monospace;font-size:24px;font-weight:700;letter-spacing:6px;padding:12px 20px;border-radius:8px;\">{{ .Token }}</span>",
        None,
        None,
        "If you didn&#39;t initiate this action, change your password immediately.",
    ),
    (
        "email-changed-notification.html",
        "mailer_templates_email_changed_notification_content",
        "mailer_subjects_email_changed_notification",
        "Your BriefTube email was changed",
        "Email address updated",
        "The email address on your BriefTube account has been changed to <strong style=\"color:#ffffff;\">{{ .NewEmail }}</strong>. If you didn&#39;t make this change, contact support immediately.",
        None,
        None,
        "Need help? Reach us at brief-tube.com/support.",
    ),
    (
        "password-changed-notification.html",
        "mailer_templates_password_changed_notification_content",
        "mailer_subjects_password_changed_notification",
        "Your BriefTube password was changed",
        "Password updated",
        "The password on your BriefTube account was just changed. If you didn&#39;t make this change, secure your account immediately by resetting your password.",
        None,
        None,
        "Need help? Reach us at brief-tube.com/support.",
    ),
    (
        "phone-changed-notification.html",
        "mailer_templates_phone_changed_notification_content",
        "mailer_subjects_phone_changed_notification",
        "Your BriefTube phone number was changed",
        "Phone number updated",
        "The phone number on your BriefTube account was just changed. If you didn&#39;t make this change, secure your account immediately.",
        None,
        None,
        "Need help? Reach us at brief-tube.com/support.",
    ),
    (
        "identity-linked-notification.html",
        "mailer_templates_identity_linked_notification_content",
        "mailer_subjects_identity_linked_notification",
        "A new sign-in method was linked to your BriefTube account",
        "Sign-in method linked",
        "A new sign-in method was just linked to your BriefTube account. If you didn&#39;t do this, secure your account immediately.",
        None,
        None,
        "Need help? Reach us at brief-tube.com/support.",
    ),
    (
        "identity-unlinked-notification.html",
        "mailer_templates_identity_unlinked_notification_content",
        "mailer_subjects_identity_unlinked_notification",
        "A sign-in method was removed from your BriefTube account",
        "Sign-in method removed",
        "A sign-in method was just removed from your BriefTube account. If you didn&#39;t do this, secure your account immediately.",
        None,
        None,
        "Need help? Reach us at brief-tube.com/support.",
    ),
    (
        "mfa-factor-enrolled-notification.html",
        "mailer_templates_mfa_factor_enrolled_notification_content",
        "mailer_subjects_mfa_factor_enrolled_notification",
        "Two-factor authentication enabled — BriefTube",
        "Two-factor authentication enabled",
        "Two-factor authentication was just enabled on your BriefTube account. Your account is now better protected.",
        None,
        None,
        "If you didn&#39;t do this, contact support immediately.",
    ),
    (
        "mfa-factor-unenrolled-notification.html",
        "mailer_templates_mfa_factor_unenrolled_notification_content",
        "mailer_subjects_mfa_factor_unenrolled_notification",
        "Two-factor authentication disabled — BriefTube",
        "Two-factor authentication disabled",
        "Two-factor authentication was just disabled on your BriefTube account. If you didn&#39;t do this, secure your account immediately.",
        None,
        None,
        "Need help? Reach us at brief-tube.com/support.",
    ),
]


def main() -> None:
    out_dir = Path(__file__).parent
    payload: dict[str, str] = {}

    for filename, body_field, subject_field, subject, heading, body, cta_label, cta_url, footer in TEMPLATES:
        html = render(heading, body, cta_label, cta_url, footer)
        (out_dir / filename).write_text(html + "\n", encoding="utf-8")
        payload[subject_field] = subject
        payload[body_field] = html

    (out_dir / "payload.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(TEMPLATES)} templates + payload.json to {out_dir}")


if __name__ == "__main__":
    main()

# Supabase Auth Email Templates

Source-controlled, BriefTube-branded HTML templates for every auth email
Supabase can send. Generated via `_generate.py` from a single style helper so
they stay visually consistent and Outlook/Gmail-safe (table-based layout,
inline styles, `bgcolor` attribute on the CTA `<td>`).

## Files

| File | Supabase template |
|---|---|
| `confirmation.html` | Confirm signup |
| `magic-link.html` | Magic Link |
| `invite.html` | Invite a user |
| `recovery.html` | Reset Password |
| `email-change.html` | Confirm email change |
| `reauthentication.html` | Reauthentication (uses `{{ .Token }}`) |
| `email-changed-notification.html` | Notification: email changed |
| `password-changed-notification.html` | Notification: password changed |
| `phone-changed-notification.html` | Notification: phone changed |
| `identity-linked-notification.html` | Notification: sign-in method linked |
| `identity-unlinked-notification.html` | Notification: sign-in method removed |
| `mfa-factor-enrolled-notification.html` | Notification: MFA enabled |
| `mfa-factor-unenrolled-notification.html` | Notification: MFA disabled |

`_generate.py` writes each HTML file plus `payload.json` (the body sent to the
Supabase Management API).

## Editing

1. Tweak copy, heading, or CTA in `_generate.py` (the `TEMPLATES` list).
2. Run `python3 _generate.py` to regenerate the HTML and the payload.
3. Run `bash apply.sh` to push to Supabase (see deploy section).

Do not hand-edit the `.html` files directly — the generator overwrites them.

## Deploy

```sh
export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxx   # https://supabase.com/dashboard/account/tokens
bash supabase/auth-templates/apply.sh
```

Project ref defaults to `zetpgbrzehchzxodwbps`. Override with
`SUPABASE_PROJECT_REF=...` if needed.

## Variables in templates

Supabase substitutes Go template variables at send time:

- `{{ .ConfirmationURL }}` — full callback URL with token (used by
  confirmation, magic link, invite, recovery, email change)
- `{{ .Token }}` — 6-digit OTP code (used by reauthentication)
- `{{ .NewEmail }}` — destination email (email-change notification only)
- `{{ .SiteURL }}` — Site URL configured in Auth settings

Don't strip the curly-brace expressions during edits.

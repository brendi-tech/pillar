"""
Send welcome emails to specific users by email address.

Usage:
    # Dry run (preview only, no emails sent)
    python manage.py send_welcome_emails user1@example.com user2@example.com

    # Actually send
    python manage.py send_welcome_emails user1@example.com user2@example.com --send
"""
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.users.models import User
from apps.users.services.email_service import send_welcome_email
from apps.users.services.email_templates import (
    WELCOME_FROM_EMAIL,
    WELCOME_REPLY_TO,
    welcome_email_html,
    welcome_email_plain_text,
    welcome_email_subject,
)


class Command(BaseCommand):
    help = "Send welcome emails to specific users by email address."

    def add_arguments(self, parser):
        parser.add_argument(
            "emails",
            nargs="+",
            type=str,
            help="Email addresses to send welcome emails to.",
        )
        parser.add_argument(
            "--send",
            action="store_true",
            default=False,
            help="Actually send emails. Without this flag, performs a dry run.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            default=False,
            help="Re-send even if welcome_email_sent_at is already set.",
        )

    def handle(self, *args, **options):
        emails = options["emails"]
        dry_run = not options["send"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no emails will be sent. Pass --send to send.\n"))

            has_host = bool(os.environ.get("SENDGRID_SMTP_HOST"))
            has_password = bool(os.environ.get("SENDGRID_SMTP_PASSWORD") or os.environ.get("SENDGRID_API_KEY"))
            ok = self.style.SUCCESS("✅")
            nope = self.style.ERROR("❌")
            self.stdout.write(f"  SENDGRID_SMTP_HOST     {ok if has_host else nope}")
            self.stdout.write(f"  SENDGRID_SMTP_PASSWORD {ok if has_password else nope}")
            self.stdout.write(f"  EMAIL_BACKEND          {settings.EMAIL_BACKEND}")
            self.stdout.write(f"  DEFAULT_FROM_EMAIL     {settings.DEFAULT_FROM_EMAIL}")
            self.stdout.write("")

        sent = 0
        skipped = 0

        for email in emails:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"  SKIP  {email} — user not found"))
                skipped += 1
                continue

            name = user.full_name or user.email

            if user.welcome_email_sent_at and not options.get("force"):
                self.stdout.write(
                    self.style.WARNING(f"  SKIP  {email} ({name}) — already sent at {user.welcome_email_sent_at}")
                )
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(f"  WOULD SEND  {email} ({name})")
                if sent == 0:
                    self.stdout.write(f"\n  From: {WELCOME_FROM_EMAIL}")
                    self.stdout.write(f"  Reply-To: {WELCOME_REPLY_TO}")
                    self.stdout.write(f"  To: {email}")
                    self.stdout.write(f"  Subject: {welcome_email_subject()}")
                    self.stdout.write(f"\n--- HTML ---\n{welcome_email_html(user)}\n--- END ---\n")
                sent += 1
            else:
                ok = send_welcome_email(user)
                if ok:
                    self.stdout.write(self.style.SUCCESS(f"  SENT  {email} ({name})"))
                    sent += 1
                else:
                    self.stdout.write(self.style.ERROR(f"  FAIL  {email} ({name})"))
                    skipped += 1

        self.stdout.write("")
        action = "Would send" if dry_run else "Sent"
        self.stdout.write(f"{action}: {sent}  |  Skipped: {skipped}  |  Total: {len(emails)}")

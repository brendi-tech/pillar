"""
Grant bonus responses to an organization.

Creates a BonusResponseGrant that stacks with existing grants and
the org's plan limit. Bonus responses are free (not metered to Stripe).
"""
import calendar
from datetime import datetime, timezone as tz

from django.core.management.base import BaseCommand, CommandError

from apps.billing.models import BonusResponseGrant
from apps.users.models import Organization, User


class Command(BaseCommand):
    help = "Grant bonus responses to an organization (by user email)"

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "email",
            type=str,
            help="Email of a user in the organization",
        )
        parser.add_argument(
            "amount",
            type=int,
            help="Number of bonus responses to grant",
        )
        parser.add_argument(
            "--expires",
            type=str,
            default=None,
            help="Expiry date YYYY-MM-DD (default: end of current month, UTC)",
        )
        parser.add_argument(
            "--memo",
            type=str,
            default="",
            help="Reason for the grant (e.g. 'Early adopter bonus')",
        )
        parser.add_argument(
            "--no-expire",
            action="store_true",
            help="Grant never expires",
        )

    def handle(self, *args, **options) -> None:
        email: str = options["email"]
        amount: int = options["amount"]

        if amount <= 0:
            raise CommandError("Amount must be a positive integer")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user found with email: {email}")

        org = user.primary_organization
        if not org:
            orgs = Organization.objects.filter(members=user)
            if not orgs.exists():
                raise CommandError(f"User {email} has no organizations")
            org = orgs.first()

        # Determine expiry
        if options["no_expire"]:
            expires_at = None
        elif options["expires"]:
            try:
                date = datetime.strptime(options["expires"], "%Y-%m-%d")
                expires_at = date.replace(
                    hour=23, minute=59, second=59, tzinfo=tz.utc,
                )
            except ValueError:
                raise CommandError("Invalid date format. Use YYYY-MM-DD")
        else:
            now = datetime.now(tz.utc)
            last_day = calendar.monthrange(now.year, now.month)[1]
            expires_at = now.replace(
                day=last_day, hour=23, minute=59, second=59, microsecond=0,
            )

        grant = BonusResponseGrant.objects.create(
            organization=org,
            amount=amount,
            expires_at=expires_at,
            memo=options["memo"],
        )

        expires_str = (
            expires_at.strftime("%Y-%m-%d %H:%M UTC") if expires_at else "never"
        )
        self.stdout.write(self.style.SUCCESS(
            f"Granted {amount} bonus responses to '{org.name}' "
            f"(expires: {expires_str})"
        ))

        total = org.active_bonus_responses
        self.stdout.write(
            f"  Total active bonus for org: {total} responses"
        )

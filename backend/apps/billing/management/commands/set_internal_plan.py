"""
Set an organization's plan without creating a Stripe subscription.

Used for internal accounts that should have full access without billing.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.billing.constants import PLAN_ORDER
from apps.users.models import Organization, User


class Command(BaseCommand):
    help = "Set an organization's plan without Stripe billing (for internal accounts)"

    def add_arguments(self, parser):
        parser.add_argument("email", type=str, help="Email of a user in the organization")
        parser.add_argument(
            "--plan",
            type=str,
            default="enterprise",
            choices=PLAN_ORDER,
            help="Plan to assign (default: enterprise)",
        )
        parser.add_argument(
            "--clear-stripe",
            action="store_true",
            help="Clear Stripe customer/subscription IDs to prevent any billing",
        )

    def handle(self, *args, **options):
        email = options["email"]
        plan = options["plan"]

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

        old_plan = org.plan
        org.plan = plan
        org.subscription_status = "active"

        if options["clear_stripe"]:
            org.stripe_customer_id = ""
            org.stripe_subscription_id = ""
            org.stripe_price_id = ""

        org.save(
            update_fields=["plan", "subscription_status", "stripe_customer_id",
                           "stripe_subscription_id", "stripe_price_id"]
            if options["clear_stripe"]
            else ["plan", "subscription_status"]
        )

        self.stdout.write(self.style.SUCCESS(
            f"Organization '{org.name}' (id={org.id}): {old_plan} -> {plan}"
        ))
        if options["clear_stripe"]:
            self.stdout.write(self.style.SUCCESS("Cleared Stripe IDs"))

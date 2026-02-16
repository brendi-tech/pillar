"""
Refresh Agent Score reports for a set of domains/URLs.

This command is designed for:
- Purging legacy reports (e.g. old category key schemas) and rerunning scans
- Clearing Redis lookup-by-domain cache so the marketing showcase reflects the latest schema

It bypasses the public scan API throttles by enqueuing Hatchet workflows directly.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandError


@dataclass(frozen=True)
class TargetSite:
    url: str
    label: str

    @property
    def domain(self) -> str:
        from apps.agent_score.utils import extract_domain

        return extract_domain(self.url)


SHOWCASE_SITES: list[TargetSite] = [
    # Tech-forward startups / Series A-B
    TargetSite(url="https://linear.app", label="Linear"),
    TargetSite(url="https://resend.com", label="Resend"),
    TargetSite(url="https://neon.tech", label="Neon"),
    TargetSite(url="https://clerk.com", label="Clerk"),
    TargetSite(url="https://cal.com", label="Cal.com"),
    TargetSite(url="https://loops.so", label="Loops"),
    TargetSite(url="https://dub.co", label="Dub"),
    # Tech-forward established
    TargetSite(url="https://vercel.com", label="Vercel"),
    TargetSite(url="https://shopify.com", label="Shopify"),
    TargetSite(url="https://hubspot.com", label="HubSpot"),
    TargetSite(url="https://twilio.com", label="Twilio"),
    TargetSite(url="https://gusto.com", label="Gusto"),
    TargetSite(url="https://zendesk.com", label="Zendesk"),
    # Traditional companies
    TargetSite(url="https://acehardware.com", label="Ace Hardware"),
    TargetSite(url="https://potterybarn.com", label="Pottery Barn"),
    TargetSite(url="https://1800flowers.com", label="1-800-Flowers"),
    TargetSite(url="https://papajohns.com", label="Papa Johns"),
    TargetSite(url="https://dickssportinggoods.com", label="Dick's Sporting"),
    TargetSite(url="https://jcrew.com", label="J.Crew"),
    TargetSite(url="https://rei.com", label="REI"),
]


class Command(BaseCommand):
    help = (
        "Delete existing Agent Score reports and enqueue fresh scans, "
        "optionally clearing Redis domain lookup cache."
    )

    def add_arguments(self, parser: argparse.ArgumentParser) -> None:
        parser.add_argument(
            "--preset",
            choices=["showcase"],
            default="showcase",
            help="Which predefined set of sites to refresh (default: showcase).",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Delete ALL AgentScoreReport rows (ignores preset selection).",
        )
        parser.add_argument(
            "--no-delete",
            action="store_true",
            help="Do not delete existing reports before enqueueing new scans.",
        )
        parser.add_argument(
            "--clear-redis-cache",
            action="store_true",
            help="Clear lookup-by-domain Redis cache keys for the target domains.",
        )
        parser.add_argument(
            "--no-signup",
            action="store_true",
            help="Disable signup test for new scans.",
        )
        parser.add_argument(
            "--no-openclaw",
            action="store_true",
            help="Disable OpenClaw agent experience test for new scans.",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip interactive confirmation (required for --all).",
        )

    def handle(self, *args, **options):
        from django.db import transaction

        from apps.agent_score.models import AgentScoreReport
        from common.cache_keys import CacheKeys
        from common.task_router import TaskRouter

        preset: str = options["preset"]
        delete_existing: bool = not options["no_delete"]
        clear_cache: bool = bool(options["clear_redis_cache"])
        signup_enabled: bool = not options["no_signup"]
        openclaw_enabled: bool = not options["no_openclaw"]
        delete_all: bool = bool(options["all"])
        yes: bool = bool(options["yes"])

        if delete_all and not yes:
            raise CommandError("--all is destructive; re-run with --yes to confirm.")

        if preset != "showcase":
            raise CommandError(f"Unknown preset: {preset}")

        targets = SHOWCASE_SITES
        domains = sorted({t.domain for t in targets})

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Agent Score refresh"))
        self.stdout.write(f"Preset: {preset} ({len(targets)} sites, {len(domains)} domains)")
        self.stdout.write(f"Delete existing: {delete_existing} ({'ALL reports' if delete_all else 'matching domains'})")
        self.stdout.write(f"Clear Redis domain cache: {clear_cache}")
        self.stdout.write(f"Signup test enabled: {signup_enabled}")
        self.stdout.write(f"OpenClaw enabled: {openclaw_enabled}")

        if delete_existing:
            with transaction.atomic():
                if delete_all:
                    deleted = AgentScoreReport.objects.all().delete()
                    self.stdout.write(self.style.WARNING(f"Deleted ALL reports: {deleted}"))
                else:
                    deleted = AgentScoreReport.objects.filter(domain__in=domains).delete()
                    self.stdout.write(self.style.WARNING(f"Deleted reports for domains: {deleted}"))

        if clear_cache:
            cleared = 0
            for d in domains:
                CacheKeys.clear_agent_score_domain_report(d)
                cleared += 1
                # Also clear the "www." variant because lookup-by-domain considers it.
                if not d.startswith("www."):
                    CacheKeys.clear_agent_score_domain_report(f"www.{d}")
            self.stdout.write(self.style.SUCCESS(f"Cleared {cleared} Redis cache keys (plus www variants)."))

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Enqueueing scans"))

        created_ids: list[str] = []
        for site in targets:
            domain = site.domain
            report = AgentScoreReport.objects.create(
                url=site.url,
                domain=domain,
                status="running",
                signup_test_enabled=signup_enabled,
                openclaw_test_enabled=openclaw_enabled,
            )
            report_id = str(report.id)
            created_ids.append(report_id)

            # Fire all layers in parallel, same as the public scan endpoint.
            TaskRouter.execute("agent-score-http-probes", report_id=report_id)
            TaskRouter.execute("agent-score-browser-analysis", report_id=report_id)
            if signup_enabled:
                TaskRouter.execute("agent-score-signup-test", report_id=report_id)
            if openclaw_enabled:
                TaskRouter.execute("agent-score-openclaw-test", report_id=report_id)

            self.stdout.write(f"- {site.label:20s} {domain:24s} report={report_id}")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Enqueued {len(created_ids)} scans."))
        self.stdout.write(
            "Tip: once reports complete, lookup-by-domain cache will auto-invalidate per domain."
        )


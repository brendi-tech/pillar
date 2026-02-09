"""
Management command to view recent agent session logs.

Usage:
    uv run python manage.py view_agent_logs --list
    uv run python manage.py view_agent_logs --view th_abc123_20250201_143022.txt
    uv run python manage.py view_agent_logs --search "TimeoutError"
    uv run python manage.py view_agent_logs --latest
"""
from collections import deque
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.mcp.services.agent.session_logger import AgentSessionLogManager


class Command(BaseCommand):
    help = 'View recent agent session logs for debugging'

    def add_arguments(self, parser):
        parser.add_argument(
            '--list',
            action='store_true',
            help='List recent log files',
        )
        parser.add_argument(
            '--view',
            type=str,
            help='View a specific log file by name',
        )
        parser.add_argument(
            '--latest',
            action='store_true',
            help='View the most recent log file',
        )
        parser.add_argument(
            '--search',
            type=str,
            help='Search for a pattern across all log files',
        )
        parser.add_argument(
            '--tail',
            type=int,
            default=20,
            help='Number of recent logs to list (default: 20)',
        )
        parser.add_argument(
            '--cleanup',
            action='store_true',
            help='Clean up old log files (keeps most recent 100)',
        )
        parser.add_argument(
            '--with-django',
            action='store_true',
            help='Include linked Django log output when viewing logs',
        )
        parser.add_argument(
            '--django-lines',
            type=int,
            default=200,
            help='Number of Django log lines to include (default: 200)',
        )

    def handle(self, *args, **options):
        log_dir = AgentSessionLogManager.get_log_dir()
        self._with_django = options.get('with_django', False)
        self._django_lines = options.get('django_lines', 200)
        
        if options['list']:
            self._list_logs(options['tail'])
        elif options['view']:
            self._view_log(options['view'])
        elif options['latest']:
            self._view_latest()
        elif options['search']:
            self._search_logs(options['search'])
        elif options['cleanup']:
            self._cleanup_logs()
        else:
            self.stdout.write(self.style.WARNING(
                'No action specified. Use --list, --view, --latest, --search, or --cleanup'
            ))
            self.stdout.write(f'\nLog directory: {log_dir}')

    def _list_logs(self, limit: int):
        """List recent log files."""
        logs = AgentSessionLogManager.list_recent_logs(limit=limit)
        
        if not logs:
            self.stdout.write(self.style.WARNING('No agent session logs found.'))
            return
        
        self.stdout.write(self.style.SUCCESS(f'Recent agent session logs ({len(logs)} files):'))
        self.stdout.write('')
        
        for log_file in logs:
            stat = log_file.stat()
            size_kb = stat.st_size / 1024
            from datetime import datetime
            mtime = datetime.fromtimestamp(stat.st_mtime)
            
            self.stdout.write(
                f'  {log_file.name} '
                f'({size_kb:.1f} KB, {mtime.strftime("%Y-%m-%d %H:%M:%S")})'
            )

    def _view_log(self, filename: str):
        """View a specific log file."""
        log_dir = AgentSessionLogManager.get_log_dir()
        log_file = log_dir / filename
        
        if not log_file.exists():
            self.stdout.write(self.style.ERROR(f'Log file not found: {filename}'))
            return
        
        self.stdout.write(self.style.SUCCESS(f'=== {filename} ==='))
        self.stdout.write('')
        
        with open(log_file, 'r', encoding='utf-8') as f:
            self.stdout.write(f.read())

        linked_path = self._get_linked_django_log_path(log_file)
        if linked_path:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS(f'Linked Django log: {linked_path}'))
            if self._with_django:
                self._print_django_log_tail(linked_path)

    def _view_latest(self):
        """View the most recent log file."""
        logs = AgentSessionLogManager.list_recent_logs(limit=1)
        
        if not logs:
            self.stdout.write(self.style.WARNING('No agent session logs found.'))
            return
        
        self._view_log(logs[0].name)

    def _search_logs(self, pattern: str):
        """Search for a pattern across all log files."""
        log_dir = AgentSessionLogManager.get_log_dir()
        logs = list(log_dir.glob('*.txt'))
        
        if not logs:
            self.stdout.write(self.style.WARNING('No agent session logs found.'))
            return
        
        self.stdout.write(self.style.SUCCESS(f'Searching for "{pattern}" in {len(logs)} files...'))
        self.stdout.write('')
        
        matches = []
        for log_file in logs:
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if pattern.lower() in content.lower():
                        # Count occurrences
                        count = content.lower().count(pattern.lower())
                        matches.append((log_file.name, count))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  Error reading {log_file.name}: {e}'))
        
        if matches:
            self.stdout.write(self.style.SUCCESS(f'Found matches in {len(matches)} files:'))
            for filename, count in sorted(matches, key=lambda x: x[1], reverse=True):
                self.stdout.write(f'  {filename}: {count} occurrence(s)')
        else:
            self.stdout.write(self.style.WARNING(f'No matches found for "{pattern}"'))

    def _cleanup_logs(self):
        """Clean up old log files."""
        deleted = AgentSessionLogManager.cleanup_old_logs(max_files=100)
        
        if deleted > 0:
            self.stdout.write(self.style.SUCCESS(f'Cleaned up {deleted} old log file(s).'))
        else:
            self.stdout.write(self.style.SUCCESS('No cleanup needed. Log count within limits.'))

    def _get_linked_django_log_path(self, log_file: Path) -> Path | None:
        """Extract linked Django log path from agent session log header."""
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                for _ in range(120):
                    line = f.readline()
                    if not line:
                        break
                    if line.startswith("Django Log File:"):
                        _, _, value = line.partition("Django Log File:")
                        path_str = value.strip()
                        if path_str:
                            return Path(path_str)
        except Exception:
            return None
        return None

    def _print_django_log_tail(self, log_path: Path) -> None:
        """Print the tail of a linked Django log file."""
        if not log_path.exists():
            self.stdout.write(self.style.WARNING('Linked Django log file not found.'))
            return

        try:
            with open(log_path, 'r', encoding='utf-8') as f:
                tail_lines = deque(f, maxlen=self._django_lines)
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f'Error reading Django log: {exc}'))
            return

        self.stdout.write(self.style.SUCCESS(
            f'=== LINKED DJANGO LOG (last {len(tail_lines)} lines) ==='
        ))
        self.stdout.write('')
        for line in tail_lines:
            self.stdout.write(line.rstrip('\n'))

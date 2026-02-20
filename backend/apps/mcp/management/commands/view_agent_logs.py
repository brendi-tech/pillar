"""
Management command to view recent agent trace files.

Usage:
    uv run python manage.py view_agent_logs --list
    uv run python manage.py view_agent_logs --view <filename>
    uv run python manage.py view_agent_logs --latest
    uv run python manage.py view_agent_logs --search "TimeoutError"
    uv run python manage.py view_agent_logs --cleanup
"""
import json
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand

from common.observability.file_exporter import TraceFileManager


class Command(BaseCommand):
    help = 'View recent agent trace files for debugging'

    def add_arguments(self, parser):
        parser.add_argument('--list', action='store_true', help='List recent trace files')
        parser.add_argument('--view', type=str, help='View a specific trace file by name')
        parser.add_argument('--latest', action='store_true', help='View the most recent trace file')
        parser.add_argument('--search', type=str, help='Search for a pattern across all trace files')
        parser.add_argument('--tail', type=int, default=20, help='Number of recent traces to list (default: 20)')
        parser.add_argument('--cleanup', action='store_true', help='Clean up old trace files (keeps most recent 100)')
        parser.add_argument('--raw', action='store_true', help='Output raw NDJSON instead of formatted view')

    def handle(self, *args, **options):
        self._manager = TraceFileManager()
        self._raw = options.get('raw', False)

        if options['list']:
            self._list_traces(options['tail'])
        elif options['view']:
            self._view_trace(options['view'])
        elif options['latest']:
            self._view_latest()
        elif options['search']:
            self._search_traces(options['search'])
        elif options['cleanup']:
            self._cleanup_traces()
        else:
            self.stdout.write(self.style.WARNING(
                'No action specified. Use --list, --view, --latest, --search, or --cleanup'
            ))
            self.stdout.write(f'\nTrace directory: {self._manager.get_dir()}')

    def _list_traces(self, limit: int):
        traces = self._manager.list_recent_traces(limit=limit)
        if not traces:
            self.stdout.write(self.style.WARNING('No trace files found.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Recent agent traces ({len(traces)} files):'))
        self.stdout.write('')

        for trace_file in traces:
            stat = trace_file.stat()
            size_kb = stat.st_size / 1024
            mtime = datetime.fromtimestamp(stat.st_mtime)
            span_count = sum(1 for _ in open(trace_file, encoding='utf-8'))
            self.stdout.write(
                f'  {trace_file.name} '
                f'({size_kb:.1f} KB, {span_count} spans, {mtime.strftime("%Y-%m-%d %H:%M:%S")})'
            )

    def _view_trace(self, filename: str):
        base = self._manager.get_dir()
        # Support both direct filename and path within month dirs
        trace_file = base / filename
        if not trace_file.exists():
            # Search month subdirectories
            matches = list(base.glob(f"**/{filename}"))
            if matches:
                trace_file = matches[0]
            else:
                self.stdout.write(self.style.ERROR(f'Trace file not found: {filename}'))
                return

        self.stdout.write(self.style.SUCCESS(f'=== {trace_file.name} ==='))
        self.stdout.write('')

        if self._raw:
            with open(trace_file, 'r', encoding='utf-8') as f:
                self.stdout.write(f.read())
            return

        self._print_formatted_trace(trace_file)

    def _view_latest(self):
        traces = self._manager.list_recent_traces(limit=1)
        if not traces:
            self.stdout.write(self.style.WARNING('No trace files found.'))
            return
        self._view_trace(traces[0].name)

    def _search_traces(self, pattern: str):
        base = self._manager.get_dir()
        files = list(base.glob('**/*.ndjson'))
        if not files:
            self.stdout.write(self.style.WARNING('No trace files found.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Searching for "{pattern}" in {len(files)} files...'))
        self.stdout.write('')

        matches = []
        for trace_file in files:
            try:
                with open(trace_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if pattern.lower() in content.lower():
                        count = content.lower().count(pattern.lower())
                        matches.append((trace_file.name, count))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  Error reading {trace_file.name}: {e}'))

        if matches:
            self.stdout.write(self.style.SUCCESS(f'Found matches in {len(matches)} files:'))
            for filename, count in sorted(matches, key=lambda x: x[1], reverse=True):
                self.stdout.write(f'  {filename}: {count} occurrence(s)')
        else:
            self.stdout.write(self.style.WARNING(f'No matches found for "{pattern}"'))

    def _cleanup_traces(self):
        deleted = self._manager.cleanup_old_traces(max_files=100)
        if deleted > 0:
            self.stdout.write(self.style.SUCCESS(f'Cleaned up {deleted} old trace file(s).'))
        else:
            self.stdout.write(self.style.SUCCESS('No cleanup needed. Trace count within limits.'))

    def _print_formatted_trace(self, trace_file: Path):
        """Pretty-print spans in chronological order with parent-child indentation."""
        spans = []
        with open(trace_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        spans.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

        if not spans:
            self.stdout.write('  (empty trace file)')
            return

        # Sort by start_time
        spans.sort(key=lambda s: s.get('start_time', ''))

        # Build parent lookup for indentation
        parent_map = {}
        for s in spans:
            parent_map[s.get('span_id')] = s.get('parent_span_id')

        def _depth(span_id: str, seen: set = None) -> int:
            if seen is None:
                seen = set()
            if span_id in seen:
                return 0
            seen.add(span_id)
            parent = parent_map.get(span_id)
            if parent is None:
                return 0
            return 1 + _depth(parent, seen)

        for span in spans:
            depth = _depth(span.get('span_id', ''))
            indent = '  ' * depth
            name = span.get('name', 'unknown')
            duration = span.get('duration_ms', 0)
            status = span.get('status', {})
            status_str = f" [{status.get('status_code', '')}]" if status else ""

            self.stdout.write(f'{indent}{name} ({duration:.0f}ms){status_str}')

            # Show key attributes
            attrs = span.get('attributes', {})
            for key in sorted(attrs.keys()):
                val = attrs[key]
                if isinstance(val, str) and len(val) > 200:
                    val = val[:200] + '...'
                self.stdout.write(f'{indent}  {key}: {val}')

            # Show events
            for event in span.get('events', []):
                self.stdout.write(f'{indent}  [{event.get("name", "")}]')
                for ek, ev in event.get('attributes', {}).items():
                    if isinstance(ev, str) and len(ev) > 200:
                        ev = ev[:200] + '...'
                    self.stdout.write(f'{indent}    {ek}: {ev}')

            self.stdout.write('')

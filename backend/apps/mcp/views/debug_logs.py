"""
API views for agent trace debug logs.

These endpoints expose the agent trace files for debugging in the admin panel.
Only accessible to authenticated admins.
"""
import json
import logging
from datetime import datetime

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.users.permissions import IsAuthenticatedAdmin
from common.observability.file_exporter import TraceFileManager

logger = logging.getLogger(__name__)

_manager = TraceFileManager()


class DebugSessionListView(APIView):
    """
    List recent agent trace files.

    GET /api/admin/debug/sessions/

    Query params:
        limit: Maximum number of traces to return (default: 20, max: 100)
    """
    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        try:
            limit = min(int(request.query_params.get('limit', 20)), 100)
        except (ValueError, TypeError):
            limit = 20

        traces = _manager.list_recent_traces(limit=limit)

        result = []
        for trace_path in traces:
            try:
                stat = trace_path.stat()
                parts = trace_path.stem.split('_')
                trace_id_prefix = parts[1] if len(parts) > 1 else 'unknown'

                result.append({
                    'filename': trace_path.name,
                    'path': str(trace_path.relative_to(_manager.get_dir())),
                    'trace_id_prefix': trace_id_prefix,
                    'size_bytes': stat.st_size,
                    'size_kb': round(stat.st_size / 1024, 1),
                    'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
            except (OSError, ValueError) as e:
                logger.warning(f"Error reading trace file {trace_path}: {e}")
                continue

        return Response({
            'count': len(result),
            'logs': result,
        })


class DebugSessionDetailView(APIView):
    """
    Get contents of a specific agent trace file.

    GET /api/admin/debug/sessions/<path:filename>/

    Returns:
        Trace file contents as JSON spans
    """
    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request, filename):
        base = _manager.get_dir()

        try:
            log_path = (base / filename).resolve()
            if not str(log_path).startswith(str(base.resolve())):
                return Response({'error': 'Invalid filename'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, OSError):
            return Response({'error': 'Invalid filename'}, status=status.HTTP_400_BAD_REQUEST)

        if not log_path.exists():
            return Response({'error': 'Trace file not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            spans = []
            with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            spans.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

            stat = log_path.stat()

            return Response({
                'filename': log_path.name,
                'size_bytes': stat.st_size,
                'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'spans': spans,
            })

        except OSError as e:
            logger.error(f"Error reading trace file {log_path}: {e}")
            return Response(
                {'error': 'Failed to read trace file'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DebugSessionLatestView(APIView):
    """
    Get the most recent agent trace file.

    GET /api/admin/debug/sessions/latest/
    """
    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        traces = _manager.list_recent_traces(limit=1)

        if not traces:
            return Response({'error': 'No trace files found'}, status=status.HTTP_404_NOT_FOUND)

        trace_path = traces[0]

        try:
            spans = []
            with open(trace_path, 'r', encoding='utf-8', errors='replace') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            spans.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

            stat = trace_path.stat()

            return Response({
                'filename': trace_path.name,
                'path': str(trace_path.relative_to(_manager.get_dir())),
                'size_bytes': stat.st_size,
                'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'spans': spans,
            })

        except OSError as e:
            logger.error(f"Error reading trace file {trace_path}: {e}")
            return Response(
                {'error': 'Failed to read trace file'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

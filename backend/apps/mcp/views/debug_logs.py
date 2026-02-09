"""
API views for agent session debug logs.

These endpoints expose the agent session logs for debugging in the admin panel.
Only accessible to authenticated admins.
"""
import logging
from pathlib import Path
from datetime import datetime

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.users.permissions import IsAuthenticatedAdmin
from apps.mcp.services.agent.session_logger import AgentSessionLogManager

logger = logging.getLogger(__name__)


class DebugSessionListView(APIView):
    """
    List recent agent session logs.
    
    GET /api/admin/debug/sessions/
    
    Query params:
        limit: Maximum number of logs to return (default: 20, max: 100)
    
    Returns:
        List of session log metadata (filename, timestamp, size)
    """
    permission_classes = [IsAuthenticatedAdmin]
    
    def get(self, request):
        try:
            limit = min(int(request.query_params.get('limit', 20)), 100)
        except (ValueError, TypeError):
            limit = 20
        
        logs = AgentSessionLogManager.list_recent_logs(limit=limit)
        
        result = []
        for log_path in logs:
            try:
                stat = log_path.stat()
                # Parse filename to extract metadata
                # Format: {sort_prefix}_{thread_id}_{timestamp}.txt
                parts = log_path.stem.split('_')
                thread_id = '_'.join(parts[1:-2]) if len(parts) > 3 else 'unknown'
                
                result.append({
                    'filename': log_path.name,
                    'path': str(log_path.relative_to(AgentSessionLogManager.get_log_dir())),
                    'thread_id': thread_id,
                    'size_bytes': stat.st_size,
                    'size_kb': round(stat.st_size / 1024, 1),
                    'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
            except (OSError, ValueError) as e:
                logger.warning(f"Error reading log file {log_path}: {e}")
                continue
        
        return Response({
            'count': len(result),
            'logs': result,
        })


class DebugSessionDetailView(APIView):
    """
    Get contents of a specific agent session log.
    
    GET /api/admin/debug/sessions/<path:filename>/
    
    Query params:
        lines: Maximum number of lines to return (default: all)
        tail: If true, return last N lines instead of first N
    
    Returns:
        Log file contents
    """
    permission_classes = [IsAuthenticatedAdmin]
    
    def get(self, request, filename):
        log_dir = AgentSessionLogManager.get_log_dir()
        
        # Security: Ensure filename doesn't escape log directory
        try:
            log_path = (log_dir / filename).resolve()
            if not str(log_path).startswith(str(log_dir.resolve())):
                return Response(
                    {'error': 'Invalid filename'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, OSError):
            return Response(
                {'error': 'Invalid filename'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not log_path.exists():
            return Response(
                {'error': 'Log file not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            lines_limit = request.query_params.get('lines')
            tail = request.query_params.get('tail', '').lower() == 'true'
            
            with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
                if lines_limit:
                    try:
                        limit = int(lines_limit)
                        all_lines = f.readlines()
                        if tail:
                            lines = all_lines[-limit:]
                        else:
                            lines = all_lines[:limit]
                        content = ''.join(lines)
                    except ValueError:
                        content = f.read()
                else:
                    content = f.read()
            
            stat = log_path.stat()
            
            return Response({
                'filename': log_path.name,
                'size_bytes': stat.st_size,
                'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'content': content,
            })
            
        except OSError as e:
            logger.error(f"Error reading log file {log_path}: {e}")
            return Response(
                {'error': 'Failed to read log file'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DebugSessionLatestView(APIView):
    """
    Get the most recent agent session log.
    
    GET /api/admin/debug/sessions/latest/
    
    Returns:
        Most recent log file contents
    """
    permission_classes = [IsAuthenticatedAdmin]
    
    def get(self, request):
        logs = AgentSessionLogManager.list_recent_logs(limit=1)
        
        if not logs:
            return Response(
                {'error': 'No session logs found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        log_path = logs[0]
        
        try:
            with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            
            stat = log_path.stat()
            
            return Response({
                'filename': log_path.name,
                'path': str(log_path.relative_to(AgentSessionLogManager.get_log_dir())),
                'size_bytes': stat.st_size,
                'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'content': content,
            })
            
        except OSError as e:
            logger.error(f"Error reading log file {log_path}: {e}")
            return Response(
                {'error': 'Failed to read log file'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

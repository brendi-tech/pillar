"""
Hatchet workflow for cleaning up expired pending uploads.

This workflow deletes pending uploads and their files that have
expired (older than 24 hours) without being attached to a source.

Can be triggered:
- Manually via TaskRouter.execute('cleanup-pending-uploads')
- Via an external scheduler (e.g., Kubernetes CronJob)
"""
import logging
from datetime import timedelta

from asgiref.sync import sync_to_async
from django.core.files.storage import default_storage
from django.utils import timezone
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class CleanupPendingUploadsInput(BaseModel):
    """Input for the cleanup-pending-uploads workflow."""
    dry_run: bool = False


@hatchet.task(
    name="cleanup-pending-uploads",
    retries=1,
    execution_timeout=timedelta(minutes=10),
    input_validator=CleanupPendingUploadsInput,
)
async def cleanup_pending_uploads_workflow(workflow_input: CleanupPendingUploadsInput, context: Context):
    """
    Clean up expired pending uploads.

    Finds all PendingUpload records where expires_at < now,
    deletes their files from storage, and removes the records.

    Args:
        workflow_input: CleanupPendingUploadsInput with dry_run flag
        context: Hatchet execution context

    Returns:
        Dict with cleanup statistics
    """
    from apps.knowledge.models import PendingUpload

    dry_run = workflow_input.dry_run

    logger.info(f"[CLEANUP] Starting pending uploads cleanup (dry_run={dry_run})")

    # Find expired pending uploads
    expired_uploads = PendingUpload.objects.filter(
        expires_at__lt=timezone.now()
    )

    total_count = await expired_uploads.acount()
    logger.info(f"[CLEANUP] Found {total_count} expired pending uploads")

    if total_count == 0:
        return {
            'status': 'completed',
            'expired_count': 0,
            'deleted_count': 0,
            'failed_count': 0,
            'dry_run': dry_run,
        }

    deleted_count = 0
    failed_count = 0
    bytes_freed = 0

    async for pending_upload in expired_uploads:
        try:
            file_path = pending_upload.file_path
            file_size = pending_upload.file_size

            if not dry_run:
                # Delete file from storage (wrap sync operations for async context)
                if file_path:
                    try:
                        file_exists = await sync_to_async(default_storage.exists)(file_path)
                        if file_exists:
                            await sync_to_async(default_storage.delete)(file_path)
                            logger.debug(f"[CLEANUP] Deleted file: {file_path}")
                    except Exception as e:
                        logger.warning(f"[CLEANUP] Failed to delete file {file_path}: {e}")

                # Delete record
                await pending_upload.adelete()

            deleted_count += 1
            bytes_freed += file_size or 0

            logger.debug(
                f"[CLEANUP] {'Would delete' if dry_run else 'Deleted'} "
                f"pending upload: {pending_upload.id} ({pending_upload.original_filename})"
            )

        except Exception as e:
            failed_count += 1
            logger.error(f"[CLEANUP] Failed to clean up pending upload {pending_upload.id}: {e}")

    bytes_freed_mb = bytes_freed / (1024 * 1024)
    logger.info(
        f"[CLEANUP] Cleanup completed: "
        f"{'would delete' if dry_run else 'deleted'} {deleted_count}/{total_count} uploads, "
        f"failed {failed_count}, freed {bytes_freed_mb:.2f} MB"
    )

    return {
        'status': 'completed',
        'expired_count': total_count,
        'deleted_count': deleted_count,
        'failed_count': failed_count,
        'bytes_freed': bytes_freed,
        'bytes_freed_mb': round(bytes_freed_mb, 2),
        'dry_run': dry_run,
    }

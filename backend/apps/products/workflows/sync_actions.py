"""
Hatchet workflow for async action synchronization.

Processes action sync jobs by:
1. Creating/updating actions in bulk
2. Generating embeddings in batches
3. Creating ActionDeployment
4. Verifying completion
"""
import asyncio
import logging
from datetime import timedelta
from typing import Any, Optional

from django.db import transaction
from django.utils import timezone
from asgiref.sync import sync_to_async
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class SyncActionsInput(BaseModel):
    """Input for the products-sync-actions workflow."""
    job_id: str
    product_id: str
    organization_id: Optional[str] = None
    platform: Optional[str] = None
    version: Optional[str] = None
    git_sha: str = ''
    manifest_hash: Optional[str] = None
    actions: list[dict[str, Any]] = []
    deployed_by: str = 'ci/unknown'
    agent_guidance: Optional[str] = None


@hatchet.task(
    name="products-sync-actions",
    retries=2,
    execution_timeout=timedelta(minutes=30),
    input_validator=SyncActionsInput,
)
async def sync_actions_workflow(workflow_input: SyncActionsInput, context: Context):
    """
    Sync actions for a product asynchronously.
    
    Pipeline:
    1. Load job and product
    2. Update job status to processing
    3. Bulk create/update actions (without embeddings)
    4. Bulk delete removed actions
    5. Generate embeddings in batches
    6. Create ActionDeployment
    7. Verify completion
    8. Finalize job (atomic)
    
    Args:
        workflow_input: SyncActionsInput with job_id, product_id, actions, etc.
        context: Hatchet execution context
    """
    from apps.products.models import (
        ActionSyncJob, ActionSyncJobStatus, Action, ActionDeployment, Product
    )
    from apps.products.views import ActionSyncData
    
    job_id = workflow_input.job_id
    product_id = workflow_input.product_id
    organization_id = workflow_input.organization_id
    platform = workflow_input.platform
    version = workflow_input.version
    git_sha = workflow_input.git_sha
    manifest_hash = workflow_input.manifest_hash
    actions_data = workflow_input.actions
    deployed_by = workflow_input.deployed_by
    agent_guidance = workflow_input.agent_guidance
    
    if not job_id or not product_id:
        logger.error("[ActionSync] Missing required job_id or product_id")
        return {'error': 'Missing required fields'}
    
    logger.info(f"[ActionSync] Starting workflow for job {job_id}")
    
    try:
        # Step 1: Load job and product
        job = await ActionSyncJob.objects.select_related('product', 'organization').aget(id=job_id)
        product = await Product.objects.select_related('organization').aget(id=product_id)
        
        # Step 2: Update job status to processing
        await update_job_status(job_id, ActionSyncJobStatus.PROCESSING, started_at=timezone.now())
        
        # Step 3: Bulk create/update actions (without embeddings)
        action_objs, created_count, updated_count = await bulk_update_actions(
            product, actions_data
        )
        
        # Step 4: Bulk delete removed actions
        action_names = [a['name'] for a in actions_data]
        deleted_count = await bulk_delete_actions(product, action_names)
        
        # Update progress
        await update_job_progress(
            job_id,
            total=len(actions_data),
            processed=len(actions_data),
            created=created_count,
            updated=updated_count,
            deleted=deleted_count,
        )
        
        # Step 5: Generate embeddings in batches
        await generate_embeddings_batched(product, action_objs, job_id)
        
        # Step 6: Create ActionDeployment
        action_ids = [str(action.id) for action in action_objs]
        deployment = await create_deployment(
            product, platform, version, git_sha, manifest_hash, action_ids, deployed_by
        )
        
        # Step 6.5: Update agent_guidance on product if provided
        if agent_guidance is not None:
            await update_product_agent_guidance(product_id, agent_guidance)
            logger.info(
                f"[ActionSync] Updated agent_guidance for product {product_id} "
                f"({len(agent_guidance)} chars)"
            )
        
        # Step 7 & 8: Verify and finalize (atomic)
        await finalize_job(job_id, str(deployment.id), len(actions_data))
        
        logger.info(
            f"[ActionSync] Workflow completed for job {job_id}: "
            f"{created_count} created, {updated_count} updated, {deleted_count} deleted"
        )
        
        return {
            'status': 'success',
            'job_id': job_id,
            'deployment_id': str(deployment.id),
            'created': created_count,
            'updated': updated_count,
            'deleted': deleted_count,
        }
        
    except Exception as e:
        logger.error(f"[ActionSync] Workflow failed for job {job_id}: {e}", exc_info=True)
        await update_job_failed(job_id, str(e))
        raise


@sync_to_async
def update_product_agent_guidance(product_id: str, agent_guidance: str):
    """Update product agent_guidance atomically."""
    from apps.products.models import Product
    
    with transaction.atomic():
        Product.objects.filter(id=product_id).update(agent_guidance=agent_guidance)


@sync_to_async
def update_job_status(job_id: str, status: str, **kwargs):
    """Update job status atomically."""
    from apps.products.models import ActionSyncJob
    
    with transaction.atomic():
        job = ActionSyncJob.objects.get(id=job_id)
        job.status = status
        for key, value in kwargs.items():
            setattr(job, key, value)
        update_fields = ['status'] + list(kwargs.keys())
        job.save(update_fields=update_fields)


@sync_to_async
def update_job_progress(job_id: str, **progress_updates):
    """Update job progress atomically."""
    from apps.products.models import ActionSyncJob
    
    with transaction.atomic():
        job = ActionSyncJob.objects.get(id=job_id)
        if not job.progress:
            job.progress = {}
        job.progress.update(progress_updates)
        job.save(update_fields=['progress'])


@sync_to_async
def update_job_failed(job_id: str, error_message: str):
    """Mark job as failed atomically."""
    from apps.products.models import ActionSyncJob, ActionSyncJobStatus
    
    with transaction.atomic():
        job = ActionSyncJob.objects.get(id=job_id)
        job.status = ActionSyncJobStatus.FAILED
        job.error_message = error_message
        job.completed_at = timezone.now()
        job.save(update_fields=['status', 'error_message', 'completed_at'])


@sync_to_async
def bulk_update_actions(product, actions_data: list[dict]):
    """
    Bulk create/update actions without embeddings.
    
    Returns: (action_objects, created_count, updated_count)
    """
    from apps.products.models import Action
    
    with transaction.atomic():
        existing_actions = {
            action.name: action
            for action in Action.objects.filter(
                product=product,
                organization=product.organization,
                name__in=[a['name'] for a in actions_data]
            )
        }
        
        new_actions = []
        updated_actions = []
        created_count = 0
        updated_count = 0
        
        for action_data in actions_data:
            name = action_data['name']
            if name in existing_actions:
                # Update existing
                action = existing_actions[name]
                action.description = action_data['description']
                action.examples = action_data.get('examples') or []
                action.action_type = action_data['type']
                action.path_template = action_data.get('path') or ''
                action.external_url = action_data.get('external_url') or ''
                action.auto_run = action_data.get('auto_run', False)
                action.auto_complete = action_data.get('auto_complete', False)
                action.data_schema = action_data.get('data_schema') or {}
                action.default_data = action_data.get('default_data') or {}
                action.required_context = action_data.get('required_context') or {}
                action.status = Action.Status.PUBLISHED
                # Don't update embeddings here - will be done in batch
                updated_actions.append(action)
                updated_count += 1
            else:
                # Create new
                action = Action(
                    product=product,
                    organization=product.organization,
                    name=name,
                    description=action_data['description'],
                    examples=action_data.get('examples') or [],
                    action_type=action_data['type'],
                    path_template=action_data.get('path') or '',
                    external_url=action_data.get('external_url') or '',
                    auto_run=action_data.get('auto_run', False),
                    auto_complete=action_data.get('auto_complete', False),
                    data_schema=action_data.get('data_schema') or {},
                    default_data=action_data.get('default_data') or {},
                    required_context=action_data.get('required_context') or {},
                    status=Action.Status.PUBLISHED,
                    description_embedding=None,  # Will be set later
                )
                new_actions.append(action)
                created_count += 1
        
        # Bulk create new actions
        if new_actions:
            Action.objects.bulk_create(new_actions, ignore_conflicts=True)
            # Reload to get IDs (bulk_create doesn't set IDs on objects)
            created_names = [a.name for a in new_actions]
            created_actions = list(Action.objects.filter(
                product=product,
                organization=product.organization,
                name__in=created_names
            ))
            all_actions = created_actions + updated_actions
        else:
            all_actions = updated_actions
        
        # Bulk update existing actions
        if updated_actions:
            Action.objects.bulk_update(
                updated_actions,
                fields=[
                    'description', 'examples', 'action_type', 'path_template',
                    'external_url', 'auto_run', 'auto_complete', 'data_schema',
                    'default_data', 'required_context', 'status'
                ]
            )
        
        return all_actions, created_count, updated_count


@sync_to_async
def bulk_delete_actions(product, action_names: list[str]):
    """Delete actions not in the manifest."""
    from apps.products.models import Action
    
    with transaction.atomic():
        deleted_actions = Action.objects.filter(
            product=product,
            organization=product.organization,
        ).exclude(name__in=action_names)
        
        deleted_count = deleted_actions.count()
        if deleted_count > 0:
            deleted_names = list(deleted_actions.values_list('name', flat=True))
            logger.info(
                f"[ActionSync] Deleting {deleted_count} actions not in manifest: "
                f"{deleted_names[:10]}{'...' if len(deleted_names) > 10 else ''}"
            )
            deleted_actions.delete()
        
        return deleted_count


async def generate_embeddings_batched(product, actions: list, job_id: str, batch_size: int = 20):
    """
    Generate embeddings for actions in batches.
    
    Updates job progress after each batch.
    """
    from apps.products.models import Action
    from common.services.embedding_service import get_embedding_service
    
    service = get_embedding_service()
    total_batches = (len(actions) + batch_size - 1) // batch_size
    
    for batch_idx in range(0, len(actions), batch_size):
        batch = actions[batch_idx:batch_idx + batch_size]
        batch_num = (batch_idx // batch_size) + 1
        
        logger.info(
            f"[ActionSync] Generating embeddings for batch {batch_num}/{total_batches} "
            f"({len(batch)} actions)"
        )
        
        # Generate embeddings in parallel
        embeddings = await asyncio.gather(*[
            service.embed_document_async(action.description)
            for action in batch
        ])
        
        # Update actions with embeddings (atomic per batch)
        await update_action_embeddings(batch, embeddings)
        
        # Update progress
        processed = min(batch_idx + batch_size, len(actions))
        await update_job_progress(job_id, processed=processed)


@sync_to_async
def update_action_embeddings(actions: list, embeddings: list):
    """Update actions with embeddings atomically."""
    from apps.products.models import Action
    
    with transaction.atomic():
        for action, embedding in zip(actions, embeddings):
            action.description_embedding = embedding
        
        Action.objects.bulk_update(actions, fields=['description_embedding'])


@sync_to_async
def create_deployment(product, platform: str, version: str, git_sha: str,
                     manifest_hash: str, action_ids: list[str], deployed_by: str):
    """Create ActionDeployment atomically."""
    from apps.products.models import ActionDeployment, Action
    
    with transaction.atomic():
        deployment, _ = ActionDeployment.objects.update_or_create(
            product=product,
            organization=product.organization,
            platform=platform,
            version=version,
            defaults={
                'git_sha': git_sha,
                'manifest_hash': manifest_hash,
                'deployed_by': deployed_by,
            }
        )
        
        # Link actions via ManyToMany (atomic)
        action_objects = Action.objects.filter(
            id__in=action_ids,
            product=product,
            organization=product.organization,
        )
        deployment.actions.set(action_objects)
        
        return deployment


@sync_to_async
def finalize_job(job_id: str, deployment_id: str, expected_action_count: int):
    """
    Verify completion and finalize job atomically.
    
    Only marks complete if all verification passes.
    """
    from apps.products.models import (
        ActionSyncJob, ActionSyncJobStatus, ActionDeployment, Action
    )
    
    with transaction.atomic():
        # Use select_for_update to prevent race conditions
        job = ActionSyncJob.objects.select_for_update().get(id=job_id)
        
        # Verify deployment exists
        try:
            deployment = ActionDeployment.objects.get(id=deployment_id)
        except ActionDeployment.DoesNotExist:
            raise ValueError(f"Deployment {deployment_id} not found")
        
        # Verify action count matches
        actual_count = deployment.actions.count()
        if actual_count != expected_action_count:
            raise ValueError(
                f"Action count mismatch: {actual_count} != {expected_action_count}"
            )
        
        # Verify all actions have embeddings
        deployment_action_names = list(deployment.actions.values_list('name', flat=True))
        actions_without_embeddings = Action.objects.filter(
            product=job.product,
            organization=job.organization,
            name__in=deployment_action_names,
            description_embedding__isnull=True
        ).count()
        
        if actions_without_embeddings > 0:
            raise ValueError(
                f"{actions_without_embeddings} actions missing embeddings"
            )
        
        # All checks passed - mark complete (atomic)
        job.status = ActionSyncJobStatus.COMPLETED
        job.completed_at = timezone.now()
        job.is_complete = True
        job.deployment = deployment
        job.save(update_fields=[
            'status', 'completed_at', 'is_complete', 'deployment'
        ])
        
        # Invalidate capabilities cache for this product
        # so the agent sees the updated action list
        try:
            from apps.mcp.services.prompts.capabilities import invalidate_capabilities_cache
            invalidate_capabilities_cache(str(job.product.id))
        except Exception as e:
            logger.warning(f"[ActionSync] Failed to invalidate capabilities cache: {e}")
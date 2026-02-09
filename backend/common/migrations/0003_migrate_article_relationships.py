"""
Data migration to copy ArticleRelationship records to KnowledgeGraphEdge.

This migration:
1. Copies all ArticleRelationship records to KnowledgeGraphEdge
2. Maps the relationship types appropriately
3. Preserves fact embeddings and provenance information
"""
from django.db import migrations


def migrate_article_relationships_forward(apps, schema_editor):
    """Copy ArticleRelationship records to KnowledgeGraphEdge."""
    try:
        ArticleRelationship = apps.get_model('help_center', 'ArticleRelationship')
    except LookupError:
        # ArticleRelationship model no longer exists (help_center app removed)
        print("Skipping ArticleRelationship migration - model no longer exists")
        return
    KnowledgeGraphEdge = apps.get_model('common', 'KnowledgeGraphEdge')

    # Map created_by_type to CreatedBy
    created_by_map = {
        'librarian_agent': 'librarian',
        'human': 'human',
        'import': 'import',
    }

    # Map status
    status_map = {
        'pending': 'pending',
        'active': 'active',
        'rejected': 'rejected',
        'archived': 'archived',
    }

    count = 0
    for rel in ArticleRelationship.objects.all():
        # Check if already migrated (by checking if a similar edge exists)
        existing = KnowledgeGraphEdge.objects.filter(
            organization_id=rel.organization_id,
            source_type='article',
            source_article_id=rel.source_article_id,
            target_type='article',
            target_article_id=rel.target_article_id,
            relationship=rel.relationship_description,
        ).exists()

        if existing:
            continue

        # Create KnowledgeGraphEdge
        KnowledgeGraphEdge.objects.create(
            organization_id=rel.organization_id,
            source_type='article',
            source_article_id=rel.source_article_id,
            source_chunk=None,
            target_type='article',
            target_article_id=rel.target_article_id,
            target_chunk=None,
            relationship=rel.relationship_description,
            inverse_relationship=rel.inverse_description or '',
            is_symmetric=rel.is_symmetric,
            fact_statement=rel.fact_statement,
            fact_embedding=rel.fact_embedding,
            created_by=created_by_map.get(rel.created_by_type, 'import'),
            confidence=rel.confidence,
            reasoning=rel.reasoning,
            status=status_map.get(rel.status, 'pending'),
            reviewed_by_id=rel.reviewed_by_id,
            reviewed_at=rel.reviewed_at,
            created_at=rel.created_at,
            updated_at=rel.updated_at,
        )
        count += 1

    if count > 0:
        print(f"Migrated {count} ArticleRelationship records to KnowledgeGraphEdge")


def migrate_article_relationships_reverse(apps, schema_editor):
    """
    Remove KnowledgeGraphEdge records that were migrated from ArticleRelationship.

    Note: This only removes article-to-article edges, not chunk edges.
    """
    KnowledgeGraphEdge = apps.get_model('common', 'KnowledgeGraphEdge')

    # Only delete article-to-article edges
    deleted, _ = KnowledgeGraphEdge.objects.filter(
        source_type='article',
        target_type='article',
    ).delete()

    if deleted > 0:
        print(f"Removed {deleted} KnowledgeGraphEdge records")


class Migration(migrations.Migration):

    dependencies = [
        ('common', '0002_add_knowledge_chunk_and_edge'),
        # help_center dependency removed - app is being deprecated
    ]

    operations = [
        migrations.RunPython(
            migrate_article_relationships_forward,
            migrate_article_relationships_reverse,
        ),
    ]


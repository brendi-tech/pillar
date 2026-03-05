from django.contrib import admin
from django.utils.html import format_html

from apps.knowledge.models import (
    Correction,
    KnowledgeItem,
    KnowledgeSource,
    KnowledgeSyncHistory,
)


# ---------------------------------------------------------------------------
# Knowledge Source
# ---------------------------------------------------------------------------

class KnowledgeItemInline(admin.TabularInline):
    model = KnowledgeItem
    extra = 0
    fields = ['title', 'item_type', 'status', 'is_active', 'url']
    readonly_fields = ['title', 'item_type', 'status', 'is_active', 'url']
    show_change_link = True
    max_num = 0

    def has_add_permission(self, request, obj=None):
        return False


class KnowledgeSyncHistoryInline(admin.TabularInline):
    model = KnowledgeSyncHistory
    extra = 0
    fields = [
        'sync_type', 'status', 'items_synced',
        'items_created', 'items_updated', 'items_deleted', 'items_failed',
        'started_at', 'completed_at',
    ]
    readonly_fields = fields
    max_num = 0

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(KnowledgeSource)
class KnowledgeSourceAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'source_type', 'product', 'status',
        'item_count', 'last_synced_at', 'created_at',
    ]
    list_filter = ['source_type', 'status']
    search_fields = ['name', 'url', 'product__name', 'organization__name']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_synced_at', 'item_count']
    list_select_related = ['product', 'organization']
    inlines = [KnowledgeSyncHistoryInline, KnowledgeItemInline]

    fieldsets = (
        (None, {
            'fields': ('id', 'organization', 'product', 'name', 'source_type', 'status'),
        }),
        ('Web Source', {
            'classes': ('collapse',),
            'fields': ('url', 'crawl_config'),
        }),
        ('Connection', {
            'classes': ('collapse',),
            'fields': ('connection_config',),
        }),
        ('Stats', {
            'fields': ('item_count', 'last_synced_at', 'error_message'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )


# ---------------------------------------------------------------------------
# Knowledge Item
# ---------------------------------------------------------------------------

@admin.register(KnowledgeItem)
class KnowledgeItemAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'item_type', 'source', 'status',
        'is_active', 'content_hash_short', 'created_at',
    ]
    list_filter = ['item_type', 'status', 'is_active']
    search_fields = ['title', 'url', 'raw_content', 'source__name']
    ordering = ['-created_at']
    readonly_fields = [
        'id', 'created_at', 'updated_at', 'last_indexed_at',
        'content_hash', 'search_vector', 'external_id',
    ]
    list_select_related = ['source', 'product']

    fieldsets = (
        (None, {
            'fields': ('id', 'organization', 'product', 'source', 'item_type', 'status', 'is_active'),
        }),
        ('Content', {
            'fields': ('title', 'url', 'external_id', 'excerpt'),
        }),
        ('Raw Content', {
            'classes': ('collapse',),
            'fields': ('raw_content',),
        }),
        ('Optimized Content', {
            'classes': ('collapse',),
            'fields': ('optimized_content',),
        }),
        ('Processing', {
            'fields': ('content_hash', 'last_indexed_at', 'processing_error'),
        }),
        ('Metadata', {
            'classes': ('collapse',),
            'fields': ('metadata',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Hash')
    def content_hash_short(self, obj):
        if obj.content_hash:
            return obj.content_hash[:8] + '…'
        return '—'


# ---------------------------------------------------------------------------
# Knowledge Sync History
# ---------------------------------------------------------------------------

@admin.register(KnowledgeSyncHistory)
class KnowledgeSyncHistoryAdmin(admin.ModelAdmin):
    list_display = [
        'source', 'sync_type', 'status',
        'items_synced', 'items_created', 'items_updated',
        'items_deleted', 'items_failed',
        'started_at', 'completed_at',
    ]
    list_filter = ['sync_type', 'status']
    search_fields = ['source__name', 'error_message']
    ordering = ['-created_at']
    readonly_fields = [
        'id', 'created_at', 'updated_at',
        'started_at', 'completed_at',
    ]
    list_select_related = ['source']


# ---------------------------------------------------------------------------
# Correction
# ---------------------------------------------------------------------------

@admin.register(Correction)
class CorrectionAdmin(admin.ModelAdmin):
    list_display = [
        'short_title', 'correction_type', 'status',
        'created_by', 'has_knowledge_item', 'created_at',
    ]
    list_filter = ['correction_type', 'status']
    search_fields = [
        'processed_title', 'user_correction_notes',
        'original_question', 'organization__name',
    ]
    ordering = ['-created_at']
    readonly_fields = [
        'id', 'created_at', 'updated_at',
        'source_message', 'source_conversation',
    ]
    list_select_related = ['created_by', 'knowledge_item', 'organization']

    fieldsets = (
        (None, {
            'fields': (
                'id', 'organization', 'correction_type', 'status',
                'created_by', 'knowledge_item',
            ),
        }),
        ('Source', {
            'fields': ('source_conversation', 'source_message'),
        }),
        ('Original Context', {
            'classes': ('collapse',),
            'fields': ('original_question', 'original_response'),
        }),
        ('Correction', {
            'fields': ('user_correction_notes', 'processed_title', 'processed_content'),
        }),
        ('Reasoning Context', {
            'classes': ('collapse',),
            'fields': (
                'reasoning_step_index', 'reasoning_step_type',
                'original_reasoning_step', 'full_reasoning_trace',
                'correct_reasoning', 'correct_search_query', 'correct_sources',
            ),
        }),
        ('Processing', {
            'fields': ('processing_error',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Title')
    def short_title(self, obj):
        if obj.processed_title:
            return obj.processed_title[:60]
        return f'Correction #{str(obj.id)[:8]}'

    @admin.display(description='KB Item', boolean=True)
    def has_knowledge_item(self, obj):
        return obj.knowledge_item_id is not None

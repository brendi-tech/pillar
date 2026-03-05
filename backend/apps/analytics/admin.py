from django.contrib import admin
from django.utils.html import format_html

from apps.analytics.models import (
    ChatConversation,
    ChatMessage,
    Search,
    Visitor,
    WidgetSession,
)


# ---------------------------------------------------------------------------
# Chat Message (inline + standalone)
# ---------------------------------------------------------------------------

class ChatMessageInline(admin.StackedInline):
    model = ChatMessage
    extra = 0
    fields = [
        'role', 'content', 'model_used', 'feedback',
        'feedback_comment', 'latency_ms', 'timestamp',
    ]
    readonly_fields = [
        'role', 'content', 'model_used', 'feedback',
        'feedback_comment', 'latency_ms', 'timestamp',
    ]
    ordering = ['timestamp']
    max_num = 0

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# Chat Conversation
# ---------------------------------------------------------------------------

@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = [
        'title_display', 'organization', 'product', 'status',
        'visitor_display', 'message_count', 'started_at',
    ]
    list_filter = ['status', 'logging_enabled']
    search_fields = [
        'title', 'page_url', 'organization__name',
        'product__name', 'external_session_id',
    ]
    ordering = ['-started_at']
    readonly_fields = [
        'id', 'created_at', 'updated_at', 'started_at', 'last_message_at',
        'search_vector', 'ip_address',
    ]
    list_select_related = ['organization', 'product', 'visitor']
    inlines = [ChatMessageInline]

    fieldsets = (
        (None, {
            'fields': (
                'id', 'organization', 'product', 'session',
                'visitor', 'status', 'title',
            ),
        }),
        ('Context', {
            'fields': ('page_url', 'product_context'),
        }),
        ('Escalation', {
            'classes': ('collapse',),
            'fields': ('escalation_reason', 'escalated_to'),
        }),
        ('Client Info', {
            'classes': ('collapse',),
            'fields': (
                'user_agent', 'ip_address', 'referer', 'external_session_id',
            ),
        }),
        ('Settings', {
            'fields': ('logging_enabled',),
        }),
        ('Metadata', {
            'classes': ('collapse',),
            'fields': ('metadata',),
        }),
        ('Timestamps', {
            'fields': ('started_at', 'last_message_at', 'created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Title')
    def title_display(self, obj):
        return obj.title[:60] if obj.title else f'Conv {str(obj.id)[:8]}…'

    @admin.display(description='Visitor')
    def visitor_display(self, obj):
        if not obj.visitor:
            return '—'
        if obj.visitor.external_user_id:
            return obj.visitor.external_user_id
        return f'{str(obj.visitor.visitor_id)[:8]}… (anon)'

    @admin.display(description='Msgs')
    def message_count(self, obj):
        return obj.messages.count()


# ---------------------------------------------------------------------------
# Chat Message (standalone)
# ---------------------------------------------------------------------------

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = [
        'role', 'content_preview', 'conversation_title',
        'model_used', 'feedback', 'streaming_status',
        'latency_ms', 'timestamp',
    ]
    list_filter = ['role', 'feedback', 'streaming_status', 'query_type']
    search_fields = ['content', 'conversation__title', 'model_used']
    ordering = ['-timestamp']
    readonly_fields = [
        'id', 'created_at', 'updated_at', 'timestamp',
        'streaming_started_at', 'feedback_timestamp',
        'query_hash',
    ]
    list_select_related = ['conversation', 'organization', 'product']

    fieldsets = (
        (None, {
            'fields': (
                'id', 'organization', 'product', 'conversation',
                'role', 'query_type', 'content',
            ),
        }),
        ('LLM Data', {
            'classes': ('collapse',),
            'fields': ('llm_message', 'display_trace', 'images'),
        }),
        ('Model & Performance', {
            'fields': (
                'model_used', 'latency_ms', 'streaming_status',
                'streaming_started_at', 'was_stopped', 'tokens_generated',
            ),
        }),
        ('Token Usage', {
            'classes': ('collapse',),
            'fields': (
                'prompt_tokens', 'completion_tokens',
                'total_tokens', 'peak_context_occupancy',
            ),
        }),
        ('RAG', {
            'classes': ('collapse',),
            'fields': ('chunks_retrieved',),
        }),
        ('Classification', {
            'classes': ('collapse',),
            'fields': ('query_hash', 'intent_category', 'intent_confidence'),
        }),
        ('Feedback', {
            'fields': ('feedback', 'feedback_comment', 'feedback_timestamp'),
        }),
        ('Session Resumption', {
            'classes': ('collapse',),
            'fields': ('agent_state_snapshot',),
        }),
        ('Timestamps', {
            'fields': ('timestamp', 'created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Content')
    def content_preview(self, obj):
        if len(obj.content) > 80:
            return obj.content[:80] + '…'
        return obj.content

    @admin.display(description='Conversation')
    def conversation_title(self, obj):
        if obj.conversation and obj.conversation.title:
            return obj.conversation.title[:40]
        return str(obj.conversation_id)[:8] + '…'


# ---------------------------------------------------------------------------
# Widget Session
# ---------------------------------------------------------------------------

@admin.register(WidgetSession)
class WidgetSessionAdmin(admin.ModelAdmin):
    list_display = [
        'session_id_short', 'visitor_id_short', 'organization',
        'page_count', 'chat_count', 'search_count',
        'started_at', 'last_seen_at',
    ]
    list_filter = ['organization']
    search_fields = ['session_id', 'visitor_id', 'user_id', 'first_page_url']
    ordering = ['-started_at']
    readonly_fields = [
        'id', 'created_at', 'updated_at', 'started_at', 'last_seen_at',
    ]
    list_select_related = ['organization']

    fieldsets = (
        (None, {
            'fields': (
                'id', 'organization', 'session_id', 'visitor_id',
            ),
        }),
        ('User', {
            'fields': ('user_id', 'user_profile'),
        }),
        ('Navigation', {
            'fields': ('first_page_url', 'last_page_url', 'user_agent'),
        }),
        ('Aggregates', {
            'fields': ('page_count', 'chat_count', 'search_count'),
        }),
        ('Timestamps', {
            'fields': ('started_at', 'last_seen_at', 'created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Session')
    def session_id_short(self, obj):
        return obj.session_id[:12] + '…'

    @admin.display(description='Visitor')
    def visitor_id_short(self, obj):
        return obj.visitor_id[:12] + '…'


# ---------------------------------------------------------------------------
# Visitor
# ---------------------------------------------------------------------------

@admin.register(Visitor)
class VisitorAdmin(admin.ModelAdmin):
    list_display = [
        'visitor_id_short', 'external_user_id', 'name', 'email',
        'organization', 'is_authenticated', 'first_seen_at', 'last_seen_at',
    ]
    list_filter = ['organization']
    search_fields = ['visitor_id', 'external_user_id', 'name', 'email']
    ordering = ['-last_seen_at']
    readonly_fields = [
        'id', 'created_at', 'updated_at', 'first_seen_at', 'last_seen_at',
    ]
    list_select_related = ['organization']

    fieldsets = (
        (None, {
            'fields': ('id', 'organization', 'visitor_id', 'external_user_id'),
        }),
        ('Profile', {
            'fields': ('name', 'email', 'metadata'),
        }),
        ('Timestamps', {
            'fields': ('first_seen_at', 'last_seen_at', 'created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Visitor ID')
    def visitor_id_short(self, obj):
        return obj.visitor_id[:12] + '…'

    @admin.display(description='Authenticated', boolean=True)
    def is_authenticated(self, obj):
        return obj.is_authenticated


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@admin.register(Search)
class SearchAdmin(admin.ModelAdmin):
    list_display = [
        'query', 'organization', 'results_count',
        'clicked_knowledge_item', 'session_id', 'searched_at',
    ]
    list_filter = ['organization']
    search_fields = ['query', 'session_id']
    ordering = ['-searched_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'searched_at']
    list_select_related = ['organization', 'clicked_knowledge_item']

import secrets as secrets_module

from django import forms
from django.contrib import admin, messages
from django.utils.html import format_html

from apps.products.models import (
    Action,
    ActionDeployment,
    ActionExecutionLog,
    ActionSyncJob,
    Platform,
    Product,
    SyncSecret,
)


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------

class PlatformInline(admin.TabularInline):
    model = Platform
    extra = 0
    fields = ['platform_type', 'name', 'is_active', 'scrape_cadence_hours']
    readonly_fields = ['created_at']


class SyncSecretInline(admin.TabularInline):
    model = SyncSecret
    extra = 0
    fields = ['name', 'created_by', 'last_used_at', 'created_at']
    readonly_fields = ['name', 'created_by', 'last_used_at', 'created_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class ActionInline(admin.TabularInline):
    model = Action
    extra = 0
    fields = ['name', 'action_type', 'status', 'implementation_status', 'execution_count']
    readonly_fields = ['name', 'action_type', 'status', 'implementation_status', 'execution_count']
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'subdomain', 'organization', 'is_default',
        'default_language', 'sdk_last_initialized_at', 'created_at',
    ]
    list_filter = ['is_default', 'default_language', 'auto_theme_generated']
    search_fields = ['name', 'subdomain', 'organization__name']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'sdk_last_initialized_at', 'public_url_display']
    list_select_related = ['organization']
    inlines = [PlatformInline, ActionInline, SyncSecretInline]

    fieldsets = (
        (None, {
            'fields': ('id', 'organization', 'name', 'subdomain', 'public_url_display'),
        }),
        ('Configuration', {
            'fields': ('website_url', 'default_language', 'is_default', 'show_article_owner'),
        }),
        ('AI Agent', {
            'fields': ('agent_guidance',),
        }),
        ('Theme & Config JSON', {
            'classes': ('collapse',),
            'fields': ('config', 'auto_theme_generated'),
        }),
        ('Timestamps', {
            'fields': ('sdk_last_initialized_at', 'created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Public URL')
    def public_url_display(self, obj):
        url = obj.public_url
        return format_html('<a href="{}" target="_blank">{}</a>', url, url)


# ---------------------------------------------------------------------------
# Platform
# ---------------------------------------------------------------------------

@admin.register(Platform)
class PlatformAdmin(admin.ModelAdmin):
    list_display = ['name', 'platform_type', 'product', 'is_active', 'created_at']
    list_filter = ['platform_type', 'is_active']
    search_fields = ['name', 'product__name', 'product__subdomain']
    ordering = ['product', 'platform_type']
    readonly_fields = ['id', 'created_at', 'updated_at']
    list_select_related = ['product']


# ---------------------------------------------------------------------------
# Action
# ---------------------------------------------------------------------------

@admin.register(Action)
class ActionAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'product', 'action_type', 'status',
        'implementation_status', 'execution_count', 'auto_run', 'returns_data',
    ]
    list_filter = ['status', 'action_type', 'implementation_status', 'auto_run', 'returns_data']
    search_fields = ['name', 'description', 'product__name', 'product__subdomain']
    ordering = ['-created_at']
    readonly_fields = [
        'id', 'created_at', 'updated_at',
        'description_embedding', 'example_embeddings',
        'execution_count', 'last_executed_at',
        'confirmation_success_count', 'confirmation_failure_count',
        'last_confirmed_at', 'last_confirmation_status', 'last_confirmation_error',
    ]
    list_select_related = ['product', 'organization']

    fieldsets = (
        (None, {
            'fields': ('id', 'organization', 'product', 'name', 'description', 'guidance'),
        }),
        ('Type & Configuration', {
            'fields': (
                'action_type', 'status', 'path_template', 'external_url',
                'auto_run', 'auto_complete', 'returns_data',
            ),
        }),
        ('Schemas', {
            'classes': ('collapse',),
            'fields': ('data_schema', 'output_schema', 'default_data', 'parameter_examples'),
        }),
        ('Context & Examples', {
            'classes': ('collapse',),
            'fields': ('required_context', 'examples'),
        }),
        ('Implementation Tracking', {
            'fields': (
                'implementation_status',
                'confirmation_success_count', 'confirmation_failure_count',
                'last_confirmed_at', 'last_confirmation_status', 'last_confirmation_error',
            ),
        }),
        ('Analytics', {
            'fields': ('execution_count', 'last_executed_at'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )


# ---------------------------------------------------------------------------
# Action Deployment
# ---------------------------------------------------------------------------

@admin.register(ActionDeployment)
class ActionDeploymentAdmin(admin.ModelAdmin):
    list_display = [
        'product', 'platform', 'version', 'is_active',
        'action_count_display', 'deployed_by', 'deployed_at',
    ]
    list_filter = ['platform', 'is_active']
    search_fields = ['product__name', 'product__subdomain', 'version', 'git_sha']
    ordering = ['-deployed_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'deployed_at']
    list_select_related = ['product']
    filter_horizontal = ['actions']

    @admin.display(description='Actions')
    def action_count_display(self, obj):
        return obj.action_count


# ---------------------------------------------------------------------------
# Action Sync Job
# ---------------------------------------------------------------------------

@admin.register(ActionSyncJob)
class ActionSyncJobAdmin(admin.ModelAdmin):
    list_display = [
        'product', 'platform', 'version', 'status',
        'is_complete', 'started_at', 'completed_at',
    ]
    list_filter = ['status', 'platform', 'is_complete']
    search_fields = ['product__name', 'product__subdomain', 'version', 'git_sha']
    ordering = ['-created_at']
    readonly_fields = [
        'id', 'created_at', 'updated_at',
        'started_at', 'completed_at', 'deployment',
    ]
    list_select_related = ['product']


# ---------------------------------------------------------------------------
# Action Execution Log
# ---------------------------------------------------------------------------

@admin.register(ActionExecutionLog)
class ActionExecutionLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'status', 'duration_ms', 'session_id', 'created_at']
    list_filter = ['status']
    search_fields = ['action__name', 'session_id', 'error_message']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']
    list_select_related = ['action']


# ---------------------------------------------------------------------------
# Sync Secret  — DANGEROUS SECTION
# ---------------------------------------------------------------------------

class SyncSecretCreationForm(forms.ModelForm):
    """Custom form for creating SyncSecrets that generates and reveals the raw secret."""

    class Meta:
        model = SyncSecret
        fields = ['product', 'organization', 'name', 'created_by']

    def save(self, commit=True):
        instance = super().save(commit=False)
        raw_secret = "plr_" + secrets_module.token_hex(32)
        instance.secret_hash = raw_secret
        instance._raw_secret = raw_secret
        if commit:
            instance.save()
        return instance


@admin.register(SyncSecret)
class SyncSecretAdmin(admin.ModelAdmin):
    list_display = ['name', 'product', 'created_by', 'last_used_at', 'created_at']
    list_filter = ['product__organization']
    search_fields = ['name', 'product__name', 'product__subdomain']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_used_at', 'secret_hash']
    list_select_related = ['product', 'created_by']

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            kwargs['form'] = SyncSecretCreationForm
        return super().get_form(request, obj, **kwargs)

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return (
                ('DANGER ZONE — Create Sync Secret', {
                    'description': (
                        '<div style="background:#dc2626;color:#fff;padding:12px 16px;'
                        'border-radius:6px;margin-bottom:12px;font-weight:600">'
                        'You are creating an API secret. The raw secret will be shown '
                        '<strong>exactly once</strong> after saving. Copy it immediately.'
                        '</div>'
                    ),
                    'fields': ('product', 'organization', 'name', 'created_by'),
                }),
            )
        return (
            (None, {
                'fields': ('id', 'product', 'organization', 'name', 'created_by'),
            }),
            ('Usage', {
                'fields': ('last_used_at',),
            }),
            ('Timestamps', {
                'fields': ('created_at', 'updated_at'),
            }),
        )

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def response_add(self, request, obj, post_url_continue=None):
        raw = getattr(obj, '_raw_secret', None)
        if raw:
            messages.warning(
                request,
                format_html(
                    '<strong style="font-size:1.1em">COPY THIS SECRET NOW — '
                    'it will never be shown again:</strong><br>'
                    '<code style="background:#1e1e2e;color:#a6e3a1;padding:8px 14px;'
                    'border-radius:4px;font-size:1.05em;display:inline-block;'
                    'margin-top:6px;user-select:all">{}</code>',
                    raw,
                ),
            )
        return super().response_add(request, obj, post_url_continue)

from django.contrib import admin

from apps.tools.models import ToolEndpoint, MCPToolSource


@admin.register(ToolEndpoint)
class ToolEndpointAdmin(admin.ModelAdmin):
    list_display = [
        'product', 'endpoint_url', 'is_active',
        'last_ping_success', 'last_ping_at', 'updated_at',
    ]
    list_filter = ['is_active', 'last_ping_success']
    search_fields = ['endpoint_url', 'product__name', 'product__subdomain']
    readonly_fields = [
        'id', 'created_at', 'updated_at',
        'last_call_at', 'last_ping_at', 'last_ping_success',
        'consecutive_failures', 'registered_tools',
    ]
    list_select_related = ['product']


@admin.register(MCPToolSource)
class MCPToolSourceAdmin(admin.ModelAdmin):
    list_display = [
        'product', 'name', 'url', 'is_active',
        'discovery_status', 'last_discovery_at',
    ]
    list_filter = ['is_active', 'discovery_status', 'auth_type']
    search_fields = ['name', 'url', 'product__name', 'product__subdomain']
    readonly_fields = [
        'id', 'created_at', 'updated_at',
        'discovered_tools', 'last_discovery_at', 'discovery_status',
        'discovery_error', 'last_ping_at', 'last_ping_success',
        'consecutive_failures',
    ]
    list_select_related = ['product']

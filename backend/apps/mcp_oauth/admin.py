from django.contrib import admin

from apps.mcp_oauth.models import MCPApplication, OAuthProvider

admin.site.unregister(MCPApplication)


@admin.register(MCPApplication)
class MCPApplicationAdmin(admin.ModelAdmin):
    list_display = ('name', 'product', 'client_id', 'client_type', 'authorization_grant_type')
    list_filter = ('client_type', 'authorization_grant_type')
    search_fields = ('name', 'client_id', 'product__name')
    raw_id_fields = ('product', 'user')
    readonly_fields = ('created', 'updated')


@admin.register(OAuthProvider)
class OAuthProviderAdmin(admin.ModelAdmin):
    list_display = ('product', 'provider_type', 'issuer_url', 'is_active')
    list_filter = ('provider_type', 'is_active')
    search_fields = ('product__name', 'issuer_url')
    raw_id_fields = ('product',)

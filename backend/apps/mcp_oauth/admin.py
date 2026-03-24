from django.contrib import admin

from apps.mcp_oauth.models import OAuthProvider


@admin.register(OAuthProvider)
class OAuthProviderAdmin(admin.ModelAdmin):
    list_display = ('product', 'provider_type', 'issuer_url', 'is_active')
    list_filter = ('provider_type', 'is_active')
    search_fields = ('product__name', 'issuer_url')
    raw_id_fields = ('product',)

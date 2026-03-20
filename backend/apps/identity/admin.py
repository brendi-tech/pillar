from django.contrib import admin

from apps.identity.models import IdentityMapping, LinkCode


@admin.register(IdentityMapping)
class IdentityMappingAdmin(admin.ModelAdmin):
    list_display = (
        'channel', 'channel_user_id', 'external_user_id',
        'email', 'is_active', 'linked_via', 'linked_at',
    )
    list_filter = ('channel', 'is_active', 'linked_via')
    search_fields = ('channel_user_id', 'external_user_id', 'email', 'display_name')
    readonly_fields = ('linked_at', 'revoked_at')
    raw_id_fields = ('product', 'organization')


@admin.register(LinkCode)
class LinkCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'channel', 'channel_user_id', 'is_used', 'expires_at')
    list_filter = ('channel', 'is_used')
    search_fields = ('code', 'channel_user_id', 'channel_email')
    readonly_fields = ('used_at',)
    raw_id_fields = ('product', 'organization')

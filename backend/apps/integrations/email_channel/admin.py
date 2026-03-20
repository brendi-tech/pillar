from django.contrib import admin

from .models import EmailChannelConfiguration, EmailMessageMapping


@admin.register(EmailChannelConfiguration)
class EmailChannelConfigurationAdmin(admin.ModelAdmin):
    list_display = ('inbound_address', 'product', 'from_name', 'is_active', 'provider', 'created_at')
    list_filter = ('is_active', 'provider')
    search_fields = ('inbound_address', 'from_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(EmailMessageMapping)
class EmailMessageMappingAdmin(admin.ModelAdmin):
    list_display = ('message_id', 'sender_email', 'subject', 'direction', 'created_at')
    list_filter = ('direction',)
    search_fields = ('message_id', 'sender_email', 'subject')
    readonly_fields = ('created_at', 'updated_at')

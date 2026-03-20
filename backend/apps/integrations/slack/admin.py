from django.contrib import admin

from .models import SlackConversationMapping, SlackInstallation


@admin.register(SlackInstallation)
class SlackInstallationAdmin(admin.ModelAdmin):
    list_display = ['team_name', 'team_id', 'product', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['team_name', 'team_id']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['product', 'organization']


@admin.register(SlackConversationMapping)
class SlackConversationMappingAdmin(admin.ModelAdmin):
    list_display = ['channel_id', 'thread_ts', 'installation', 'created_at']
    search_fields = ['channel_id', 'thread_ts']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['installation', 'conversation']

from django.contrib import admin

from .models import DiscordConversationMapping, DiscordInstallation


@admin.register(DiscordInstallation)
class DiscordInstallationAdmin(admin.ModelAdmin):
    list_display = ('guild_name', 'guild_id', 'product', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('guild_name', 'guild_id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(DiscordConversationMapping)
class DiscordConversationMappingAdmin(admin.ModelAdmin):
    list_display = ('guild_id', 'channel_id', 'thread_id', 'conversation', 'created_at')
    search_fields = ('guild_id', 'channel_id', 'thread_id')
    readonly_fields = ('created_at', 'updated_at')

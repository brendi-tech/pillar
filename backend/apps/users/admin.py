"""
Admin configuration for users app.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from apps.users.models import User, Organization, OrganizationMembership, OrganizationInvitation


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom admin for User model."""
    list_display = ['email', 'full_name', 'is_active', 'is_staff', 'created_at']
    list_filter = ['is_active', 'is_staff', 'is_superuser']
    search_fields = ['email', 'full_name']
    ordering = ['-created_at']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('full_name', 'avatar_url')}),
        ('Preferences', {'fields': ('timezone', 'email_notifications')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    """Admin for Organization model."""
    list_display = ['name', 'domain', 'plan', 'subscription_status', 'created_at']
    list_filter = ['plan', 'subscription_status']
    search_fields = ['name', 'domain']
    ordering = ['-created_at']


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    """Admin for OrganizationMembership model."""
    list_display = ['user', 'organization', 'role', 'created_at']
    list_filter = ['role']
    search_fields = ['user__email', 'organization__name']
    ordering = ['-created_at']


@admin.register(OrganizationInvitation)
class OrganizationInvitationAdmin(admin.ModelAdmin):
    """Admin for OrganizationInvitation model."""
    list_display = ['email', 'organization', 'role', 'status', 'expires_at', 'created_at']
    list_filter = ['status', 'role']
    search_fields = ['email', 'organization__name']
    ordering = ['-created_at']

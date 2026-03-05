from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html

from apps.users.models import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    User,
)


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------

class OrganizationMembershipInline(admin.TabularInline):
    model = OrganizationMembership
    extra = 0
    fields = ['user', 'role', 'created_at']
    readonly_fields = ['created_at']
    autocomplete_fields = ['user']


class OrganizationInvitationInline(admin.TabularInline):
    model = OrganizationInvitation
    extra = 0
    fields = ['email', 'role', 'status', 'expires_at', 'created_at']
    readonly_fields = ['created_at']


class UserMembershipInline(admin.TabularInline):
    """Show orgs a user belongs to on the User change page."""
    model = OrganizationMembership
    fk_name = 'user'
    extra = 0
    fields = ['organization', 'role', 'created_at']
    readonly_fields = ['created_at']
    autocomplete_fields = ['organization']
    verbose_name = 'Organization Membership'
    verbose_name_plural = 'Organization Memberships'


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        'email', 'full_name', 'org_list',
        'is_active', 'is_staff', 'created_at',
    ]
    list_filter = ['is_active', 'is_staff', 'is_superuser']
    search_fields = ['email', 'full_name']
    ordering = ['-created_at']
    inlines = [UserMembershipInline]

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('full_name', 'avatar_url')}),
        ('Preferences', {'fields': (
            'timezone', 'email_notifications', 'last_selected_product',
        )}),
        ('Permissions', {'fields': (
            'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions',
        )}),
        ('Important dates', {'fields': ('last_login', 'date_joined', 'welcome_email_sent_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
    )
    readonly_fields = ['welcome_email_sent_at']

    @admin.display(description='Organizations')
    def org_list(self, obj):
        orgs = obj.organizations.all()[:3]
        names = ', '.join(o.name for o in orgs)
        if obj.organizations.count() > 3:
            names += '…'
        return names or '—'


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'domain', 'plan', 'subscription_status',
        'member_count', 'product_count', 'created_at',
    ]
    list_filter = ['plan', 'subscription_status']
    search_fields = ['name', 'domain']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [OrganizationMembershipInline, OrganizationInvitationInline]

    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'domain'),
        }),
        ('Subscription', {
            'fields': ('plan', 'subscription_status', 'trial_ends_at', 'billing_email'),
        }),
        ('Onboarding', {
            'fields': ('onboarding_current_step', 'onboarding_completed_at'),
        }),
        ('Settings', {
            'classes': ('collapse',),
            'fields': ('settings',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Members')
    def member_count(self, obj):
        return obj.members.count()

    @admin.display(description='Products')
    def product_count(self, obj):
        return obj.products.count()


# ---------------------------------------------------------------------------
# Organization Membership
# ---------------------------------------------------------------------------

@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization', 'role', 'created_at']
    list_filter = ['role']
    search_fields = ['user__email', 'organization__name']
    ordering = ['-created_at']
    autocomplete_fields = ['user', 'organization']


# ---------------------------------------------------------------------------
# Organization Invitation
# ---------------------------------------------------------------------------

@admin.register(OrganizationInvitation)
class OrganizationInvitationAdmin(admin.ModelAdmin):
    list_display = ['email', 'organization', 'role', 'status', 'expires_at', 'created_at']
    list_filter = ['status', 'role']
    search_fields = ['email', 'organization__name']
    ordering = ['-created_at']

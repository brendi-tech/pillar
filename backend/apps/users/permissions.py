"""
Permissions for users and help center admin API.
"""
from rest_framework import permissions


class IsAuthenticatedAdmin(permissions.IsAuthenticated):
    """
    Permission class for admin API endpoints.

    Requires JWT authentication and at least one organization membership.
    Views are responsible for filtering to the user's organizations.
    """

    def has_permission(self, request, view):
        """Check if user is authenticated and has at least one organization."""
        if not super().has_permission(request, view):
            return False

        # User must belong to at least one organization
        return request.user.organizations.exists()


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object to edit it.
    Assumes the model instance has a `user` or `created_by` attribute.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed for any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner
        owner = getattr(obj, 'user', None) or getattr(obj, 'created_by', None)
        return owner == request.user


class IsOrganizationAdmin(permissions.BasePermission):
    """
    Permission class that checks if user is an admin of the organization.
    Requires the view to have get_organization() method or organization attribute.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Try to get organization from view
        organization = getattr(view, 'organization', None)
        if organization is None and hasattr(view, 'get_organization'):
            organization = view.get_organization()

        if organization is None:
            return False

        from apps.users.models import OrganizationMembership
        return OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
            role=OrganizationMembership.Role.ADMIN
        ).exists()

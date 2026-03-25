"""
Organization resolution utilities for multi-org contexts.

Resolves the correct organization from request body/query params,
with a validated fallback to primary_organization.
"""


def resolve_organization_from_request(request):
    """
    Resolve org from request body/query params, falling back to primary_organization.

    Validates that the user is a member of the resolved organization.
    """
    user_orgs = request.user.organizations.all()
    org_id = request.data.get('organization') or request.query_params.get('organization')
    if org_id:
        org = user_orgs.filter(id=org_id).first()
        if org:
            return org
    return request.user.primary_organization

"""
Service for matching users to organizations based on email domain during OAuth flow.

Copyright (C) 2025 Pillar Team
"""
from typing import List

from django.utils import timezone

from apps.users.models import Organization, OrganizationInvitation, OrganizationMembership, User


# Free email providers that shouldn't trigger organization matching
FREE_EMAIL_PROVIDERS = {
    # Google
    'gmail.com',
    
    # Microsoft
    'hotmail.com',
    'outlook.com',
    'live.com',
    'msn.com',
    
    # Yahoo
    'yahoo.com',
    'ymail.com',
    'rocketmail.com',
    
    # Apple
    'icloud.com',
    'me.com',
    'mac.com',
    
    # AOL
    'aol.com',
    'aim.com',
    
    # Privacy-focused
    'protonmail.com',
    'proton.me',
    'tutanota.com',
    'hushmail.com',
    
    # Other popular providers
    'mail.com',
    'zoho.com',
    'gmx.com',
    'gmx.net',
    'yandex.com',
    'yandex.ru',
    'mail.ru',
    'inbox.com',
    'fastmail.com',
    
    # German providers
    'web.de',
    't-online.de',
    'freenet.de',
    
    # Asian providers
    'qq.com',           # Chinese
    '163.com',          # Chinese (NetEase)
    '126.com',          # Chinese (NetEase)
    'yeah.net',         # Chinese (NetEase)
    'sina.com',         # Chinese
    'sina.cn',          # Chinese
    'sohu.com',         # Chinese
    'naver.com',        # Korean
    'daum.net',         # Korean
    'hanmail.net',      # Korean
    'rediffmail.com',   # Indian
    
    # Other legacy/regional
    'lycos.com',
    'juno.com',
    'excite.com',
    'att.net',
    'verizon.net',
    'bellsouth.net',
    'comcast.net',
    'sbcglobal.net',
}


def extract_domain_from_email(email: str) -> str:
    """
    Extract the domain from an email address.
    
    Args:
        email: Email address (e.g., john@company.com)
        
    Returns:
        Domain part of the email (e.g., company.com)
    """
    if '@' not in email:
        return ''
    return email.split('@')[1].lower()


def is_free_email_provider(email: str) -> bool:
    """
    Check if the email is from a free email provider.
    
    Args:
        email: Email address to check
        
    Returns:
        True if the email is from a free provider, False otherwise
    """
    domain = extract_domain_from_email(email)
    return domain in FREE_EMAIL_PROVIDERS


def get_matching_organizations(email: str) -> List[dict]:
    """
    Find organizations that match the user's email domain or have invited the user.
    
    Organizations match if:
    1. Their domain field matches the email domain (for corporate emails), OR
    2. The email has a valid pending invitation to join
    
    Args:
        email: User's email address
        
    Returns:
        List of organization dictionaries with:
        - id: Organization ID
        - name: Organization name
        - domain: Organization domain
        - member_count: Number of members
        - members: List of member details (name, email)
        - is_invited: Boolean indicating if user was invited (vs domain match)
        - invitation_token: Token for accepting invitation (only if is_invited=True)
    """
    results = []
    org_ids_added = set()  # Track which orgs we've already added
    
    # 1. Find organizations with matching domain (only for non-free email providers)
    if not is_free_email_provider(email):
        domain = extract_domain_from_email(email)
        if domain:
            # Find organizations with matching domain
            domain_matching_orgs = Organization.objects.filter(
                domain__iexact=domain
            ).prefetch_related('members')
            
            for org in domain_matching_orgs:
                # Get members for this organization
                memberships = OrganizationMembership.objects.filter(
                    organization=org
                ).select_related('user')[:10]  # Limit to first 10 members for display
                
                members = [
                    {
                        'id': str(membership.user.id),
                        'email': membership.user.email,
                        'full_name': membership.user.full_name,
                        'role': membership.role,
                    }
                    for membership in memberships
                ]
                
                results.append({
                    'id': str(org.id),
                    'name': org.name,
                    'domain': org.domain,
                    'member_count': org.members.count(),
                    'members': members,
                    'is_invited': False,
                    'invitation_token': None,
                })
                org_ids_added.add(org.id)
    
    # 2. Find organizations where user has valid pending invitations
    valid_invitations = OrganizationInvitation.objects.filter(
        email__iexact=email,
        status=OrganizationInvitation.Status.PENDING,
        expires_at__gt=timezone.now()
    ).select_related('organization').prefetch_related('organization__members')
    
    for invitation in valid_invitations:
        org = invitation.organization
        
        # Skip if we already added this org from domain matching
        if org.id in org_ids_added:
            continue
        
        # Get members for this organization
        memberships = OrganizationMembership.objects.filter(
            organization=org
        ).select_related('user')[:10]  # Limit to first 10 members for display
        
        members = [
            {
                'id': str(membership.user.id),
                'email': membership.user.email,
                'full_name': membership.user.full_name,
                'role': membership.role,
            }
            for membership in memberships
        ]
        
        results.append({
            'id': str(org.id),
            'name': org.name,
            'domain': org.domain,
            'member_count': org.members.count(),
            'members': members,
            'is_invited': True,
            'invitation_token': str(invitation.token),
        })
        org_ids_added.add(org.id)
    
    return results


def can_user_join_organization(user: User, organization_id: str) -> bool:
    """
    Check if a user can join an organization.
    
    A user can join if:
    - Their email domain matches the organization's domain
    - They're not using a free email provider
    
    Args:
        user: User instance
        organization_id: Organization ID
        
    Returns:
        True if the user can join, False otherwise
    """
    try:
        org = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        return False
    
    # Check if user's email domain is from a free provider
    user_domain = extract_domain_from_email(user.email)
    if user_domain in FREE_EMAIL_PROVIDERS:
        return False
    
    # Check if organization has a domain set
    if not org.domain:
        return False
    
    # Check if user's domain matches organization domain
    return user_domain.lower() == org.domain.lower()

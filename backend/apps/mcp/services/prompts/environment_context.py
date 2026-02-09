"""
Environment context formatting for agent prompts.

Builds structured context blocks from SDK-provided user context
(currentPage, userRole, etc.) for injection into agent prompts.
"""
from typing import Dict, List, Optional


def build_environment_context(
    sdk_context: Optional[Dict] = None,
    user_profile: Optional[Dict] = None,
    page_url: Optional[str] = None,
) -> str:
    """
    Build structured environment context block for the prompt.
    
    Combines SDK-provided context (currentPage, userRole, etc.) with
    request-level metadata (page_url from headers) and user profile.
    
    Args:
        sdk_context: Context dict from SDK with keys:
            - currentPage: URL path (e.g., "/settings/billing")
            - currentFeature: Human-readable feature name
            - userRole: User's role (e.g., "admin", "member")
            - userState: User's state (e.g., "onboarding", "trial", "active")
            - errorState: Dict with 'code' and 'message'
            - recentActions: List of recent action names
            - custom: Dict of custom context fields
        user_profile: UserProfile dict from SDK with keys:
            - userId, name, role, accountType, experienceLevel
        page_url: Current page URL from X-Page-Url header (fallback)
    
    Returns:
        Formatted context block, or empty string if no context.
    """
    if not any([sdk_context, user_profile, page_url]):
        return ""
    
    parts = ["<<user_environment>>"]
    
    # Page context from SDK
    if sdk_context:
        if sdk_context.get('currentPage'):
            parts.append(f"<current_page>{sdk_context['currentPage']}</current_page>")
        if sdk_context.get('currentFeature'):
            parts.append(f"<current_feature>{sdk_context['currentFeature']}</current_feature>")
        if sdk_context.get('userState'):
            parts.append(f"<user_state>{sdk_context['userState']}</user_state>")
        if sdk_context.get('errorState'):
            error = sdk_context['errorState']
            code = error.get('code', '')
            message = error.get('message', '')
            if code or message:
                parts.append(f"<error_state code=\"{code}\">{message}</error_state>")
        
        # Recent actions (helps model understand what user has been doing)
        recent_actions = sdk_context.get('recentActions', [])
        if recent_actions and len(recent_actions) > 0:
            # Last 5 actions, most recent last
            actions_str = ", ".join(recent_actions[-5:])
            parts.append(f"<recent_actions>{actions_str}</recent_actions>")
        
        # Custom fields (limit to prevent prompt bloat)
        custom = sdk_context.get('custom', {})
        if custom and isinstance(custom, dict):
            for key, value in list(custom.items())[:5]:  # Max 5 custom fields
                # Sanitize key for XML-like tag
                safe_key = str(key).replace(' ', '_').replace('-', '_')
                parts.append(f"<custom_{safe_key}>{value}</custom_{safe_key}>")
    
    # Full page URL as fallback/supplement
    if page_url and (not sdk_context or not sdk_context.get('currentPage')):
        parts.append(f"<page_url>{page_url}</page_url>")
    
    # User profile context
    if user_profile:
        if user_profile.get('name'):
            parts.append(f"<user_name>{user_profile['name']}</user_name>")
        if user_profile.get('role'):
            parts.append(f"<user_role>{user_profile['role']}</user_role>")
        elif user_profile.get('userRole'):
            # Alternative key name
            parts.append(f"<user_role>{user_profile['userRole']}</user_role>")
        if user_profile.get('accountType'):
            parts.append(f"<account_type>{user_profile['accountType']}</account_type>")
        if user_profile.get('experienceLevel'):
            parts.append(f"<experience_level>{user_profile['experienceLevel']}</experience_level>")
    elif sdk_context and sdk_context.get('userRole'):
        # Fallback to userRole from context if no profile
        parts.append(f"<user_role>{sdk_context['userRole']}</user_role>")
    
    parts.append("<</user_environment>>")
    
    # Only return if we have actual content (more than just wrapper tags)
    if len(parts) <= 2:
        return ""
    
    return "\n".join(parts) + "\n"

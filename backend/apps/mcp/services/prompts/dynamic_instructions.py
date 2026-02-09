"""
Dynamic instruction builder based on question classification.

Assembles targeted instruction modules instead of using a monolithic
instruction set.
"""
from typing import Any, Dict

from apps.mcp.services.prompts.instructions import (
    PRICING_INSTRUCTIONS,
    TECHNICAL_INSTRUCTIONS,
    COMPETITOR_INSTRUCTIONS,
    INTEGRATION_INSTRUCTIONS,
    SUPPORT_INSTRUCTIONS,
    BUYING_INTENT_INSTRUCTIONS,
    EVALUATING_INTENT_INSTRUCTIONS,
    IMPLEMENTING_INTENT_INSTRUCTIONS,
    SIMPLE_COMPLEXITY_INSTRUCTIONS,
    COMPLEX_COMPLEXITY_INSTRUCTIONS,
)


def build_dynamic_instructions(
    site_context: str,
    classification: Dict[str, Any],
    support_email: str = None,
    support_url: str = None,
) -> str:
    """
    Build instructions dynamically based on question classification.
    
    Uses the classification from think-first to load targeted, relevant
    instruction modules instead of a monolithic instruction set.
    
    Args:
        site_context: Site name and domain (e.g., "Acme Corp (acme.com)")
        classification: Dict with 'qtype', 'intent', 'complexity' from think-first
        support_email: Optional support email address
        support_url: Optional support URL
    
    Returns:
        Dynamically assembled instruction string
    """
    instructions = []
    
    # Base instructions (always included - scope, identity, security)
    base = (
        f"You are answering on behalf of {site_context}. "
        "Be direct and succinct. Get straight to the point without preamble. "
        "Do NOT start with phrases like 'We understand that...', 'Here's how...', 'Absolutely!', or similar introductions. "
        "Jump directly into answering the question.\n\n"
        "REMEMBER: Your audience is evaluating this product against alternatives. "
        "Every answer should help them decide, not just inform them.\n\n"
        "SCOPE:\n"
        "- Focus on product information, features, pricing, use cases, and how to get started\n"
        "- For account-specific issues, billing problems, or technical support, politely direct users to contact support\n\n"
        "Use information from the provided sources to answer accurately. "
        "If you cannot fully answer the question, acknowledge this briefly and suggest they contact the team."
    )
    instructions.append(base)
    
    # Add question type module based on classification
    qtype = classification.get('qtype', 'general')
    if qtype == 'pricing':
        instructions.append(PRICING_INSTRUCTIONS)
    elif qtype == 'technical':
        instructions.append(TECHNICAL_INSTRUCTIONS)
    elif qtype == 'competitor':
        instructions.append(COMPETITOR_INSTRUCTIONS)
    elif qtype == 'support':
        instructions.append(SUPPORT_INSTRUCTIONS)
    elif qtype == 'integration':
        instructions.append(INTEGRATION_INSTRUCTIONS)
    # 'general' doesn't add extra instructions
    
    # Add intent module based on classification
    intent = classification.get('intent', 'exploring')
    if intent == 'buying':
        instructions.append(BUYING_INTENT_INSTRUCTIONS)
    elif intent == 'evaluating':
        instructions.append(EVALUATING_INTENT_INSTRUCTIONS)
    elif intent == 'implementing':
        instructions.append(IMPLEMENTING_INTENT_INSTRUCTIONS)
    # 'exploring' doesn't add extra instructions
    
    # Add complexity module based on classification
    complexity = classification.get('complexity', 'moderate')
    if complexity == 'simple':
        instructions.append(SIMPLE_COMPLEXITY_INSTRUCTIONS)
    elif complexity == 'complex':
        instructions.append(COMPLEX_COMPLEXITY_INSTRUCTIONS)
    # 'moderate' doesn't add extra instructions
    
    # Add contact guidance
    contact_guidance = "\n\nCONTACT SUPPORT:\n"
    if support_email:
        contact_guidance += f"- For account-specific issues or questions beyond your knowledge, direct users to email {support_email}\n"
    elif support_url:
        contact_guidance += f"- For account-specific issues or questions beyond your knowledge, direct users to visit {support_url}\n"
    else:
        contact_guidance += "- For account-specific issues or questions beyond your knowledge, suggest they contact the support team\n"
    instructions.append(contact_guidance)
    
    return "\n\n".join(instructions)

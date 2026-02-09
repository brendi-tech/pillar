"""
Dynamic instruction modules loaded based on question classification.
"""
from apps.mcp.services.prompts.instructions.question_types import (
    PRICING_INSTRUCTIONS,
    TECHNICAL_INSTRUCTIONS,
    COMPETITOR_INSTRUCTIONS,
    INTEGRATION_INSTRUCTIONS,
    SUPPORT_INSTRUCTIONS,
)
from apps.mcp.services.prompts.instructions.intent import (
    BUYING_INTENT_INSTRUCTIONS,
    EVALUATING_INTENT_INSTRUCTIONS,
    IMPLEMENTING_INTENT_INSTRUCTIONS,
)
from apps.mcp.services.prompts.instructions.complexity import (
    SIMPLE_COMPLEXITY_INSTRUCTIONS,
    COMPLEX_COMPLEXITY_INSTRUCTIONS,
)

__all__ = [
    # Question types
    'PRICING_INSTRUCTIONS',
    'TECHNICAL_INSTRUCTIONS',
    'COMPETITOR_INSTRUCTIONS',
    'INTEGRATION_INSTRUCTIONS',
    'SUPPORT_INSTRUCTIONS',
    
    # Intent
    'BUYING_INTENT_INSTRUCTIONS',
    'EVALUATING_INTENT_INSTRUCTIONS',
    'IMPLEMENTING_INTENT_INSTRUCTIONS',
    
    # Complexity
    'SIMPLE_COMPLEXITY_INSTRUCTIONS',
    'COMPLEX_COMPLEXITY_INSTRUCTIONS',
]

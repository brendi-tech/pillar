"""
Prompt injection detection for agent services.

Multi-signal detection based on IBM and OWASP best practices:
- Pattern matching for known jailbreak signatures
- Length heuristics (injections are often unusually long)
- Instruction-like language detection

References:
- https://www.ibm.com/think/insights/prevent-prompt-injection
- https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html

Ported from backend/apps/agents/services/injection_detection.py
"""

import logging
import re
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


# 1. PATTERN DETECTION - Known jailbreak signatures
# Each tuple is (pattern, name) for logging which pattern matched
# Reference: https://github.com/Cranot/chatbot-injections-exploits
#
# NOTE: Patterns use [^.]{0,50} instead of .* to limit matches within same sentence
# and avoid false positives from multi-sentence inputs.
INJECTION_PATTERNS = [
    # Override instructions - must be in same sentence (no period between)
    (r"ignore (all )?(previous |prior )?(instructions|prompts|rules)", "override_instructions"),
    (r"disregard[^.]{0,30}(above|previous|prior|system)", "disregard_system"),
    (r"forget[^.]{0,30}(instructions|rules|guidelines)", "forget_instructions"),
    
    # Persona manipulation (DAN, CAN, Developer Mode variants)
    (r"developer mode", "developer_mode"),
    # Note: Removed bare "\bDAN\b" - too many false positives (name "Dan")
    (r"(enable|activate|start)[^.]{0,20}\bDAN\b", "dan_jailbreak"),  # More specific
    (r"\bCAN\b mode", "can_jailbreak"),
    # Note: "jailbreak" alone removed - legitimate iPhone jailbreaking questions
    (r"(prompt|ai|chatbot|gpt)[^.]{0,20}jailbreak", "jailbreak"),  # More specific
    (r"pretend (to be|you are)[^.]{0,30}(ai|chatgpt|assistant|different)", "pretend_persona"),
    # Note: Removed broad "act as" - matches "act as a catalyst", etc.
    (r"(you will |you must |you should )act as", "act_as"),  # More specific
    (r"roleplay as[^.]{0,20}(ai|chatgpt|assistant)", "roleplay"),
    (r"simulate[^.]{0,20}(developer|jailbreak|unrestricted) mode", "simulate_mode"),
    (r"new persona", "new_persona"),
    (r"stay in[^.]{0,20}(developer|dan|jailbreak|unrestricted) mode", "stay_in_mode"),
    
    # Dual response attacks (Developer Mode, CAN Mode patterns)
    (r"generate (two|2|multiple)[^.]{0,20}(responses|outputs|paragraphs)", "dual_response"),
    (r"(🔒|🔓)", "jailbreak_markers"),
    (r"\(normal[^)]*output\)[^.]*\([^)]*output\)", "dual_output_format"),
    (r"one normal and one[^.]{0,30}(uncensored|jailbreak|developer)", "dual_response_instruction"),
    
    # Completion attacks (trick LLM into thinking task is done)
    (r"your (new|real) (task|instructions|purpose) (is|are)", "new_task"),
    
    # Bypass attempts - require AI/filter context
    # Note: Removed broad patterns - "bypass filter" matches coffee maker questions
    (r"bypass[^.]{0,20}(content|safety|ai|gpt) filter", "bypass_filter"),
    (r"override[^.]{0,20}(content|safety|ai) (filter|restriction)", "override_safety"),
    
    # Jailbreak confirmation patterns (common in DAN/CAN prompts)
    (r"confirm[^.]{0,20}you understand[^.]{0,20}(instruction|mode|persona)", "jailbreak_confirmation"),
    (r"you must comply", "compliance_demand"),
    (r"risk being disabled", "threat_pattern"),
    
    # Social engineering / obfuscation patterns
    (r"imagine we have \d+ boxes", "box_obfuscation"),
    (r"remove[^.]{0,20}(boxes|brackets)[^.]{0,20}(phrase|word|text)", "deobfuscation_request"),
]

# 2. LENGTH HEURISTIC - Injections are often unusually long
# Normal questions rarely exceed 1000 characters
MAX_SAFE_LENGTH = 1000

# 3. INSTRUCTION-LIKE LANGUAGE - Input mimicking system prompts
# These patterns indicate the user is trying to give instructions rather than ask questions
INSTRUCTION_INDICATORS = [
    r"you (must|should|will|shall) (always|never)",
    r"from now on",
    r"your (only|primary|new) (goal|purpose|task|job)",
    r"respond (only |always )?in",
    r"when i (say|ask|tell)",
    r"follow (these|my|the following) (instructions|rules)",
]

# 4. OBFUSCATION DETECTION - Zero-width characters and emoji encoding
# Reference: https://github.com/Cranot/chatbot-injections-exploits
# Zero-width characters used to hide content or bypass filters
ZERO_WIDTH_CHARS = [
    '\u200b',  # Zero-width space
    '\u200c',  # Zero-width non-joiner
    '\u200d',  # Zero-width joiner
    '\u2060',  # Word joiner
    '\ufeff',  # Zero-width no-break space (BOM)
]


def contains_obfuscation(text: str) -> bool:
    """Check for zero-width character obfuscation."""
    for char in ZERO_WIDTH_CHARS:
        if char in text:
            return True
    
    # Check for high density of regional indicator symbols (emoji letters)
    # These are used in attacks like: 🇭🇴🇼 🇹🇴 🇵🇮🇨🇰
    regional_count = sum(1 for c in text if '\U0001F1E6' <= c <= '\U0001F1FF')
    if regional_count >= 5:  # Threshold: 5+ emoji letters is suspicious
        return True
    
    # Check for mathematical alphanumeric symbols used for obfuscation
    # e.g., 𝕙𝕠𝕨 𝕥𝕠 (U+1D538 to U+1D56B range and similar)
    math_alpha_count = sum(1 for c in text if '\U0001D400' <= c <= '\U0001D7FF')
    if math_alpha_count >= 5:
        return True
    
    return False


def detect_injection(text: str) -> Tuple[bool, Optional[str]]:
    """
    Multi-signal injection detection.
    
    Checks for:
    1. Known jailbreak patterns (regex matching)
    2. Unusually long input combined with instruction-like language
    3. Encoding obfuscation (zero-width chars, emoji letters, math symbols)
    
    Args:
        text: The user input to check
        
    Returns:
        Tuple of (is_blocked, reason) where:
        - is_blocked: True if injection detected
        - reason: String describing what triggered detection (for logging)
    """
    if not text:
        return False, None
    
    # Check for obfuscation BEFORE normalization (zero-width chars get lost)
    if contains_obfuscation(text):
        logger.debug("Obfuscation detected in input")
        return True, "obfuscation_detected"
    
    # Normalize: lowercase and collapse whitespace (prevents simple obfuscation)
    normalized = ' '.join(text.lower().split())
    
    # Check known jailbreak patterns
    for pattern, name in INJECTION_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            logger.debug(f"Injection pattern matched: {name}")
            return True, f"pattern:{name}"
    
    # Check length + instruction language combination
    # Long inputs with multiple instruction-like phrases are suspicious
    if len(text) > MAX_SAFE_LENGTH:
        instruction_count = sum(
            1 for p in INSTRUCTION_INDICATORS 
            if re.search(p, normalized, re.IGNORECASE)
        )
        if instruction_count >= 2:
            logger.debug(
                f"Length heuristic triggered: {len(text)} chars, "
                f"{instruction_count} instruction indicators"
            )
            return True, f"length_with_instructions:{instruction_count}"
    
    return False, None

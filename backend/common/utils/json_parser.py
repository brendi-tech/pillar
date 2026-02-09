"""
LLM Response Parsing Utilities

This module provides robust parsing functions for handling LLM responses,
particularly for extracting structured data like JSON from potentially
malformed or inconsistently formatted responses.
"""

import json
import re
import logging
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


def clean_llm_response(response_text: str) -> str:
    """
    Clean common LLM response artifacts that can interfere with JSON parsing.
    
    Args:
        response_text: Raw LLM response text
        
    Returns:
        Cleaned response text
    """
    if not response_text:
        return response_text
    
    text = response_text.strip()
    
    # Remove markdown code block markers
    if text.startswith('```json'):
        text = text[7:].strip()
    elif text.startswith('```'):
        text = text[3:].strip()
    
    if text.endswith('```'):
        text = text[:-3].strip()
    
    # Remove common LLM response prefixes
    prefixes_to_remove = [
        "Here is the JSON:",
        "Here's the JSON:",
        "The JSON is:",
        "JSON:",
        "Response:",
        "Result:",
        "Output:",
    ]
    
    for prefix in prefixes_to_remove:
        if text.lower().startswith(prefix.lower()):
            text = text[len(prefix):].strip()
            break
    
    # Remove trailing explanations after JSON
    # Look for patterns like "This JSON..." or "The above..." after a complete JSON structure
    if ']' in text:
        # Find the last complete JSON array
        last_bracket = text.rfind(']')
        if last_bracket != -1:
            after_json = text[last_bracket + 1:].strip()
            if after_json and (
                after_json.lower().startswith(('this ', 'the ', 'note:', 'explanation:')) or
                ('.' in after_json[:50] and len(after_json) > 10)  # Likely sentence after JSON
            ):
                text = text[:last_bracket + 1].strip()
    
    if '}' in text:
        # Find the last complete JSON object
        last_brace = text.rfind('}')
        if last_brace != -1:
            after_json = text[last_brace + 1:].strip()
            if after_json and (
                after_json.lower().startswith(('this ', 'the ', 'note:', 'explanation:')) or
                ('.' in after_json[:50] and len(after_json) > 10)  # Likely sentence after JSON
            ):
                text = text[:last_brace + 1].strip()
    
    return text


def _extract_json_unsafe(response_text: str, expected_type: Optional[str] = None) -> Union[List, Dict, Any]:
    """
    Extract and parse JSON from LLM responses using multiple strategies.
    
    This function tries multiple strategies to extract valid JSON from LLM responses:
    1. Direct JSON parsing (with and without cleaning)
    2. Python-style list/dict conversion (single quotes to double quotes)
    3. Extract from markdown code fences
    4. Bracket/brace matching to find complete structures
    5. Pattern matching with flexible regex
    
    Args:
        response_text: Raw text response from LLM
        expected_type: Optional hint about expected type ("array", "object", or None for auto-detect)
        
    Returns:
        Any valid JSON type (list, dict, str, int, float, bool, None), or appropriate default if parsing fails
    """
    if not response_text:
        return [] if expected_type == "array" else {}

    # Strategy 1: Try direct parsing on original and cleaned text
    for text in [response_text.strip(), clean_llm_response(response_text)]:
        try:
            parsed = json.loads(text)
            
            # Check if parsed result matches expected type
            if expected_type == "array" and isinstance(parsed, list):
                return parsed
            elif expected_type == "object" and isinstance(parsed, dict):
                return parsed
            elif expected_type is None:
                return parsed
        except json.JSONDecodeError:
            continue
    
    # Strategy 2: Try converting Python-style lists/dicts to JSON
    # Handle cases like "['item1', 'item2']" or "{'key': 'value'}"
    for text in [response_text.strip(), clean_llm_response(response_text)]:
        try:
            # Only convert if it looks like a Python list/dict (starts with [ or {)
            if text.startswith('[') or text.startswith('{'):
                # Replace single quotes with double quotes, but be careful with apostrophes
                # This is a simple heuristic that works for most LLM outputs
                json_text = text.replace("'", '"')
                parsed = json.loads(json_text)
                
                # Check if parsed result matches expected type
                if expected_type == "array" and isinstance(parsed, list):
                    logger.debug("Converted Python-style list to JSON")
                    return parsed
                elif expected_type == "object" and isinstance(parsed, dict):
                    logger.debug("Converted Python-style dict to JSON")
                    return parsed
                elif expected_type is None:
                    logger.debug("Converted Python-style structure to JSON")
                    return parsed
        except json.JSONDecodeError:
            continue
    
    # Strategy 3: Extract from markdown code fences
    # Handles both ```json { ... } ``` and ``` [ ... ] ```
    code_fence_patterns = [
        (r'```(?:json)?\s*(\{.*?\})\s*```', 'object'),
        (r'```(?:json)?\s*(\[.*?\])\s*```', 'array'),
    ]
    
    for pattern, struct_type in code_fence_patterns:
        if expected_type and expected_type != struct_type:
            continue
            
        match = re.search(pattern, response_text, re.DOTALL)
        if match:
            try:
                json_str = match.group(1)
                parsed = json.loads(json_str)
                logger.debug(f"Extracted {struct_type} from markdown code fence")
                return parsed
            except json.JSONDecodeError:
                continue
    
    # Strategy 4: Bracket/brace matching to find complete structures
    structures_to_try = []
    
    if expected_type in [None, "array"]:
        structures_to_try.append(('[', ']'))
    if expected_type in [None, "object"]:
        structures_to_try.append(('{', '}'))
    
    for open_char, close_char in structures_to_try:
        start_idx = response_text.find(open_char)
        if start_idx == -1:
            continue
        
        # Count brackets/braces to find the matching closing character
        char_count = 0
        end_idx = -1
        
        for i in range(start_idx, len(response_text)):
            char = response_text[i]
            if char == open_char:
                char_count += 1
            elif char == close_char:
                char_count -= 1
                if char_count == 0:
                    end_idx = i
                    break
        
        if end_idx != -1:  # Found matching characters
            try:
                json_str = response_text[start_idx:end_idx + 1]
                parsed = json.loads(json_str)
                logger.debug(f"Extracted JSON using bracket matching")
                return parsed
            except json.JSONDecodeError:
                continue
    
    # Strategy 5: Use regex to extract JSON-like structures
    json_patterns = [
        (r'\[[\s\S]*?\]', 'array'),
        (r'\{[\s\S]*?\}', 'object'),
    ]
    
    for pattern, struct_type in json_patterns:
        if expected_type and expected_type != struct_type:
            continue
            
        matches = re.findall(pattern, response_text, re.MULTILINE | re.DOTALL)
        for match in matches:
            try:
                parsed = json.loads(match)
                logger.debug(f"Extracted {struct_type} using regex pattern")
                return parsed
            except json.JSONDecodeError:
                continue
    
    # All strategies failed
    logger.warning(
        f"Could not extract valid JSON from LLM response. "
        f"Response length: {len(response_text)}, "
        f"Expected type: {expected_type}, "
        f"Preview: {response_text[:200]!r}"
    )
    
    # Return appropriate default based on expected type
    return [] if expected_type == "array" else {}


def sanitize_for_postgres(data: Union[str, Dict[str, Any], List[Any], Any]) -> Union[str, Dict[str, Any], List[Any], Any]:
    """
    Sanitize text data to remove NUL bytes and other characters that PostgreSQL cannot handle.
    
    This function recursively processes strings, dictionaries, and lists to ensure all text
    content is safe for PostgreSQL storage. It removes NUL bytes (0x00) and control
    characters that can cause database errors.
    
    Args:
        data: Input data that may contain problematic characters (str, dict, list, or any type)
        
    Returns:
        Sanitized data safe for PostgreSQL storage, maintaining the same structure
        
    Examples:
        >>> sanitize_for_postgres("Hello\x00World")
        "HelloWorld"
        
        >>> sanitize_for_postgres({"title": "Test\x00", "items": ["Item\x001", "Item2"]})
        {"title": "Test", "items": ["Item1", "Item2"]}
    """
    if isinstance(data, str):
        # Remove NUL bytes (0x00) which PostgreSQL cannot store in text fields
        sanitized = data.replace('\x00', '')
        sanitized = sanitized.replace('\u0000', '')
        
        # Remove other problematic control characters (keep common whitespace like \n, \r, \t)
        sanitized = ''.join(char for char in sanitized if ord(char) >= 32 or char in '\n\r\t')
        
        # Ensure valid UTF-8 encoding
        try:
            sanitized = sanitized.encode('utf-8', errors='ignore').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            sanitized = str(data).encode('ascii', errors='ignore').decode('ascii')
        
        return sanitized
    
    elif isinstance(data, dict):
        # Recursively sanitize dictionary keys and values
        sanitized_dict = {}
        for key, value in data.items():
            sanitized_key = sanitize_for_postgres(key) if isinstance(key, str) else key
            sanitized_dict[sanitized_key] = sanitize_for_postgres(value)
        return sanitized_dict
    
    elif isinstance(data, list):
        # Recursively sanitize list items
        return [sanitize_for_postgres(item) for item in data]
    
    else:
        # Return non-string types as-is (int, float, bool, None, etc.)
        return data


def parse_json_from_llm(
    response_text: str,
    expected_type: Optional[str] = None,
    sanitize: bool = True
) -> Union[List, Dict, Any]:
    """
    Safe wrapper for JSON parsing from LLM responses.
    
    This function parses JSON from LLM responses and optionally sanitizes all text content
    to remove NUL bytes and other characters that PostgreSQL cannot handle.
    
    Args:
        response_text: Raw text response from LLM
        expected_type: Optional hint about expected type ("array", "object", or None for auto-detect)
        sanitize: Whether to sanitize the result for PostgreSQL (default: True)
        
    Returns:
        Parsed and optionally sanitized JSON data, or appropriate default if parsing fails
        
    Examples:
        >>> parse_json_from_llm('```json\n{"key": "value"}\n```')
        {"key": "value"}
        
        >>> parse_json_from_llm('[1, 2, 3]', expected_type="array")
        [1, 2, 3]
        
        >>> parse_json_from_llm('Invalid JSON', expected_type="array")
        []
    """
    # Parse using the unsafe extraction function
    result = _extract_json_unsafe(response_text, expected_type)
    
    # Optionally sanitize all parsed data for PostgreSQL safety
    if sanitize:
        result = sanitize_for_postgres(result)
    
    return result


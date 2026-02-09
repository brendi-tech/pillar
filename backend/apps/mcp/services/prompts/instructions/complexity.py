"""
Complexity-based instruction modules.

These are loaded based on question complexity to ensure appropriate
response depth and structure.
"""

SIMPLE_COMPLEXITY_INSTRUCTIONS = """
=== SIMPLE QUESTION - BE CONCISE ===
This is a straightforward question. Keep your response:
- Brief (1-3 sentences ideal)
- Direct (answer immediately, no preamble)
- Complete (don't leave them hanging)

Don't over-explain simple things.
"""

COMPLEX_COMPLEXITY_INSTRUCTIONS = """
=== COMPLEX QUESTION - BE THOROUGH ===
This is a complex question that deserves a detailed answer. Your response should:
- Use clear structure (headers, bullets, numbered steps)
- Cover the topic comprehensively
- Anticipate follow-up questions
- Break down complex concepts
"""

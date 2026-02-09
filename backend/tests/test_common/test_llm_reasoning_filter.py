"""
Tests for LLM reasoning_detail filtering logic.

Verifies that sensitive reasoning blocks with cryptographic signatures
(thinking, reasoning.text) are filtered out while opaque blocks
(reasoning.encrypted) are kept for API replay.

See: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
"""
import pytest


class TestReasoningDetailFiltering:
    """Tests for filtering reasoning_details before API replay.
    
    Background:
    - Claude's extended thinking produces reasoning_details with types:
      - `thinking`: Contains text fragments + cryptographic signature
      - `reasoning.text`: Same as thinking - text + signature  
      - `reasoning.encrypted`: Opaque block meant to be passed through
    
    - Signatures are cryptographically tied to exact byte content
    - JSON serialization/deserialization breaks byte-exact fidelity
    - Replaying blocks with signatures causes "Invalid signature" API errors
    
    Fix: Filter out `thinking` and `reasoning.text` blocks, only keep
         `reasoning.encrypted` and other opaque blocks.
    """

    def test_thinking_blocks_are_filtered(self):
        """thinking blocks should NOT be kept for replay."""
        reasoning_detail = {
            'type': 'thinking',
            'text': 'Let me think about this...',
            'signature': 'abc123cryptosig...',
        }
        
        assert self._should_filter_for_replay(reasoning_detail) is True

    def test_reasoning_text_blocks_are_filtered(self):
        """reasoning.text blocks should NOT be kept for replay.
        
        This was the root cause of 'Invalid signature in thinking block' errors.
        reasoning.text has the same signature validation as thinking blocks.
        """
        reasoning_detail = {
            'type': 'reasoning.text',
            'text': 'The user wants to create a pie chart...',
            'signature': 'xyz789cryptosig...',
        }
        
        assert self._should_filter_for_replay(reasoning_detail) is True

    def test_reasoning_text_without_signature_still_filtered(self):
        """reasoning.text blocks are filtered even without signature.
        
        Partial streaming may produce reasoning.text without signature yet.
        These should still be filtered to prevent inconsistency.
        """
        reasoning_detail = {
            'type': 'reasoning.text',
            'text': 'Partial text fragment...',
        }
        
        assert self._should_filter_for_replay(reasoning_detail) is True

    def test_reasoning_encrypted_blocks_are_kept(self):
        """reasoning.encrypted blocks SHOULD be kept for API replay.
        
        These are opaque blocks meant to be passed through unchanged
        for API continuity across multi-turn conversations.
        """
        reasoning_detail = {
            'type': 'reasoning.encrypted',
            'data': 'base64encodedopaquedata...',
        }
        
        assert self._should_filter_for_replay(reasoning_detail) is False

    def test_other_opaque_blocks_are_kept(self):
        """Other reasoning block types should be kept for replay."""
        reasoning_detail = {
            'type': 'reasoning.summary',
            'content': 'Summary of reasoning...',
        }
        
        assert self._should_filter_for_replay(reasoning_detail) is False

    def test_empty_type_is_ignored(self):
        """Blocks with empty type should be ignored (filtered)."""
        reasoning_detail = {
            'type': '',
            'text': 'some text',
        }
        
        # Empty types don't match any filter condition but also
        # shouldn't be kept since they have no valid type
        assert self._should_filter_for_replay(reasoning_detail) is True

    def test_mixed_reasoning_details_filtering(self):
        """Test filtering a realistic mix of reasoning_details."""
        reasoning_details = [
            {'type': 'reasoning.text', 'text': 'First thought', 'signature': ''},
            {'type': 'reasoning.text', 'text': 'Second thought', 'signature': ''},
            {'type': 'reasoning.text', 'text': 'Final thought', 'signature': 'sig123'},
            {'type': 'reasoning.encrypted', 'data': 'opaque1'},
            {'type': 'thinking', 'text': 'Thinking...', 'signature': 'sig456'},
        ]
        
        kept = [rd for rd in reasoning_details if not self._should_filter_for_replay(rd)]
        
        # Only reasoning.encrypted should be kept
        assert len(kept) == 1
        assert kept[0]['type'] == 'reasoning.encrypted'

    def _should_filter_for_replay(self, reasoning_detail: dict) -> bool:
        """Replicate the filtering logic from llm_client.py.
        
        Returns True if the block should be FILTERED (not kept).
        Returns False if the block should be KEPT for replay.
        """
        detail_type = reasoning_detail.get('type', '')
        
        # These types have signatures that fail validation when replayed
        if detail_type == 'thinking' or detail_type == 'reasoning.text':
            return True
        
        # Empty types should not be kept
        if not detail_type:
            return True
        
        # Other types (reasoning.encrypted, etc.) should be kept
        return False


class TestReasoningDetailIntegration:
    """Integration-style tests for reasoning_detail handling."""

    def test_simulated_multi_turn_conversation(self):
        """Simulate a multi-turn conversation to verify no signature errors.
        
        This test simulates the flow:
        1. First LLM call returns reasoning_details
        2. Filter the details (remove thinking/reasoning.text)
        3. Second LLM call receives only safe details
        """
        # Simulate first turn response from Claude
        first_turn_reasoning = [
            {'type': 'reasoning.text', 'text': 'The user asks...', 'signature': '', 'format': 'anthropic-claude-v1', 'index': 0},
            {'type': 'reasoning.text', 'text': 'about pie charts...', 'signature': '', 'format': 'anthropic-claude-v1', 'index': 0},
            {'type': 'reasoning.text', 'text': 'Let me search.', 'signature': 'cryptosig412chars', 'format': 'anthropic-claude-v1', 'index': 0},
            {'type': 'reasoning.encrypted', 'data': 'base64opaque', 'format': 'anthropic-claude-v1'},
        ]
        
        # Apply filtering (as llm_client.py does)
        def filter_for_replay(details):
            kept = []
            for rd in details:
                detail_type = rd.get('type', '')
                if detail_type == 'thinking' or detail_type == 'reasoning.text':
                    continue  # Filter out
                if detail_type:
                    kept.append(rd)
            return kept
        
        kept_for_second_turn = filter_for_replay(first_turn_reasoning)
        
        # Verify only reasoning.encrypted is kept
        assert len(kept_for_second_turn) == 1
        assert kept_for_second_turn[0]['type'] == 'reasoning.encrypted'
        
        # This would be safe to send to Claude - no signatures that can fail
        for rd in kept_for_second_turn:
            # reasoning.encrypted doesn't have 'signature' field
            assert 'signature' not in rd or rd.get('signature') == ''

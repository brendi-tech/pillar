"""
Tests for agentic prompt formatting functions.

Tests format_search_result_content() and related formatters.
"""
import pytest

from apps.mcp.services.prompts.agentic_prompts import format_search_result_content


class TestFormatSearchResultContent:
    """Tests for format_search_result_content()."""

    def test_formats_empty_results(self):
        """Returns 'no results' message when both tools and knowledge are empty."""
        result = format_search_result_content(
            query="test query",
            tools=None,
            knowledge=None,
        )
        assert "Search results for 'test query':" in result
        assert "No results found" in result

    def test_formats_knowledge_results(self):
        """Formats knowledge results with title, section, and content."""
        knowledge = [
            {
                "title": "Getting Started",
                "content": "Welcome to the app...",
                "heading_path": ["Documentation", "Intro"],
                "item_id": "abc123",
                "source_type": "page",
            },
        ]
        result = format_search_result_content(
            query="getting started",
            tools=None,
            knowledge=knowledge,
        )
        assert "Knowledge (1 found):" in result
        assert "  - Getting Started [Documentation > Intro]" in result
        assert "(item_id: abc123)" in result
        assert "Welcome to the app..." in result

    def test_labels_corrections_distinctly(self):
        """Corrections should be labeled [CORRECTION] in formatted output."""
        knowledge = [
            {
                "title": "Password reset instructions",
                "content": "The correct process is to go to settings > security...",
                "heading_path": [],
                "item_id": "correction-001",
                "source_type": "correction",
            },
        ]
        result = format_search_result_content(
            query="password reset",
            tools=None,
            knowledge=knowledge,
        )
        assert "[CORRECTION] Password reset instructions" in result
        assert "The correct process is to go to settings" in result

    def test_does_not_label_regular_knowledge_as_correction(self):
        """Regular knowledge items should NOT have [CORRECTION] label."""
        knowledge = [
            {
                "title": "Password help",
                "content": "If you forgot your password...",
                "heading_path": [],
                "item_id": "page-001",
                "source_type": "page",
            },
            {
                "title": "Login FAQ",
                "content": "Common login issues...",
                "heading_path": [],
                "item_id": "snippet-001",
                "source_type": "snippet",
            },
        ]
        result = format_search_result_content(
            query="password",
            tools=None,
            knowledge=knowledge,
        )
        assert "  - Password help" in result
        assert "[CORRECTION] Password help" not in result
        assert "  - Login FAQ" in result
        assert "[CORRECTION] Login FAQ" not in result

    def test_mixed_corrections_and_regular_knowledge(self):
        """Corrections and regular knowledge should be formatted correctly together."""
        knowledge = [
            {
                "title": "Verified fix for login issue",
                "content": "The correct solution is...",
                "heading_path": [],
                "item_id": "correction-001",
                "source_type": "correction",
            },
            {
                "title": "Login documentation",
                "content": "To log in, use your email...",
                "heading_path": ["Help", "Auth"],
                "item_id": "page-001",
                "source_type": "page",
            },
        ]
        result = format_search_result_content(
            query="login",
            tools=None,
            knowledge=knowledge,
        )
        # Correction should be labeled
        assert "[CORRECTION] Verified fix for login issue" in result
        # Regular page should NOT be labeled
        assert "  - Login documentation [Help > Auth]" in result
        assert "[CORRECTION] Login documentation" not in result

    def test_handles_missing_source_type(self):
        """Handles knowledge items without source_type gracefully."""
        knowledge = [
            {
                "title": "Some article",
                "content": "Article content...",
                "heading_path": [],
                "item_id": "item-001",
                # No source_type field
            },
        ]
        result = format_search_result_content(
            query="article",
            tools=None,
            knowledge=knowledge,
        )
        # Should NOT be labeled as correction
        assert "  - Some article" in result
        assert "[CORRECTION]" not in result

    def test_formats_tools(self):
        """Formats tool results with name, type, description, and schema."""
        tools = [
            {
                "name": "create_report",
                "description": "Create a new report",
                "action_type": "trigger",
                "schema": {"type": "object", "properties": {"name": {"type": "string"}}},
            },
        ]
        result = format_search_result_content(
            query="report",
            tools=tools,
            knowledge=None,
        )
        assert "Tools (1 found):" in result
        assert "create_report [trigger]" in result
        assert "Create a new report" in result
        assert "Schema:" in result

"""
Tests for Action.matches_context() and context filtering in ActionSearchService.
"""
import pytest
from unittest.mock import MagicMock


class TestMatchesContext:
    """Unit tests for Action.matches_context()."""

    def _make_action(self, required_context=None):
        from apps.products.models.action import Action
        action = Action.__new__(Action)
        action.required_context = required_context or {}
        return action

    def test_no_requirements_always_matches(self):
        action = self._make_action({})
        assert action.matches_context({}) is True
        assert action.matches_context({"userRole": "admin"}) is True

    def test_none_requirements_always_matches(self):
        action = self._make_action(None)
        action.required_context = None
        assert action.matches_context({"anything": "here"}) is True

    def test_exact_match_passes(self):
        action = self._make_action({"userRole": "admin"})
        assert action.matches_context({"userRole": "admin"}) is True

    def test_exact_match_fails(self):
        action = self._make_action({"userRole": "admin"})
        assert action.matches_context({"userRole": "member"}) is False

    def test_missing_key_fails(self):
        action = self._make_action({"userRole": "admin"})
        assert action.matches_context({}) is False

    def test_multiple_keys_all_must_match(self):
        action = self._make_action({"userRole": "admin", "plan": "pro"})
        assert action.matches_context({"userRole": "admin", "plan": "pro"}) is True
        assert action.matches_context({"userRole": "admin", "plan": "free"}) is False
        assert action.matches_context({"userRole": "admin"}) is False

    def test_list_value_any_match(self):
        action = self._make_action({"userRole": ["admin", "editor"]})
        assert action.matches_context({"userRole": "admin"}) is True
        assert action.matches_context({"userRole": "editor"}) is True
        assert action.matches_context({"userRole": "viewer"}) is False

    def test_extra_context_keys_ignored(self):
        action = self._make_action({"userRole": "admin"})
        assert action.matches_context({"userRole": "admin", "page": "/settings", "extra": 42}) is True

    def test_none_context_value_does_not_match(self):
        action = self._make_action({"userRole": "admin"})
        assert action.matches_context({"userRole": None}) is False


class TestContextFilteringInSearch:
    """
    Verify the ActionSearchService context filtering path uses
    matches_context (not a missing method).
    """

    def test_search_service_calls_matches_context(self):
        """Confirm context filtering invokes matches_context, not check_context_requirements."""
        import inspect
        from apps.products.services.action_search_service import ActionSearchService

        source = inspect.getsource(ActionSearchService.search_with_metadata)
        assert "matches_context" in source, (
            "ActionSearchService should call action.matches_context(), "
            "not check_context_requirements()"
        )
        assert "check_context_requirements" not in source, (
            "ActionSearchService still references the non-existent "
            "check_context_requirements method"
        )

"""
Tests for action_enrichment.py -- LLM-backed action data extraction and follow-up copy.
"""
import asyncio
import copy

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.services.agent.action_enrichment import (
    extract_action_data,
    generate_followup_question,
)


def _help_center_config():
    return MagicMock(name="help_center_config")


def _action_with_schema(
    name="invite_user",
    properties=None,
    required=None,
    existing_data=None,
):
    props = properties or {
        "email": {"type": "string", "description": "the invitee email"},
        "role": {"type": "string", "description": "their role"},
    }
    req = required if required is not None else ["email", "role"]
    action = {
        "name": name,
        "data_schema": {"properties": props, "required": req},
    }
    if existing_data is not None:
        action["data"] = existing_data
    return action


class TestExtractActionData:
    """Tests for extract_action_data()."""

    @pytest.mark.asyncio
    async def test_returns_expected_shape(self):
        """Mock LLM JSON path; merged data appears on matching actions."""
        actions = [
            _action_with_schema(
                name="do_thing",
                properties={"foo": {"type": "string", "description": "Foo field"}},
                required=[],
            )
        ]
        original = copy.deepcopy(actions)
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value='{"raw": true}')

        extracted = {"do_thing": {"foo": "bar"}}

        with (
            patch(
                "common.utils.llm_config.LLMConfigService.create_llm_client_for_task",
                return_value=(mock_client, "model", None, None),
            ),
            patch(
                "common.utils.json_parser.parse_json_from_llm",
                return_value=extracted,
            ),
        ):
            result = await extract_action_data(
                "set foo to bar",
                actions,
                _help_center_config(),
            )

        assert result[0]["name"] == "do_thing"
        assert result[0]["data"] == {"foo": "bar"}
        assert original[0].get("data") is None

    @pytest.mark.asyncio
    async def test_with_no_action_schemas(self):
        """Actions without data_schema.properties skip LLM and return unchanged."""
        actions = [
            {"name": "plain", "description": "no schema"},
            {"name": "empty_props", "data_schema": {"properties": {}}},
        ]
        expected = copy.deepcopy(actions)

        mock_create = MagicMock()

        with patch(
            "common.utils.llm_config.LLMConfigService.create_llm_client_for_task",
            mock_create,
        ):
            result = await extract_action_data("hello", actions, _help_center_config())

        assert result == expected
        mock_create.assert_not_called()

    @pytest.mark.asyncio
    async def test_handles_llm_timeout(self):
        actions = [_action_with_schema()]
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="{}")

        async def boom(*_args, **_kwargs):
            raise asyncio.TimeoutError()

        with (
            patch(
                "common.utils.llm_config.LLMConfigService.create_llm_client_for_task",
                return_value=(mock_client, "model", None, None),
            ),
            patch(
                "apps.mcp.services.agent.action_enrichment.asyncio.wait_for",
                side_effect=boom,
            ),
        ):
            result = await extract_action_data("q", actions, _help_center_config())

        assert result == actions
        assert not any(a.get("data") for a in result)

    @pytest.mark.asyncio
    async def test_handles_llm_failure(self):
        actions = [_action_with_schema()]
        mock_client = MagicMock()

        async def llm_error(*_a, **_k):
            raise RuntimeError("LLM down")

        mock_client.complete_async = AsyncMock(side_effect=llm_error)

        with patch(
            "common.utils.llm_config.LLMConfigService.create_llm_client_for_task",
            return_value=(mock_client, "model", None, None),
        ):
            result = await extract_action_data("q", actions, _help_center_config())

        assert result == actions

    @pytest.mark.asyncio
    async def test_marks_incomplete_when_required_fields_missing(self):
        actions = [_action_with_schema()]
        # Only one of two required fields extracted
        partial = {"invite_user": {"email": "a@b.co"}}

        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="{}")

        with (
            patch(
                "common.utils.llm_config.LLMConfigService.create_llm_client_for_task",
                return_value=(mock_client, "model", None, None),
            ),
            patch(
                "common.utils.json_parser.parse_json_from_llm",
                return_value=partial,
            ),
        ):
            result = await extract_action_data("invite a@b.co", actions, _help_center_config())

        action = result[0]
        assert action["data"] == {"email": "a@b.co"}
        assert action["data_incomplete"] is True
        assert action["missing_fields"] == ["role"]
        assert action["missing_field_descriptions"] == ["their role"]

    @pytest.mark.asyncio
    async def test_merges_with_existing_data(self):
        actions = [
            _action_with_schema(
                name="merge_me",
                properties={
                    "a": {"type": "string", "description": "A"},
                    "b": {"type": "string", "description": "B"},
                },
                required=[],
                existing_data={"a": "keep"},
            )
        ]
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="{}")

        with (
            patch(
                "common.utils.llm_config.LLMConfigService.create_llm_client_for_task",
                return_value=(mock_client, "model", None, None),
            ),
            patch(
                "common.utils.json_parser.parse_json_from_llm",
                return_value={"merge_me": {"b": "new"}},
            ),
        ):
            result = await extract_action_data("q", actions, _help_center_config())

        assert result[0]["data"] == {"a": "keep", "b": "new"}


class TestGenerateFollowupQuestion:
    """Tests for generate_followup_question()."""

    def test_no_descriptions(self):
        out = generate_followup_question("any action", [])
        assert out == (
            "I need a bit more information to proceed. Could you provide more details?"
        )

    def test_single_description(self):
        out = generate_followup_question("invite", ["the invitee email"])
        assert out == (
            "I can help with that! To proceed, could you please provide: the invitee email?"
        )

    def test_two_descriptions(self):
        out = generate_followup_question("invite", ["the invitee email", "their role"])
        assert out == (
            "I can help with that! To proceed, I need: the invitee email and their role."
        )

    def test_three_descriptions(self):
        out = generate_followup_question(
            "setup",
            ["first thing", "second thing", "third thing"],
        )
        assert out == (
            "I can help with that! To proceed, I need a few things: "
            "first thing, second thing, and third thing."
        )

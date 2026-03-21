"""Tests for Slack Block Kit formatting utilities."""
import pytest

from apps.integrations.slack.formatting import (
    build_confirmation_blocks,
    build_sources_block,
    markdown_to_mrkdwn,
    split_markdown_into_blocks,
    split_text_into_blocks,
)


class TestMarkdownToMrkdwn:
    def test_bold(self):
        assert markdown_to_mrkdwn("**hello**") == "*hello*"

    def test_italic_underscore(self):
        assert markdown_to_mrkdwn("_hello_") == "_hello_"

    def test_strikethrough(self):
        assert markdown_to_mrkdwn("~~hello~~") == "~hello~"

    def test_link(self):
        result = markdown_to_mrkdwn("[click here](https://example.com)")
        assert result == "<https://example.com|click here>"

    def test_heading(self):
        assert markdown_to_mrkdwn("# Hello") == "*Hello*"
        assert markdown_to_mrkdwn("## Hello") == "*Hello*"
        assert markdown_to_mrkdwn("### Hello") == "*Hello*"

    def test_unordered_list(self):
        result = markdown_to_mrkdwn("- item one\n- item two")
        assert "• item one" in result
        assert "• item two" in result

    def test_escape_ampersand(self):
        assert "&amp;" in markdown_to_mrkdwn("A & B")

    def test_escape_angle_brackets(self):
        result = markdown_to_mrkdwn("a < b > c")
        assert "&lt;" in result
        assert "&gt;" in result

    def test_preserve_inline_code(self):
        result = markdown_to_mrkdwn("Use `**bold**` syntax")
        assert "`**bold**`" in result

    def test_preserve_code_block(self):
        result = markdown_to_mrkdwn("```\n**bold**\n```")
        assert "**bold**" in result

    def test_blockquote(self):
        result = markdown_to_mrkdwn("> quoted text")
        assert result.startswith("> quoted text")

    def test_empty_input(self):
        assert markdown_to_mrkdwn("") == ""

    def test_nested_bold_in_heading(self):
        result = markdown_to_mrkdwn("# **Important**")
        # Heading conversion + bold → *Important* (bold collapses with heading)
        assert "Important" in result


class TestSplitTextIntoBlocks:
    def test_short_text_single_block(self):
        blocks = split_text_into_blocks("Hello world")
        assert len(blocks) == 1
        assert blocks[0]["type"] == "section"
        assert blocks[0]["text"]["type"] == "mrkdwn"
        assert blocks[0]["text"]["text"] == "Hello world"

    def test_long_text_splits(self):
        text = "A" * 5000
        blocks = split_text_into_blocks(text, max_chars=2900)
        assert len(blocks) >= 2
        for block in blocks:
            assert len(block["text"]["text"]) <= 2900

    def test_splits_at_paragraph_boundary(self):
        text = ("A" * 1400) + "\n\n" + ("B" * 1400) + "\n\n" + ("C" * 1400)
        blocks = split_text_into_blocks(text, max_chars=2900)
        assert len(blocks) >= 2

    def test_exactly_at_limit(self):
        text = "X" * 2900
        blocks = split_text_into_blocks(text, max_chars=2900)
        assert len(blocks) == 1

    def test_empty_string(self):
        blocks = split_text_into_blocks("")
        assert len(blocks) == 1
        assert blocks[0]["text"]["text"] == ""


class TestSplitMarkdownIntoBlocks:
    def test_short_text_single_block(self):
        blocks = split_markdown_into_blocks("Hello world")
        assert len(blocks) == 1
        assert blocks[0]["type"] == "markdown"
        assert blocks[0]["text"] == "Hello world"

    def test_empty_string(self):
        blocks = split_markdown_into_blocks("")
        assert len(blocks) == 1
        assert blocks[0]["type"] == "markdown"

    def test_whitespace_only(self):
        blocks = split_markdown_into_blocks("   \n\n  ")
        assert len(blocks) == 1
        assert blocks[0]["type"] == "markdown"

    def test_raw_markdown_preserved(self):
        """Bold, headings, and links stay as standard markdown (no mrkdwn conversion)."""
        text = "**bold** and [link](https://example.com)\n\n## Heading"
        blocks = split_markdown_into_blocks(text)
        assert len(blocks) == 1
        assert "**bold**" in blocks[0]["text"]
        assert "[link](https://example.com)" in blocks[0]["text"]
        assert "## Heading" in blocks[0]["text"]

    def test_table_passes_through(self):
        table = (
            "| # | Name | Created |\n"
            "|---|------|--------|\n"
            "| 1 | Test | May 18 |\n"
            "| 2 | Demo | Jun 01 |"
        )
        text = f"Here are your customers:\n\n{table}\n\nAnything else?"
        blocks = split_markdown_into_blocks(text)
        assert len(blocks) == 1
        assert "| # | Name | Created |" in blocks[0]["text"]
        assert "|---|------|--------|" in blocks[0]["text"]

    def test_code_block_passes_through(self):
        text = "Run this:\n\n```python\nprint('hello')\n```\n\nDone."
        blocks = split_markdown_into_blocks(text)
        assert len(blocks) == 1
        assert "```python" in blocks[0]["text"]
        assert "print('hello')" in blocks[0]["text"]

    def test_long_text_splits(self):
        text = "A" * 20000
        blocks = split_markdown_into_blocks(text, max_chars=12000)
        assert len(blocks) >= 2
        for block in blocks:
            assert block["type"] == "markdown"
            assert len(block["text"]) <= 12000

    def test_splits_at_paragraph_boundary(self):
        text = ("A" * 6000) + "\n\n" + ("B" * 6000) + "\n\n" + ("C" * 6000)
        blocks = split_markdown_into_blocks(text, max_chars=12000)
        assert len(blocks) >= 2
        for block in blocks:
            assert block["type"] == "markdown"

    def test_realistic_llm_response(self):
        """Full LLM response with prose, table, and code renders as markdown blocks."""
        text = (
            "You currently have **2 customers**:\n\n"
            "| # | Customer ID | Name | Created |\n"
            "|---|------------|------|--------|\n"
            "| 1 | 123321 | Test | May 18, 2026 |\n"
            "| 2 | 123 | Test | May 18, 2026 |\n\n"
            "To query them via the API:\n\n"
            "```bash\n"
            "curl https://api.example.com/customers\n"
            "```\n\n"
            "Would you like to look into either of them?"
        )
        blocks = split_markdown_into_blocks(text)
        assert len(blocks) == 1
        full_text = blocks[0]["text"]
        assert "**2 customers**" in full_text
        assert "| # | Customer ID |" in full_text
        assert "```bash" in full_text
        assert "curl" in full_text


class TestBuildSourcesBlock:
    def test_no_sources(self):
        block = build_sources_block([])
        assert block["type"] == "context"
        assert len(block["elements"]) == 1

    def test_single_source_with_url(self):
        block = build_sources_block([
            {"title": "Docs", "url": "https://example.com/docs"},
        ])
        assert "<https://example.com/docs|Docs>" in block["elements"][0]["text"]

    def test_source_without_url(self):
        block = build_sources_block([{"title": "Internal Note"}])
        assert "Internal Note" in block["elements"][0]["text"]

    def test_multiple_sources(self):
        sources = [
            {"title": f"Source {i}", "url": f"https://example.com/{i}"}
            for i in range(5)
        ]
        block = build_sources_block(sources)
        text = block["elements"][0]["text"]
        assert "Source 0" in text
        assert "Source 4" in text
        assert " · " in text

    def test_max_ten_sources(self):
        sources = [
            {"title": f"S{i}", "url": f"https://example.com/{i}"}
            for i in range(15)
        ]
        block = build_sources_block(sources)
        text = block["elements"][0]["text"]
        assert "S9" in text
        assert "S10" not in text


class TestBuildConfirmationBlocks:
    def test_basic_confirmation(self):
        blocks = build_confirmation_blocks(
            tool_name="create_plan",
            call_id="tc_1",
            title="Create plan",
            message="Create 1 plan at $49/mo",
            details=None,
            confirm_payload={"name": "Pro"},
        )
        types = [b["type"] for b in blocks]
        assert "divider" in types
        assert "section" in types
        assert "actions" in types
        header_block = next(b for b in blocks if b["type"] == "section")
        assert "*Create plan*" in header_block["text"]["text"]
        assert "Create 1 plan at $49/mo" in header_block["text"]["text"]

    def test_details_rendered_as_fields(self):
        blocks = build_confirmation_blocks(
            tool_name="create_plan",
            call_id="tc_2",
            title="Create plan",
            message="",
            details={"Plan": "Pro", "Price": "$49/mo"},
            confirm_payload={},
        )
        field_blocks = [b for b in blocks if "fields" in b]
        assert len(field_blocks) == 1
        fields = field_blocks[0]["fields"]
        assert len(fields) == 2
        assert "*Plan*\nPro" in fields[0]["text"]
        assert "*Price*\n$49/mo" in fields[1]["text"]

    def test_no_details_no_fields(self):
        blocks = build_confirmation_blocks(
            tool_name="t",
            call_id="tc_3",
            title="t",
            message="msg",
            details=None,
            confirm_payload={},
        )
        field_blocks = [b for b in blocks if "fields" in b]
        assert len(field_blocks) == 0

    def test_message_markdown_converted_to_mrkdwn(self):
        blocks = build_confirmation_blocks(
            tool_name="create_plan",
            call_id="tc_md",
            title="Create plan",
            message="**AyushNeedsANewLogo** (`custom-logo-1`)\n• **Base price:** $5/month",
            details=None,
            confirm_payload={},
        )
        header_block = next(b for b in blocks if b["type"] == "section")
        text = header_block["text"]["text"]
        assert "**" not in text
        assert "*AyushNeedsANewLogo*" in text
        assert "*Base price:*" in text

    def test_details_values_markdown_converted_to_mrkdwn(self):
        blocks = build_confirmation_blocks(
            tool_name="create_plan",
            call_id="tc_dmd",
            title="Create plan",
            message="",
            details={"Plan": "**Pro** plan", "Price": "$49/mo"},
            confirm_payload={},
        )
        field_blocks = [b for b in blocks if "fields" in b]
        assert len(field_blocks) == 1
        fields = field_blocks[0]["fields"]
        assert "*Pro* plan" in fields[0]["text"]
        assert "**" not in fields[0]["text"]

    def test_confirm_cancel_buttons(self):
        blocks = build_confirmation_blocks(
            tool_name="t",
            call_id="tc_4",
            title="t",
            message="msg",
            details=None,
            confirm_payload={},
        )
        actions_block = next(b for b in blocks if b["type"] == "actions")
        elements = actions_block["elements"]
        assert len(elements) == 2
        assert elements[0]["action_id"] == "confirm_tool:tc_4"
        assert elements[1]["action_id"] == "cancel_tool:tc_4"
        assert elements[0]["style"] == "primary"
        assert elements[1]["style"] == "danger"

    def test_conversation_id_included_in_button_payload(self):
        import json
        blocks = build_confirmation_blocks(
            tool_name="create_plan",
            call_id="tc_conv",
            title="Create plan",
            message="Test",
            details=None,
            confirm_payload={"name": "Pro"},
            conversation_id="conv-abc-123",
        )
        actions_block = next(b for b in blocks if b["type"] == "actions")
        value_data = json.loads(actions_block["elements"][0]["value"])
        assert value_data["conversation_id"] == "conv-abc-123"
        assert value_data["tool_name"] == "create_plan"

    def test_no_conversation_id_omitted_from_payload(self):
        import json
        blocks = build_confirmation_blocks(
            tool_name="t",
            call_id="tc_no_conv",
            title="t",
            message="msg",
            details=None,
            confirm_payload={},
        )
        actions_block = next(b for b in blocks if b["type"] == "actions")
        value_data = json.loads(actions_block["elements"][0]["value"])
        assert "conversation_id" not in value_data

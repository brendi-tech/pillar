"""
Tests for RegisteredSkill integration across MCP services.

Tests skill search, load_skill handler, MCP prompts/resources, and capabilities.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def make_async_iterable(items):
    """Helper to create an async iterable mock from a list of items."""

    class AsyncIterableMock:
        def __init__(self, data):
            self._data = data

        def __aiter__(self):
            return self

        async def __anext__(self):
            if not self._data:
                raise StopAsyncIteration
            return self._data.pop(0)

        def values(self, *args, **kwargs):
            return self

        def values_list(self, *args, **kwargs):
            return self

        def aiterator(self):
            return self

    return AsyncIterableMock(list(items))


def _make_mock_skill(name="setup-guide", description="How to set up", content="# Setup\nDo this.", distance=0.15):
    """Create a mock RegisteredSkill with optional distance attribute."""
    skill = MagicMock()
    skill.name = name
    skill.description = description
    skill.content = content
    skill.distance = distance
    skill.is_active = True
    return skill


# -----------------------------------------------------------------------
# TestSkillSearchInExecutor
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestSkillSearchInExecutor:
    """Test AgentToolExecutor._search_skills()."""

    async def test_search_skills_returns_correct_shape(self):
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor

        mock_product = MagicMock()
        mock_product.id = "prod-1"

        executor = AgentToolExecutor(
            product=mock_product,
            organization=MagicMock(),
        )

        skill_a = _make_mock_skill(name="onboarding", description="Onboarding guide", distance=0.10)
        skill_b = _make_mock_skill(name="billing-faq", description="Billing FAQ", distance=0.25)

        mock_qs = MagicMock()
        mock_qs.filter.return_value = mock_qs
        mock_qs.annotate.return_value = mock_qs
        mock_qs.order_by.return_value = mock_qs
        mock_qs.__getitem__ = MagicMock(return_value=mock_qs)
        mock_qs.aiterator.return_value = make_async_iterable([skill_a, skill_b])

        mock_embedding_service = MagicMock()
        mock_embedding_service.embed_query_async = AsyncMock(return_value=[0.1] * 1536)

        with patch("apps.tools.models.RegisteredSkill.objects", mock_qs), \
             patch("common.services.embedding_service.get_embedding_service", return_value=mock_embedding_service), \
             patch("pgvector.django.CosineDistance"):
            results = await executor._search_skills("how to set up", limit=5)

        assert len(results) == 2
        for r in results:
            assert "name" in r
            assert "description" in r
            assert r["type"] == "skill"
            assert "score" in r
            assert isinstance(r["score"], float)

        assert results[0]["name"] == "onboarding"
        assert results[0]["score"] == round(1 - 0.10, 3)
        assert results[1]["name"] == "billing-faq"
        assert results[1]["score"] == round(1 - 0.25, 3)

    async def test_search_skills_empty_when_no_matches(self):
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor

        mock_product = MagicMock()
        mock_product.id = "prod-1"

        executor = AgentToolExecutor(
            product=mock_product,
            organization=MagicMock(),
        )

        mock_qs = MagicMock()
        mock_qs.filter.return_value = mock_qs
        mock_qs.annotate.return_value = mock_qs
        mock_qs.order_by.return_value = mock_qs
        mock_qs.__getitem__ = MagicMock(return_value=mock_qs)
        mock_qs.aiterator.return_value = make_async_iterable([])

        mock_embedding_service = MagicMock()
        mock_embedding_service.embed_query_async = AsyncMock(return_value=[0.1] * 1536)

        with patch("apps.tools.models.RegisteredSkill.objects", mock_qs), \
             patch("common.services.embedding_service.get_embedding_service", return_value=mock_embedding_service), \
             patch("pgvector.django.CosineDistance"):
            results = await executor._search_skills("something irrelevant", limit=5)

        assert results == []


# -----------------------------------------------------------------------
# TestLoadSkillHandler
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestLoadSkillHandler:
    """Test execute_load_skill() from tool_handlers.py."""

    async def test_load_skill_success(self):
        from apps.mcp.services.agent.tool_handlers import execute_load_skill

        mock_skill = _make_mock_skill(
            name="deploy-guide",
            content="# Deploy Guide\n\nStep 1: Build\nStep 2: Ship",
        )

        mock_tracer = MagicMock()
        mock_span = MagicMock()
        mock_tracer.start_span.return_value = mock_span

        mock_executor = MagicMock()
        mock_executor.product = MagicMock()

        messages: list[dict] = []
        display_trace: list[dict] = []

        with patch("apps.tools.models.RegisteredSkill.objects") as mock_objects:
            mock_objects.aget = AsyncMock(return_value=mock_skill)

            events = []
            async for event in execute_load_skill(
                messages=messages,
                tool_executor=mock_executor,
                display_trace=display_trace,
                iteration=1,
                start_time_ms=1000,
                tracer=mock_tracer,
                tool_call_id="call-123",
                arguments={"name": "deploy-guide"},
            ):
                events.append(event)

        assert len(messages) == 1
        result_content = messages[0]["content"]
        assert result_content.startswith("Skill: deploy-guide")
        assert "Step 1: Build" in result_content

        assert any(
            e.get("type") == "progress" and e.get("data", {}).get("status") == "active"
            for e in events
        )
        assert any(
            e.get("type") == "progress" and e.get("data", {}).get("status") in ("done", "error")
            for e in events
        )

    async def test_load_skill_not_found(self):
        from apps.tools.models import RegisteredSkill
        from apps.mcp.services.agent.tool_handlers import execute_load_skill

        mock_tracer = MagicMock()
        mock_span = MagicMock()
        mock_tracer.start_span.return_value = mock_span

        mock_executor = MagicMock()
        mock_executor.product = MagicMock()

        messages: list[dict] = []
        display_trace: list[dict] = []

        with patch("apps.tools.models.RegisteredSkill.objects") as mock_objects:
            mock_objects.aget = AsyncMock(side_effect=RegisteredSkill.DoesNotExist)

            events = []
            async for event in execute_load_skill(
                messages=messages,
                tool_executor=mock_executor,
                display_trace=display_trace,
                iteration=1,
                start_time_ms=1000,
                tracer=mock_tracer,
                tool_call_id="call-456",
                arguments={"name": "nonexistent"},
            ):
                events.append(event)

        assert len(messages) == 1
        assert "Skill not found: nonexistent" in messages[0]["content"]

    async def test_load_skill_missing_name(self):
        from apps.mcp.services.agent.tool_handlers import execute_load_skill

        mock_tracer = MagicMock()
        mock_executor = MagicMock()

        messages: list[dict] = []
        display_trace: list[dict] = []

        events = []
        async for event in execute_load_skill(
            messages=messages,
            tool_executor=mock_executor,
            display_trace=display_trace,
            iteration=1,
            start_time_ms=1000,
            tracer=mock_tracer,
            tool_call_id="call-789",
            arguments={},
        ):
            events.append(event)

        assert len(messages) == 1
        assert "Error: name is required" in messages[0]["content"]
        assert events == []


# -----------------------------------------------------------------------
# TestPromptsRegistrySkills
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestPromptsRegistrySkills:
    """Test prompts_registry.list_prompts() and get_prompt() with skills."""

    async def test_list_prompts_includes_skills(self):
        from apps.mcp.services.mcp_server.prompts_registry import list_prompts

        skill = _make_mock_skill(name="setup-guide", description="How to set up the app")
        mock_hc = MagicMock()
        mock_hc.id = "hc-1"

        with patch("apps.mcp.services.mcp_server.prompts_registry._load_product_skills") as mock_load:
            mock_load.return_value = [{"name": "setup-guide", "description": "How to set up the app"}]

            result = await list_prompts(mock_hc, agent=None)

        assert len(result["prompts"]) == 1
        assert result["prompts"][0]["name"] == "setup-guide"
        assert result["prompts"][0]["description"] == "How to set up the app"

    async def test_load_product_skills_queries_db(self):
        from apps.mcp.services.mcp_server.prompts_registry import _load_product_skills

        skill = _make_mock_skill(name="deploy", description="Deploy instructions")
        mock_hc = MagicMock()

        mock_qs = MagicMock()
        mock_qs.filter.return_value = mock_qs
        mock_qs.aiterator.return_value = make_async_iterable([skill])

        with patch("apps.tools.models.RegisteredSkill.objects", mock_qs):
            prompts = await _load_product_skills(mock_hc)

        assert len(prompts) == 1
        assert prompts[0]["name"] == "deploy"
        assert prompts[0]["description"] == "Deploy instructions"

    async def test_get_prompt_returns_skill_content(self):
        from apps.mcp.services.mcp_server.prompts_registry import get_prompt

        skill = _make_mock_skill(
            name="billing-guide",
            description="Billing guide for customers",
            content="# Billing\n\nHere is how billing works.",
        )

        mock_hc = MagicMock()

        with patch("apps.tools.models.RegisteredSkill.objects") as mock_objects:
            mock_objects.aget = AsyncMock(return_value=skill)

            result = await get_prompt(
                params={"name": "billing-guide"},
                help_center_config=mock_hc,
            )

        assert result["description"] == "Billing guide for customers"
        assert result["messages"][0]["role"] == "user"
        assert result["messages"][0]["content"]["type"] == "text"
        assert "# Billing" in result["messages"][0]["content"]["text"]

    async def test_get_prompt_raises_for_nonexistent_skill(self):
        from apps.tools.models import RegisteredSkill
        from apps.mcp.services.mcp_server.prompts_registry import get_prompt

        mock_hc = MagicMock()

        with patch("apps.tools.models.RegisteredSkill.objects") as mock_objects:
            mock_objects.aget = AsyncMock(side_effect=RegisteredSkill.DoesNotExist)

            with pytest.raises(ValueError, match="Unknown prompt"):
                await get_prompt(
                    params={"name": "no-such-skill"},
                    help_center_config=mock_hc,
                )


# -----------------------------------------------------------------------
# TestResourcesRegistrySkills
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestResourcesRegistrySkills:
    """Test resources_registry._load_skill_resources() and build_resources_list()."""

    async def test_load_skill_resources_correct_uri(self):
        from apps.mcp.services.mcp_server.resources_registry import _load_skill_resources

        skill = _make_mock_skill(name="onboarding", description="Onboarding flow")
        mock_hc = MagicMock()
        mock_hc.id = "prod-abc"

        mock_qs = MagicMock()
        mock_qs.filter.return_value = mock_qs
        mock_qs.aiterator.return_value = make_async_iterable([skill])

        with patch("apps.tools.models.RegisteredSkill.objects", mock_qs):
            resources = await _load_skill_resources(mock_hc)

        assert len(resources) == 1
        r = resources[0]
        assert r["uri"] == "skill://prod-abc/onboarding"
        assert r["name"] == "onboarding"
        assert r["description"] == "Onboarding flow"
        assert r["mimeType"] == "text/markdown"
        assert r["metadata"]["type"] == "skill"

    async def test_build_resources_list_includes_skills(self):
        from apps.mcp.services.mcp_server.resources_registry import build_resources_list

        mock_hc = MagicMock()
        mock_hc.id = "prod-xyz"
        mock_hc.organization_id = "org-1"
        mock_org = MagicMock()

        with patch("apps.knowledge.models.KnowledgeItem.objects") as mock_ki, \
             patch("apps.mcp.services.mcp_server.resources_registry._load_skill_resources") as mock_skills, \
             patch("apps.mcp.services.mcp_server.resources_registry._load_external_mcp_resources", new_callable=AsyncMock) as mock_ext:
            ki_qs = MagicMock()
            ki_qs.filter.return_value = ki_qs
            ki_qs.select_related.return_value = ki_qs
            ki_qs.order_by.return_value = ki_qs
            ki_qs.aiterator.return_value = make_async_iterable([])
            mock_ki.filter.return_value = ki_qs

            mock_skills.return_value = [{
                "uri": "skill://prod-xyz/my-skill",
                "name": "my-skill",
                "description": "A test skill",
                "mimeType": "text/markdown",
                "metadata": {"type": "skill"},
            }]
            mock_ext.return_value = []

            result = await build_resources_list(mock_hc, mock_org, agent=None)

        assert any(
            r["uri"] == "skill://prod-xyz/my-skill"
            for r in result["resources"]
        )


# -----------------------------------------------------------------------
# TestResourcesDispatcherSkills
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestResourcesDispatcherSkills:
    """Test resources_dispatcher._read_skill() and dispatch_resource_read()."""

    async def test_read_skill_returns_content(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import _read_skill

        skill = _make_mock_skill(
            name="auth-setup",
            content="# Auth Setup\n\nConfigure OAuth here.",
        )
        mock_hc = MagicMock()
        mock_hc.id = "prod-100"

        with patch("apps.tools.models.RegisteredSkill.objects") as mock_objects:
            mock_objects.aget = AsyncMock(return_value=skill)

            result = await _read_skill(mock_hc, "skill://prod-100/auth-setup")

        assert len(result["contents"]) == 1
        assert result["contents"][0]["uri"] == "skill://prod-100/auth-setup"
        assert result["contents"][0]["mimeType"] == "text/markdown"
        assert "# Auth Setup" in result["contents"][0]["text"]

    async def test_read_skill_invalid_uri_format(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import _read_skill

        mock_hc = MagicMock()
        mock_hc.id = "prod-100"

        with pytest.raises(ValueError, match="Invalid skill URI format"):
            await _read_skill(mock_hc, "skill://bad-format")

    async def test_read_skill_wrong_product_id(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import _read_skill

        mock_hc = MagicMock()
        mock_hc.id = "prod-100"

        with pytest.raises(ValueError, match="does not belong"):
            await _read_skill(mock_hc, "skill://wrong-product/some-skill")

    async def test_read_skill_not_found(self):
        from apps.tools.models import RegisteredSkill
        from apps.mcp.services.mcp_server.resources_dispatcher import _read_skill

        mock_hc = MagicMock()
        mock_hc.id = "prod-100"

        with patch("apps.tools.models.RegisteredSkill.objects") as mock_objects:
            mock_objects.aget = AsyncMock(side_effect=RegisteredSkill.DoesNotExist)

            with pytest.raises(ValueError, match="Skill not found"):
                await _read_skill(mock_hc, "skill://prod-100/missing-skill")

    async def test_dispatch_routes_skill_uri(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import dispatch_resource_read

        skill = _make_mock_skill(name="my-skill", content="Skill content here")
        mock_hc = MagicMock()
        mock_hc.id = "prod-200"
        mock_org = MagicMock()

        with patch("apps.tools.models.RegisteredSkill.objects") as mock_objects:
            mock_objects.aget = AsyncMock(return_value=skill)

            result = await dispatch_resource_read(
                mock_hc, mock_org,
                params={"uri": "skill://prod-200/my-skill"},
            )

        assert result["contents"][0]["text"] == "Skill content here"


# -----------------------------------------------------------------------
# TestCapabilitiesSummarySkills
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestCapabilitiesSummarySkills:
    """Test that build_capabilities_summary() includes <available_skills>."""

    async def test_skills_appear_in_summary(self):
        from apps.mcp.services.prompts.capabilities import build_capabilities_summary

        mock_product = MagicMock()
        mock_product.id = "test-product-id"

        mock_actions_data = [
            {"name": "open_settings", "description": "Open settings", "action_type": "navigation", "required_context": None},
        ]

        with patch("apps.mcp.services.prompts.capabilities.cache") as mock_cache:
            mock_cache.get.return_value = None

            with patch("apps.products.models.Action.objects") as mock_action_model, \
                 patch("apps.tools.models.RegisteredSkill.objects") as mock_skill_model:
                mock_action_qs = make_async_iterable(mock_actions_data)
                mock_action_model.filter.return_value = mock_action_qs

                mock_skill_qs = make_async_iterable(["onboarding", "deploy-guide"])
                mock_skill_model.filter.return_value = mock_skill_qs

                result = await build_capabilities_summary(mock_product)

        assert "<available_skills>" in result
        assert "onboarding" in result
        assert "deploy-guide" in result
        assert "<<available_capabilities>>" in result

    async def test_skills_only_no_actions_still_produce_summary(self):
        from apps.mcp.services.prompts.capabilities import build_capabilities_summary

        mock_product = MagicMock()
        mock_product.id = "test-product-skills-only"

        with patch("apps.mcp.services.prompts.capabilities.cache") as mock_cache:
            mock_cache.get.return_value = None

            with patch("apps.products.models.Action.objects") as mock_action_model, \
                 patch("apps.tools.models.RegisteredSkill.objects") as mock_skill_model:
                mock_action_qs = make_async_iterable([])
                mock_action_model.filter.return_value = mock_action_qs

                mock_skill_qs = make_async_iterable(["standalone-skill"])
                mock_skill_model.filter.return_value = mock_skill_qs

                result = await build_capabilities_summary(mock_product)

        assert result != ""
        assert "<available_skills>standalone-skill</available_skills>" in result

    async def test_no_skills_no_available_skills_tag(self):
        from apps.mcp.services.prompts.capabilities import build_capabilities_summary

        mock_product = MagicMock()
        mock_product.id = "test-product-no-skills"

        mock_actions_data = [
            {"name": "do_thing", "description": "Does a thing", "action_type": "trigger", "required_context": None},
        ]

        with patch("apps.mcp.services.prompts.capabilities.cache") as mock_cache:
            mock_cache.get.return_value = None

            with patch("apps.products.models.Action.objects") as mock_action_model, \
                 patch("apps.tools.models.RegisteredSkill.objects") as mock_skill_model:
                mock_action_qs = make_async_iterable(mock_actions_data)
                mock_action_model.filter.return_value = mock_action_qs

                mock_skill_qs = make_async_iterable([])
                mock_skill_model.filter.return_value = mock_skill_qs

                result = await build_capabilities_summary(mock_product)

        assert "<available_skills>" not in result
        assert "<<available_capabilities>>" in result

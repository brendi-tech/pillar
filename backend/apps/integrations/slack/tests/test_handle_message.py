"""
Tests for the Slack handle_message workflow persistence integration.

Verifies that the workflow uses adapter.prepare_turn + adapter.finalize
instead of direct create_turn_messages / finalize_turn calls.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestSlackWorkflowPersistence:
    def test_no_direct_create_turn_messages_import(self):
        """The workflow module should not import create_turn_messages."""
        import importlib
        import apps.integrations.slack.workflows.handle_message as mod
        importlib.reload(mod)
        source = open(mod.__file__).read()
        assert 'create_turn_messages' not in source
        assert 'finalize_turn' not in source

    async def test_adapter_prepare_turn_called(self):
        """Adapter's prepare_turn should be called with the user text."""
        from apps.integrations.slack.workflows.handle_message import (
            handle_slack_message,
            SlackMessageInput,
        )

        mock_install = MagicMock()
        mock_install.product = MagicMock()
        mock_install.product.id = 'prod-1'
        mock_install.organization = MagicMock()
        mock_install.organization_id = 'org-1'
        mock_install.agent_id = None
        mock_install.agent = None

        mock_message = MagicMock()
        mock_message.conversation_id = 'conv-1'

        mock_adapter = AsyncMock()
        mock_adapter.prepare_turn = AsyncMock(return_value='msg-1')

        async def empty_stream(*args, **kwargs):
            return
            yield

        mock_service = MagicMock()
        mock_service.ask_stream = empty_stream

        with (
            patch(
                'apps.integrations.slack.models.SlackInstallation.objects',
            ) as mock_objects,
            patch(
                'apps.integrations.slack.connector.SlackChannelConnector',
            ) as mock_connector_cls,
            patch(
                'apps.integrations.slack.adapter.SlackResponseAdapter',
                return_value=mock_adapter,
            ),
            patch(
                'apps.products.services.agent_resolver.resolve_agent_config',
                new_callable=AsyncMock,
            ),
            patch(
                'apps.mcp.services.agent.answer_service.AgentAnswerServiceReActAsync',
                return_value=mock_service,
            ),
        ):
            mock_objects.select_related.return_value.aget = AsyncMock(
                return_value=mock_install,
            )
            mock_connector_cls.return_value.build_agent_message = AsyncMock(
                return_value=mock_message,
            )

            workflow_input = SlackMessageInput(
                team_id='T123', channel_id='C123', user_id='U123',
                text='Hello bot', ts='1234.5678',
                event_type='message', event_id='E123',
            )
            await handle_slack_message(workflow_input, MagicMock())

            mock_adapter.prepare_turn.assert_called_once_with('Hello bot')

    async def test_adapter_finalize_called_on_success(self):
        from apps.integrations.slack.workflows.handle_message import (
            handle_slack_message,
            SlackMessageInput,
        )

        mock_install = MagicMock()
        mock_install.product = MagicMock()
        mock_install.product.id = 'prod-1'
        mock_install.organization = MagicMock()
        mock_install.organization_id = 'org-1'
        mock_install.agent_id = None
        mock_install.agent = None

        mock_message = MagicMock()
        mock_message.conversation_id = 'conv-1'

        mock_adapter = AsyncMock()

        async def empty_stream(*args, **kwargs):
            return
            yield

        mock_service = MagicMock()
        mock_service.ask_stream = empty_stream

        with (
            patch(
                'apps.integrations.slack.models.SlackInstallation.objects',
            ) as mock_objects,
            patch(
                'apps.integrations.slack.connector.SlackChannelConnector',
            ) as mock_connector_cls,
            patch(
                'apps.integrations.slack.adapter.SlackResponseAdapter',
                return_value=mock_adapter,
            ),
            patch(
                'apps.products.services.agent_resolver.resolve_agent_config',
                new_callable=AsyncMock,
            ),
            patch(
                'apps.mcp.services.agent.answer_service.AgentAnswerServiceReActAsync',
                return_value=mock_service,
            ),
        ):
            mock_objects.select_related.return_value.aget = AsyncMock(
                return_value=mock_install,
            )
            mock_connector_cls.return_value.build_agent_message = AsyncMock(
                return_value=mock_message,
            )

            workflow_input = SlackMessageInput(
                team_id='T123', channel_id='C123', user_id='U123',
                text='Hello', ts='1234.5678',
                event_type='message', event_id='E1',
            )
            await handle_slack_message(workflow_input, MagicMock())
            mock_adapter.finalize.assert_called_once()


class TestSlackConfirmationPersistence:
    async def test_confirmation_success_path_no_persistence(self):
        from apps.integrations.slack.workflows.handle_message import (
            _handle_confirmation,
            SlackMessageInput,
        )

        mock_adapter = AsyncMock()
        mock_adapter._post_message = AsyncMock()

        mock_endpoint = MagicMock()
        mock_endpoint.endpoint_url = 'https://example.com/tools'

        installation = MagicMock()
        installation.team_id = 'T123'
        installation.organization_id = 'org-1'
        installation.get_client.return_value = MagicMock()
        product = MagicMock()
        product.id = 'prod-1'
        product.name = 'TestProduct'

        with (
            patch(
                'apps.integrations.slack.adapter.SlackResponseAdapter',
                return_value=mock_adapter,
            ),
            patch(
                'apps.tools.services.dispatch.get_tool_endpoint',
                new_callable=AsyncMock,
                return_value=mock_endpoint,
            ),
            patch(
                'apps.tools.services.dispatch.post_tool_call',
                new_callable=AsyncMock,
                return_value={'success': True, 'result': 'All good'},
            ),
        ):
            workflow_input = SlackMessageInput(
                team_id='T123', channel_id='C123', user_id='U123',
                text='', ts='1234.5678', event_type='message', event_id='E1',
                tool_confirm={
                    'tool_name': 'create_thing',
                    'call_id': 'call-1',
                    'confirm_payload': {},
                },
            )

            result = await _handle_confirmation(workflow_input, installation, product)
            assert result['status'] == 'completed'
            mock_adapter.prepare_turn.assert_not_called()
            mock_adapter.finalize.assert_not_called()

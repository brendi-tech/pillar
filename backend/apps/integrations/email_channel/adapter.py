"""
EmailResponseAdapter — translates agentic loop events into an HTML email reply.

Accumulates the agent response, converts markdown to HTML, adds sources
as links, and sends via Postmark (or SendGrid). Preserves email threading
with proper Message-ID / In-Reply-To / References headers.
"""
import logging
import uuid

import httpx
import mistune

from apps.mcp.services.agent.response_adapter import ResponseAdapter

from .models import EmailChannelConfiguration, EmailMessageMapping

logger = logging.getLogger(__name__)


class EmailResponseAdapter(ResponseAdapter):
    """
    Translates agentic loop events into an HTML email reply.

    Accumulates tokens during streaming, then sends the complete response
    as an HTML email in finalize().
    """

    def __init__(
        self,
        config: EmailChannelConfiguration,
        reply_to_email: str,
        original_subject: str,
        original_message_id: str = '',
        in_reply_to: str = '',
    ) -> None:
        self.config = config
        self.reply_to_email = reply_to_email
        self.original_subject = original_subject
        self.original_message_id = original_message_id
        self.in_reply_to = in_reply_to

        self._tokens: list[str] = []
        self._sources: list[dict] = []
        self._full_response = ""
        self._conversation = None

    # ── ResponseAdapter interface ──────────────────────────────────────

    async def on_token(self, text: str) -> None:
        self._tokens.append(text)

    async def on_sources(self, sources: list[dict]) -> None:
        self._sources = sources

    async def on_progress(self, progress_data: dict) -> None:
        pass

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict
    ) -> None:
        pass

    async def on_complete(self, event: dict) -> None:
        self._full_response = event.get('message', '') or ''.join(self._tokens)

    async def on_error(self, message: str, details: dict | None = None) -> None:
        self._full_response = (
            "I'm sorry, I encountered an error processing your request. "
            "Please try again or contact support directly."
        )

    # ── Email sending ──────────────────────────────────────────────────

    async def finalize(self) -> None:
        """Convert the response to HTML and send the reply email."""
        response_text = self._full_response or ''.join(self._tokens)
        if not response_text:
            return

        html_body = self._build_html(response_text, self._sources)
        outbound_message_id = f"<{uuid.uuid4()}@pillar.email>"

        subject = self.original_subject
        if not subject.lower().startswith('re:'):
            subject = f"Re: {subject}"

        headers = {}
        if self.original_message_id:
            headers['In-Reply-To'] = self.original_message_id
            headers['References'] = self.original_message_id

        try:
            await self._send_email(
                to=self.reply_to_email,
                subject=subject,
                html_body=html_body,
                text_body=response_text,
                message_id=outbound_message_id,
                headers=headers,
            )

            # Store outbound Message-ID for threading
            if self._conversation:
                try:
                    await EmailMessageMapping.objects.acreate(
                        config=self.config,
                        message_id=outbound_message_id,
                        conversation=self._conversation,
                        sender_email=self.config.from_address,
                        subject=subject[:500],
                        direction='outbound',
                    )
                except Exception:
                    logger.debug("[EMAIL] Failed to store outbound message mapping")

        except Exception:
            logger.exception("[EMAIL] Failed to send reply email")

    def set_conversation(self, conversation) -> None:
        """Allow the workflow to set the conversation for outbound mapping."""
        self._conversation = conversation

    async def _send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: str,
        message_id: str,
        headers: dict,
    ) -> None:
        if self.config.provider == 'postmark':
            await self._send_postmark(to, subject, html_body, text_body, message_id, headers)
        elif self.config.provider == 'sendgrid':
            await self._send_sendgrid(to, subject, html_body, text_body, message_id, headers)
        else:
            raise ValueError(f"Unknown email provider: {self.config.provider}")

    async def _send_postmark(
        self, to: str, subject: str, html_body: str, text_body: str,
        message_id: str, headers: dict,
    ) -> None:
        api_key = self.config.provider_api_key
        if not api_key:
            logger.error("[EMAIL] Postmark API key not configured for %s", self.config.inbound_address)
            return

        postmark_headers = []
        for k, v in headers.items():
            postmark_headers.append({"Name": k, "Value": v})

        payload = {
            "From": f"{self.config.from_name} <{self.config.from_address}>",
            "To": to,
            "Subject": subject,
            "HtmlBody": html_body,
            "TextBody": text_body,
            "ReplyTo": self.config.reply_to or self.config.inbound_address,
            "Headers": postmark_headers,
            "MessageStream": "outbound",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.postmarkapp.com/email",
                json=payload,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": api_key,
                },
                timeout=10,
            )
            resp.raise_for_status()
            logger.info("[EMAIL] Sent reply to %s via Postmark", to)

    async def _send_sendgrid(
        self, to: str, subject: str, html_body: str, text_body: str,
        message_id: str, headers: dict,
    ) -> None:
        api_key = self.config.provider_api_key
        if not api_key:
            logger.error("[EMAIL] SendGrid API key not configured for %s", self.config.inbound_address)
            return

        sg_headers = dict(headers)

        payload = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": self.config.from_address, "name": self.config.from_name},
            "reply_to": {"email": self.config.reply_to or self.config.inbound_address},
            "subject": subject,
            "content": [
                {"type": "text/plain", "value": text_body},
                {"type": "text/html", "value": html_body},
            ],
            "headers": sg_headers,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            resp.raise_for_status()
            logger.info("[EMAIL] Sent reply to %s via SendGrid", to)

    # ── HTML formatting ────────────────────────────────────────────────

    def _build_html(self, markdown_text: str, sources: list[dict]) -> str:
        """Convert markdown response + sources into a styled HTML email."""
        content_html = mistune.html(markdown_text)

        sources_html = ""
        if sources:
            items = []
            for s in sources:
                title = s.get("title", "Source")
                url = s.get("url", "")
                if url:
                    items.append(f'<li><a href="{url}" style="color:{self._accent};">{title}</a></li>')
                else:
                    items.append(f'<li>{title}</li>')
            sources_html = f"""
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
                <p style="font-size:13px;font-weight:600;color:#6b7280;margin-bottom:8px;">Sources</p>
                <ul style="margin:0;padding-left:20px;font-size:13px;">{''.join(items)}</ul>
            </div>
            """

        logo_html = ""
        if self.config.logo_url:
            logo_html = f'<img src="{self.config.logo_url}" alt="" style="height:32px;margin-bottom:16px;" />'

        footer_html = ""
        if self.config.footer_text:
            footer_html = f'<p style="font-size:12px;color:#9ca3af;margin-top:24px;">{self.config.footer_text}</p>'

        return f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f9fafb;">
            <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
                {logo_html}
                <div style="background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
                    {content_html}
                    {sources_html}
                </div>
                {footer_html}
            </div>
        </body>
        </html>
        """

    @property
    def _accent(self) -> str:
        return self.config.accent_color or "#2563eb"

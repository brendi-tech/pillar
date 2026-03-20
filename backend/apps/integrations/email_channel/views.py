"""
Email channel integration views.

EmailInboundWebhookView — receives inbound email payloads from Postmark/SendGrid
EmailChannelAdminView  — dashboard management (configure / deactivate)
"""
import logging

from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.products.models import Product
from common.task_router import TaskRouter

from .models import EmailChannelConfiguration

logger = logging.getLogger(__name__)


class EmailInboundWebhookView(APIView):
    """
    Receives inbound email webhooks from Postmark.

    POST /api/integrations/email/inbound/

    Postmark sends JSON with From, To, Subject, TextBody, HtmlBody,
    headers (including Message-ID, In-Reply-To, References), etc.
    Returns 200 immediately and dispatches to Hatchet for async processing.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.data

        to_address = payload.get('ToFull', [{}])
        if isinstance(to_address, list) and to_address:
            to_email = to_address[0].get('Email', '')
        else:
            to_email = payload.get('To', '')

        if not to_email:
            return HttpResponse(status=200)

        try:
            config = EmailChannelConfiguration.objects.select_related(
                'product', 'organization'
            ).get(
                inbound_address=to_email.lower().strip(),
                is_active=True,
            )
        except EmailChannelConfiguration.DoesNotExist:
            logger.warning("[EMAIL] No config for inbound address: %s", to_email)
            return HttpResponse(status=200)

        from_data = payload.get('FromFull', {})
        sender_email = from_data.get('Email', payload.get('From', ''))
        sender_name = from_data.get('Name', '')

        text_body = payload.get('TextBody', '').strip()
        subject = payload.get('Subject', '')

        if not text_body:
            html_body = payload.get('HtmlBody', '')
            if html_body:
                import re
                text_body = re.sub(r'<[^>]+>', '', html_body).strip()

        if not text_body:
            logger.info("[EMAIL] Empty email body from %s, skipping", sender_email)
            return HttpResponse(status=200)

        headers = {h['Name']: h['Value'] for h in payload.get('Headers', [])}
        message_id = headers.get('Message-ID', headers.get('Message-Id', ''))
        in_reply_to = headers.get('In-Reply-To', '')
        references = headers.get('References', '')

        TaskRouter.execute(
            'email-handle-inbound',
            config_id=str(config.id),
            sender_email=sender_email,
            sender_name=sender_name,
            subject=subject,
            text_body=text_body[:10000],
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=references,
        )

        return HttpResponse(status=200)


class EmailChannelAdminView(APIView):
    """
    Admin API for managing email channel configuration.

    GET    /api/admin/products/<id>/integrations/email/ → config status
    DELETE /api/admin/products/<id>/integrations/email/ → deactivate
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        try:
            config = EmailChannelConfiguration.objects.get(
                product=product, is_active=True,
            )
            return JsonResponse({
                'id': str(config.id),
                'inbound_address': config.inbound_address,
                'from_name': config.from_name,
                'from_address': config.from_address,
                'is_active': config.is_active,
                'provider': config.provider,
                'created_at': config.created_at.isoformat(),
            })
        except EmailChannelConfiguration.DoesNotExist:
            return JsonResponse(None, safe=False, status=200)

    def delete(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        updated = EmailChannelConfiguration.objects.filter(
            product=product, is_active=True,
        ).update(is_active=False)
        if updated:
            logger.info("[EMAIL] Deactivated email channel for product %s", product_id)
        return HttpResponse(status=204)

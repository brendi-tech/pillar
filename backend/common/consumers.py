"""
WebSocket consumers for real-time push notifications.
"""
import json
import logging
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

User = get_user_model()


class HelpCenterConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for help center-specific real-time updates.
    
    URL: ws://host/ws/hc/<help_center_config_id>/?token=<jwt_token>
    
    Authenticates via JWT token in query params and verifies user has
    access to the requested help center through their organization membership.
    """
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.help_center_config_id = self.scope['url_route']['kwargs']['help_center_config_id']
        self.hc_group_name = f'hc_{self.help_center_config_id}'
        self.user = None
        
        # Extract JWT token from query params
        query_string = self.scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token_list = query_params.get('token', [])
        
        if not token_list:
            logger.warning(f"WebSocket connection rejected: No token provided for help center {self.help_center_config_id}")
            await self.close(code=4001)  # Custom close code for missing token
            return
        
        token = token_list[0]
        
        # Authenticate user via JWT
        try:
            user = await self.authenticate_token(token)
            if not user:
                logger.warning(f"WebSocket connection rejected: Invalid token for help center {self.help_center_config_id}")
                await self.close(code=4002)  # Custom close code for invalid token
                return
            
            self.user = user
        except (TokenError, InvalidToken) as e:
            logger.warning(f"WebSocket connection rejected: Token error for help center {self.help_center_config_id}: {e}")
            await self.close(code=4002)
            return
        
        # Verify user has access to this help center
        has_access = await self.verify_help_center_access(user, self.help_center_config_id)
        if not has_access:
            logger.warning(
                f"WebSocket connection rejected: User {user.email} does not have access to help center {self.help_center_config_id}"
            )
            await self.close(code=4003)  # Custom close code for unauthorized
            return
        
        try:
            await self.channel_layer.group_add(
                self.hc_group_name,
                self.channel_name
            )
        except Exception as e:
            logger.error(
                f"Failed to join channel group {self.hc_group_name}: {e}"
            )
            await self.close(code=1011)
            return
        
        await self.accept()
        logger.info(f"WebSocket connected: User {user.email} joined help center {self.help_center_config_id}")
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection.established',
            'help_center_config_id': self.help_center_config_id,
            'message': 'WebSocket connection established'
        }))
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'hc_group_name'):
            try:
                await self.channel_layer.group_discard(
                    self.hc_group_name,
                    self.channel_name
                )
            except Exception as e:
                logger.warning(
                    f"Failed to discard channel from group {self.hc_group_name}: {e}"
                )
        
        if self.user:
            logger.info(
                f"WebSocket disconnected: User {self.user.email} left help center {self.help_center_config_id} "
                f"(code: {close_code})"
            )
    
    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages from client.
        Currently not used - this is a push-only connection.
        """
        # Could be used for client->server messages if needed in the future
        pass
    
    async def push_event(self, event):
        """
        Handle push events sent from the push service.
        
        This is called when push.send() is invoked from anywhere in the app.
        """
        # Send event to WebSocket client
        await self.send(text_data=json.dumps({
            'type': event['event_type'],
            'data': event['data'],
        }))
    
    @database_sync_to_async
    def authenticate_token(self, token_string):
        """
        Authenticate JWT token and return user.
        
        Args:
            token_string: JWT token string
            
        Returns:
            User object if valid, None otherwise
        """
        try:
            # Validate and decode token
            token = AccessToken(token_string)
            user_id = token['user_id']
            
            # Get user from database
            user = User.objects.get(id=user_id, is_active=True)
            return user
        except (TokenError, InvalidToken, User.DoesNotExist) as e:
            logger.debug(f"Token authentication failed: {e}")
            return None
    
    @database_sync_to_async
    def verify_help_center_access(self, user, help_center_config_id):
        """
        Verify that user has access to the help center through organization membership.
        
        Args:
            user: User object
            help_center_config_id: HelpCenterConfig UUID
            
        Returns:
            True if user has access, False otherwise
        """
        try:
            from apps.products.models import Product
            
            # Get user's organizations
            user_org_ids = user.organizations.values_list('id', flat=True)
            
            # Check if product belongs to any of user's organizations
            product_exists = Product.objects.filter(
                id=help_center_config_id,
                organization_id__in=user_org_ids
            ).exists()
            
            return product_exists
        except Exception as e:
            logger.error(f"Error verifying help center access: {e}")
            return False





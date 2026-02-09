"""
WebSocket URL routing for Django Channels.
"""
from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/hc/(?P<help_center_config_id>[0-9a-f-]+)/$', consumers.HelpCenterConsumer.as_asgi()),
]





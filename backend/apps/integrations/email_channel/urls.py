from django.urls import path

from . import views

urlpatterns = [
    path('inbound/', views.EmailInboundWebhookView.as_view(), name='email-inbound'),
]

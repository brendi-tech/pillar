from django.urls import path

from . import views

urlpatterns = [
    path('install/', views.DiscordInstallView.as_view(), name='discord-install'),
    path('callback/', views.DiscordCallbackView.as_view(), name='discord-callback'),
    path('interactions/', views.DiscordInteractionsView.as_view(), name='discord-interactions'),
]

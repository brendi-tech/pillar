from django.urls import path

from . import views

urlpatterns = [
    path('install/', views.SlackInstallView.as_view(), name='slack-install'),
    path('callback/', views.SlackCallbackView.as_view(), name='slack-callback'),
    path('events/', views.SlackEventsView.as_view(), name='slack-events'),
    path('commands/', views.SlackCommandView.as_view(), name='slack-commands'),
    path('interactions/', views.SlackInteractionsView.as_view(), name='slack-interactions'),
]

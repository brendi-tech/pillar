"""Minimal URL config for identity view tests (avoids loading full config/urls.py)."""
from django.urls import include, path

urlpatterns = [
    path('api/public/identity/', include('apps.identity.urls_public')),
    path('api/admin/identity/', include('apps.identity.urls_admin')),
]

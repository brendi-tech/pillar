"""
URL patterns for users app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views.password_reset import PasswordResetConfirmView, PasswordResetRequestView

router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'organizations', views.OrganizationViewSet, basename='organization')

urlpatterns = [
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('', include(router.urls)),
]

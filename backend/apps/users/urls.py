"""
URL patterns for users app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'organizations', views.OrganizationViewSet, basename='organization')

urlpatterns = [
    path('', include(router.urls)),
]

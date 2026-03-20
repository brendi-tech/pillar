from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.identity.admin_views import IdentityMappingViewSet

router = DefaultRouter()
router.register(r'mappings', IdentityMappingViewSet, basename='identity-mapping')

urlpatterns = [
    path('', include(router.urls)),
]

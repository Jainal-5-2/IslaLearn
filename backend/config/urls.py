"""
URL configuration for config project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/", include("apps.topics.urls")),
    path("api/", include("apps.requests.urls")),
    path("api/", include("apps.broadcasts.urls")),
    path("api/", include("apps.sessions.urls")),
    path("api/", include("apps.reports.urls")),
    path("api/", include("apps.users.public_urls")),
]

# Serve media files during development (for profile pictures, etc.)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

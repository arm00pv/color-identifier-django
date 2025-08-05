from django.contrib import admin
from django.urls import path, include
from color_identifier import views as color_views # Import views from your app

urlpatterns = [
    path('admin/', admin.site.urls),
    # API URLs
    path('api/', include('color_identifier.urls')),
    # Frontend URL - This should be the last entry
    path('', color_views.frontend, name='frontend'),
]
 
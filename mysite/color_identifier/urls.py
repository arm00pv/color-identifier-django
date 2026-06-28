from django.urls import path
from . import views

urlpatterns = [
    path('', views.frontend, name='frontend'),
    path('api/identify/image/', views.IdentifyFromImageAPI.as_view(), name='identify_image'),
    path('api/identify/live/', views.IdentifyFromLiveAPI.as_view(), name='identify_live'),
    path('api/identify/rgb/', views.IdentifyFromRgbAPI.as_view(), name='identify_rgb'),
    path('api/task/<str:task_id>/', views.TaskStatusAPI.as_view(), name='task_status'),
    path('api/history/', views.ScanHistoryAPI.as_view(), name='scan_history'),
]

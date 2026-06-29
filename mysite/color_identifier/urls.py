from django.urls import path
from .views import (
    UploadImageAPI, TaskStatusAPI, IdentifyFromRgbAPI, ScanHistoryAPI,
    RegisterAPI, SubscriptionCheckAPI
)

urlpatterns = [
    path('identify/image/', UploadImageAPI.as_view(), name='identify_image'),
    path('identify/rgb/', IdentifyFromRgbAPI.as_view(), name='identify_rgb'),
    path('task/<str:task_id>/', TaskStatusAPI.as_view(), name='task_status'),
    path('history/', ScanHistoryAPI.as_view(), name='scan_history'),
    path('register/', RegisterAPI.as_view(), name='register'),
    path('subscription/check/', SubscriptionCheckAPI.as_view(), name='sub_check'),
]

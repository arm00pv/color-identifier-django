from django.urls import path
from . import views

urlpatterns = [
    # This URL will be for the image upload function
    path('identify-image/', views.identify_from_image, name='identify_from_image'),
    
    # This URL will be for the live camera function
    path('identify-live/', views.identify_from_live, name='identify_from_live'),

    path('identify-rgb/', views.identify_from_rgb, name='identify_from_rgb'),
]

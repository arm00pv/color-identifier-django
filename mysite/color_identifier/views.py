from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import render
from django.core.files.storage import default_storage
from django.contrib.auth.models import User
import base64
from io import BytesIO
import uuid
import os

from .serializers import ImageUploadSerializer, Base64ImageSerializer, RGBSerializer, ScanSerializer
from .models import Scan, UserProfile
from .color_logic import color_identifier
from .tasks import identify_dominant_colors_task
from celery.result import AsyncResult

def frontend(request):
    return render(request, 'index.html')

class IdentifyFromImageAPI(APIView):
    def post(self, request):
        serializer = ImageUploadSerializer(data=request.data)
        if serializer.is_valid():
            image_file = request.FILES['image']
            file_path = default_storage.save(f"tmp_{uuid.uuid4()}.jpg", image_file)
            full_path = default_storage.path(file_path)
            
            user_id = request.user.id if request.user.is_authenticated else None
            task = identify_dominant_colors_task.delay(full_path, n_colors=5, user_id=user_id)
            return Response({'task_id': task.id, 'status': 'processing'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class IdentifyFromLiveAPI(APIView):
    def post(self, request):
        serializer = Base64ImageSerializer(data=request.data)
        if serializer.is_valid():
            try:
                image_data_str = serializer.validated_data['image']
                header, encoded = image_data_str.split(';base64,', 1)
                image_bytes = base64.b64decode(encoded)
                
                file_path = default_storage.path(f"tmp_live_{uuid.uuid4()}.jpg")
                with open(file_path, 'wb') as f:
                    f.write(image_bytes)
                    
                user_id = request.user.id if request.user.is_authenticated else None
                task = identify_dominant_colors_task.delay(file_path, n_colors=1, user_id=user_id)
                return Response({'task_id': task.id, 'status': 'processing'})
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TaskStatusAPI(APIView):
    def get(self, request, task_id):
        result = AsyncResult(task_id)
        if result.ready():
            return Response({'status': 'completed', 'colors': result.result})
        return Response({'status': 'pending'})


class RegisterAPI(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({'error': 'Missing credentials'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'User exists'}, status=400)
        
        user = User.objects.create_user(username=username, password=password)
        return Response({'status': 'success', 'user_id': user.id})

class SubscriptionCheckAPI(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        profile = request.user.profile
        return Response({
            'is_premium': profile.is_premium,
            'free_scans_this_month': profile.free_scans_this_month
        })
        
    def post(self, request):
        # Action to consume a scan
        action = request.data.get('action')
        profile = request.user.profile
        
        if profile.is_premium:
            return Response({'allowed': True})
            
        if action == 'live_feed':
            return Response({'allowed': False, 'error': 'Live feed requires Premium subscription.'}, status=403)
            
        if action == 'photo_scan':
            if profile.free_scans_this_month >= 5:
                return Response({'allowed': False, 'error': 'Monthly limit of 5 scans reached. Please upgrade to Premium.'}, status=403)
            profile.free_scans_this_month += 1
            profile.save()
            return Response({'allowed': True, 'remaining': 5 - profile.free_scans_this_month})
            
        return Response({'error': 'Unknown action'}, status=400)

class IdentifyFromRgbAPI(APIView):
    def post(self, request):
        serializer = RGBSerializer(data=request.data)
        if serializer.is_valid():
            rgb = (
                serializer.validated_data['r'],
                serializer.validated_data['g'],
                serializer.validated_data['b']
            )
            color_name = color_identifier.get_color_name(rgb)
            hex_code = '#%02x%02x%02x' % rgb
            
            if request.user.is_authenticated:
                Scan.objects.create(user=request.user, color_name=color_name, hex_code=hex_code)
                
            return Response({'name': color_name, 'hex': hex_code})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ScanHistoryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        scans = Scan.objects.filter(user=request.user).order_by('-timestamp')[:50]
        serializer = ScanSerializer(scans, many=True)
        return Response(serializer.data)
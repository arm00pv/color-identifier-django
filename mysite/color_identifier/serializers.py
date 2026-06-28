from rest_framework import serializers
from django.core.validators import FileExtensionValidator

class ImageUploadSerializer(serializers.Serializer):
    image = serializers.ImageField(
        max_length=None,
        allow_empty_file=False,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png'])]
    )
    
    def validate_image(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Image file too large ( > 5mb )")
        return value

class Base64ImageSerializer(serializers.Serializer):
    image = serializers.CharField(required=True)

class RGBSerializer(serializers.Serializer):
    r = serializers.IntegerField(min_value=0, max_value=255)
    g = serializers.IntegerField(min_value=0, max_value=255)
    b = serializers.IntegerField(min_value=0, max_value=255)

from .models import Scan

class ScanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scan
        fields = ['id', 'color_name', 'hex_code', 'timestamp']

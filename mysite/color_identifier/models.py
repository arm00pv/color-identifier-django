from django.db import models
from django.contrib.auth.models import User

class Scan(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scans')
    color_name = models.CharField(max_length=100)
    hex_code = models.CharField(max_length=7)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} scanned {self.color_name} at {self.timestamp}"

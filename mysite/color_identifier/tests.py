from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
import tempfile
from PIL import Image
from unittest.mock import patch

class ColorIdentifierAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_identify_rgb(self):
        url = reverse('identify_rgb')
        data = {'r': 255, 'g': 0, 'b': 0}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['hex'], '#ff0000')

    @patch('color_identifier.views.identify_dominant_colors_task.delay')
    def test_identify_image(self, mock_task):
        mock_task.return_value.id = 'mocked-task-id'
        
        url = reverse('identify_image')
        # Create a dummy image
        image = Image.new('RGB', (100, 100), color='red')
        tmp_file = tempfile.NamedTemporaryFile(suffix='.jpg')
        image.save(tmp_file, format='JPEG')
        tmp_file.seek(0)
        
        with open(tmp_file.name, 'rb') as f:
            response = self.client.post(url, {'image': f}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['task_id'], 'mocked-task-id')

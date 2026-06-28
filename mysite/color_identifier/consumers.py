import json
import base64
from io import BytesIO
from PIL import Image
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .color_logic import color_identifier

class LiveColorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data:
            try:
                # Fast processing of binary frame
                image = Image.open(BytesIO(bytes_data)).convert('RGB')
                # For live feed, we just take the center pixel or very fast dominant colors
                width, height = image.size
                
                # Let's do a fast KMeans on a very small thumbnail (50x50) to ensure low latency
                image.thumbnail((50, 50))
                
                temp_file = BytesIO()
                image.save(temp_file, format='JPEG')
                temp_file.seek(0)
                
                # Wrap sync color logic
                @sync_to_async
                def process_frame():
                    return color_identifier.get_dominant_colors(temp_file, n_colors=1)
                
                results = await process_frame()
                
                if results:
                    await self.send(text_data=json.dumps({
                        'status': 'success',
                        'colors': results
                    }))
            except Exception as e:
                await self.send(text_data=json.dumps({'error': str(e)}))

from django.shortcuts import render

def frontend(request):
    """Serves the frontend index.html file."""
    return render(request, 'index.html')

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .color_logic import color_identifier # Import our global instance
import base64
from io import BytesIO
from PIL import Image
import json
# The color_identifier instance is already loaded and the model is trained.

@csrf_exempt # For simplicity in this API. In a production app with user logins, you'd handle CSRF properly.
def identify_from_image(request):
    """
    This view handles color identification from an uploaded image file.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)

    if 'image' not in request.FILES:
        return JsonResponse({'error': 'No image file provided in the request'}, status=400)
    
    image_file = request.FILES['image']
    
    try:
        # Pass the uploaded image file directly to our color logic handler
        dominant_colors = color_identifier.get_dominant_colors(image_file, n_colors=5)
        # Return the results as a JSON object
        return JsonResponse({'colors': dominant_colors})
    except Exception as e:
        # Return a server error if anything goes wrong during processing
        return JsonResponse({'error': f'An error occurred: {str(e)}'}, status=500)

@csrf_exempt
def identify_from_live(request):
    """
    This view handles color identification from a base64-encoded image string,
    which is what we'll get from the live camera feed.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)

    # The image data comes in the body of the request
    image_data_str = request.POST.get('image')
    if not image_data_str:
        return JsonResponse({'error': 'No image data in the request body'}, status=400)
    
    try:
        # The image data is a base64 string with a header, like "data:image/jpeg;base64,..."
        # We need to strip the header to get just the base64 data
        header, encoded = image_data_str.split(';base64,', 1)
        
        # Decode the base64 string into bytes
        image_bytes = base64.b64decode(encoded)
        
        # Create an in-memory file-like object from the bytes
        image_file = BytesIO(image_bytes)
        
        # Pass the in-memory image to our color logic handler.
        # We only ask for 1 color to keep the live feed responsive.
        dominant_colors = color_identifier.get_dominant_colors(image_file, n_colors=1)
        
        return JsonResponse({'colors': dominant_colors})
    except Exception as e:
        return JsonResponse({'error': f'Error processing live frame: {str(e)}'}, status=500)

@csrf_exempt
def identify_from_rgb(request):
    """
    Identifies a color from a single RGB value.
    This is much faster for real-time analysis.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        r, g, b = int(data['r']), int(data['g']), int(data['b'])
        
        if not (0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255):
            return JsonResponse({'error': 'Invalid RGB values'}, status=400)
            
        rgb_tuple = (r, g, b)
        color_name = color_identifier.get_color_name(rgb_tuple)
        hex_code = '#%02x%02x%02x' % rgb_tuple
        
        return JsonResponse({'name': color_name, 'hex': hex_code})
    except (KeyError, json.JSONDecodeError):
        return JsonResponse({'error': 'Invalid JSON data. Expecting {"r":, "g":, "b":}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'An error occurred: {str(e)}'}, status=500)
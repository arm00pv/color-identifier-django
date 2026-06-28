import os
from celery import shared_task
from .color_logic import color_identifier

@shared_task
def identify_dominant_colors_task(image_path, n_colors=5, user_id=None):
    try:
        results = color_identifier.get_dominant_colors(image_path, n_colors=n_colors)
        
        # Save to history if user_id is provided
        if user_id:
            from django.contrib.auth.models import User
            from .models import Scan
            user = User.objects.get(id=user_id)
            for res in results:
                Scan.objects.create(
                    user=user,
                    color_name=res['name'],
                    hex_code=res['hex']
                )
        return results
    except Exception as e:
        import traceback
        return {'error': str(e), 'trace': traceback.format_exc()}
    finally:
        # Cleanup temp file to avoid disk space time bomb
        if os.path.exists(image_path):
            os.remove(image_path)

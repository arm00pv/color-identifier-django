import pandas as pd
from sklearn.cluster import KMeans
from sklearn.neighbors import KNeighborsClassifier
from PIL import Image
import numpy as np
import os
from pathlib import Path
import joblib
from skimage.color import rgb2lab

class ColorIdentifier:
    def __init__(self, color_data_path, model_path):
        self.color_data_path = color_data_path
        self.model_path = model_path
        self.knn = None
        self._load_or_train_model()

    def _rgb_to_lab_array(self, rgb_array):
        # skimage rgb2lab expects values in [0, 1] or shape with [..., 3]
        # and RGB should be scaled to [0, 1] for best results with rgb2lab
        rgb_normalized = np.array(rgb_array, dtype=np.float64) / 255.0
        # rgb2lab requires a 3D array (image) or 2D array if reshaped correctly, 
        # let's reshape to (1, N, 3) to be safe for a list of pixels.
        orig_shape = rgb_normalized.shape
        if len(orig_shape) == 1:
            rgb_normalized = rgb_normalized.reshape(1, 1, 3)
        elif len(orig_shape) == 2:
            rgb_normalized = rgb_normalized.reshape(1, orig_shape[0], 3)
            
        lab = rgb2lab(rgb_normalized)
        
        if len(orig_shape) == 1:
            return lab.reshape(3)
        elif len(orig_shape) == 2:
            return lab.reshape(orig_shape[0], 3)
        return lab

    def _load_or_train_model(self):
        if os.path.exists(self.model_path):
            self.knn = joblib.load(self.model_path)
            print("Loaded pre-trained LAB KNN model.")
        else:
            print("Training LAB KNN model...")
            if not os.path.exists(self.color_data_path):
                raise FileNotFoundError(f"Color data file not found at: {self.color_data_path}")
            
            color_df = pd.read_csv(self.color_data_path)
            X_rgb = color_df[['R', 'G', 'B']].values
            
            # Convert training data to LAB
            X_lab = self._rgb_to_lab_array(X_rgb)
            y = color_df['Name'].values
            
            self.knn = KNeighborsClassifier(n_neighbors=1)
            self.knn.fit(X_lab, y)
            joblib.dump(self.knn, self.model_path)
            print(f"LAB KNN model trained and saved to {self.model_path}.")

    def get_color_name(self, rgb_tuple):
        lab_val = self._rgb_to_lab_array(np.array(rgb_tuple))
        prediction = self.knn.predict([lab_val])
        return prediction[0]

    def get_dominant_colors(self, image_file, n_colors=12):
        img = Image.open(image_file).convert('RGB')
        # Validate size roughly or just downscale fast
        img.thumbnail((400, 400))
        
        pixels = np.array(img).reshape(-1, 3)
        
        # Fast KMeans on RGB space for dominant colors
        # (Could do it in LAB, but RGB is usually fine for KMeans extraction speed)
        kmeans = KMeans(n_clusters=n_colors, n_init=10, random_state=42)
        kmeans.fit(pixels)
        
        dominant_colors_rgb = kmeans.cluster_centers_.astype(int)
        
        results = []
        for rgb in dominant_colors_rgb:
            # Clamp values to valid RGB range [0, 255] just in case
            rgb_clamped = np.clip(rgb, 0, 255)
            color_name = self.get_color_name(tuple(rgb_clamped))
            hex_code = '#%02x%02x%02x' % tuple(rgb_clamped)
            
            results.append({
                'name': color_name,
                'hex': hex_code,
                'rgb': [int(c) for c in rgb_clamped]
            })
            
        return results

BASE_DIR = Path(__file__).resolve().parent.parent
CSV_FILE_PATH = BASE_DIR / 'colors.csv'
# Use a different model file name to force retraining in LAB space
MODEL_FILE_PATH = BASE_DIR / 'lab_knn_model.joblib'

color_identifier = ColorIdentifier(CSV_FILE_PATH, MODEL_FILE_PATH)

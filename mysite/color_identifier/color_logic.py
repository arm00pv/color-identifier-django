# color_project/color_identifier/color_logic.py
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.neighbors import KNeighborsClassifier
from PIL import Image
import numpy as np
import os
from pathlib import Path

class ColorIdentifier:
    def __init__(self, color_data_path):
        if not os.path.exists(color_data_path):
            raise FileNotFoundError(f"Color data file not found at: {color_data_path}")
            
        self.color_df = pd.read_csv(color_data_path)
        
        X = self.color_df[['R', 'G', 'B']]
        y = self.color_df['Name']
        
        self.knn = KNeighborsClassifier(n_neighbors=1)
        self.knn.fit(X, y)
        print("ColorIdentifier initialized and KNN model trained.")

    def get_color_name(self, rgb_tuple):
        prediction = self.knn.predict([rgb_tuple])
        return prediction[0]

    def get_dominant_colors(self, image_file, n_colors=12):
        """
        Finds the N most dominant colors in an image file.
        """
        img = Image.open(image_file).convert('RGB')
        # Using a larger thumbnail provides more data for a more accurate analysis.
        img.thumbnail((200, 200)) 
        
        pixels = np.array(img).reshape(-1, 3)
        
        # **ACCURACY**: Using 'auto' (which defaults to 10) runs the algorithm
        # more times to find a better, more accurate result.
        kmeans = KMeans(n_clusters=n_colors, n_init='auto', random_state=42)
        kmeans.fit(pixels)
        
        dominant_colors_rgb = kmeans.cluster_centers_.astype(int)
        
        results = []
        for rgb in dominant_colors_rgb:
            color_name = self.get_color_name(tuple(rgb))
            hex_code = '#%02x%02x%02x' % tuple(rgb)
            
            results.append({
                'name': color_name,
                'hex': hex_code,
                'rgb': [int(c) for c in rgb]
            })
            
        return results

# --- Global Instance ---
BASE_DIR = Path(__file__).resolve().parent.parent
CSV_FILE_PATH = BASE_DIR / 'colors.csv'

color_identifier = ColorIdentifier(CSV_FILE_PATH)

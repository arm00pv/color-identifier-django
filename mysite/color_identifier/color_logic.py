# color_project/color_identifier/color_logic.py
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.neighbors import KNeighborsClassifier
from PIL import Image
import numpy as np
import os

class ColorIdentifier:
    def __init__(self, color_data_path):
        # Ensure the file path is correct, assuming it's in the project root
        if not os.path.exists(color_data_path):
            raise FileNotFoundError(f"Color data file not found at: {color_data_path}")
            
        # Load the color data and train the KNN model
        self.color_df = pd.read_csv(color_data_path)
        
        # Prepare data for KNN model (features are R,G,B values)
        X = self.color_df[['R', 'G', 'B']]
        # The target is the color name
        y = self.color_df['Name']
        
        # Initialize and train the K-Nearest Neighbors model.
        # n_neighbors=1 means we find the single closest color name.
        self.knn = KNeighborsClassifier(n_neighbors=1)
        self.knn.fit(X, y)
        print("ColorIdentifier initialized and KNN model trained.")

    def get_color_name(self, rgb_tuple):
        """
        Predicts the color name for a given RGB tuple using the trained KNN model.
        """
        # The model expects a list of samples, so we pass the tuple in a list
        prediction = self.knn.predict([rgb_tuple])
        return prediction[0]

    def get_dominant_colors(self, image_file, n_colors=5):
        """
        Finds the N most dominant colors in an image file.
        """
        # Open the image and convert it to RGB format
        img = Image.open(image_file).convert('RGB')
        # Resize the image to a small thumbnail for much faster processing
        img.thumbnail((100, 100))
        
        # Convert the image into a flat list of RGB pixels
        pixels = np.array(img).reshape(-1, 3)
        
        # Use KMeans clustering to find the 'n_colors' most common color groups
        kmeans = KMeans(n_clusters=n_colors, n_init=10, random_state=42)
        kmeans.fit(pixels)
        
        # The cluster centers are the average RGB values of the dominant colors
        dominant_colors_rgb = kmeans.cluster_centers_.astype(int)
        
        results = []
        for rgb in dominant_colors_rgb:
            # For each dominant RGB value, find its closest named color
            color_name = self.get_color_name(tuple(rgb))
            # Convert the RGB tuple to a hex code for display
            hex_code = '#%02x%02x%02x' % tuple(rgb)
            results.append({
                'name': color_name,
                'hex': hex_code,
                'rgb': list(rgb)
            })
            
        return results

# --- Global Instance ---
# Get the base directory of the Django project
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Construct the path to the colors.csv file
CSV_FILE_PATH = os.path.join(BASE_DIR, 'colors.csv')

# Create a single, global instance of the ColorIdentifier.
# This is crucial for performance, as the model will only be trained once
# when the Django server starts, not on every request.
color_identifier = ColorIdentifier(CSV_FILE_PATH)

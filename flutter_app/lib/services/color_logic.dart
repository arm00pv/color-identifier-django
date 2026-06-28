import 'dart:math';
import 'package:flutter/services.dart' show rootBundle;
import 'package:csv/csv.dart';
import 'package:flutter/material.dart';

class ColorData {
  final String name;
  final String hex;
  final int r, g, b;
  final List<double> lab;

  ColorData({required this.name, required this.hex, required this.r, required this.g, required this.b, required this.lab});
}

class ColorLogic {
  static List<ColorData> _colorDataset = [];
  static bool _isLoaded = false;

  static Future<void> init() async {
    if (_isLoaded) return;
    
    final csvString = await rootBundle.loadString('assets/colors.csv');
    List<List<dynamic>> rows = const CsvToListConverter().convert(csvString);
    
    // Skip header
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      int r = row[3] is int ? row[3] : int.tryParse(row[3].toString()) ?? 0;
      int g = row[4] is int ? row[4] : int.tryParse(row[4].toString()) ?? 0;
      int b = row[5] is int ? row[5] : int.tryParse(row[5].toString()) ?? 0;
      
      _colorDataset.add(ColorData(
        name: row[1].toString(),
        hex: row[2].toString(),
        r: r,
        g: g,
        b: b,
        lab: rgbToLab(r, g, b),
      ));
    }
    _isLoaded = true;
  }

  static double _pivotRgb(double n) {
    return (n > 0.04045) ? pow((n + 0.055) / 1.055, 2.4).toDouble() : n / 12.92;
  }

  static double _pivotXyz(double n) {
    return (n > 0.008856) ? pow(n, 1.0/3.0).toDouble() : (7.787 * n) + (16.0 / 116.0);
  }

  static List<double> rgbToLab(int r, int g, int b) {
    // RGB to XYZ
    double rN = _pivotRgb(r / 255.0) * 100.0;
    double gN = _pivotRgb(g / 255.0) * 100.0;
    double bN = _pivotRgb(b / 255.0) * 100.0;

    double x = rN * 0.4124 + gN * 0.3576 + bN * 0.1805;
    double y = rN * 0.2126 + gN * 0.7152 + bN * 0.0722;
    double z = rN * 0.0193 + gN * 0.1192 + bN * 0.9505;

    // XYZ to LAB
    // Illuminant D65
    double refX = 95.047;
    double refY = 100.000;
    double refZ = 108.883;

    double xN = _pivotXyz(x / refX);
    double yN = _pivotXyz(y / refY);
    double zN = _pivotXyz(z / refZ);

    double L = max(0, (116.0 * yN) - 16.0);
    double A = 500.0 * (xN - yN);
    double B = 200.0 * (yN - zN);

    return [L, A, B];
  }

  static double deltaE(List<double> lab1, List<double> lab2) {
    // Standard Euclidean distance in LAB space
    double dL = lab1[0] - lab2[0];
    double da = lab1[1] - lab2[1];
    double db = lab1[2] - lab2[2];
    return sqrt(dL*dL + da*da + db*db);
  }

  static ColorData getNearestColor(int r, int g, int b) {
    if (!_isLoaded) throw Exception("Dataset not loaded");
    
    List<double> targetLab = rgbToLab(r, g, b);
    
    double minDistance = double.infinity;
    ColorData? bestMatch;
    
    for (var color in _colorDataset) {
      double dist = deltaE(targetLab, color.lab);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = color;
      }
    }
    
    return bestMatch!;
  }

  // Simple KMeans for dominant colors
  static List<ColorData> getDominantColors(List<List<int>> pixels, {int k = 5, int maxIterations = 5}) {
    if (pixels.isEmpty) return [];
    
    Random rand = Random(42);
    // Initialize centroids randomly
    List<List<double>> centroids = [];
    for (int i = 0; i < k; i++) {
      var p = pixels[rand.nextInt(pixels.length)];
      centroids.add([p[0].toDouble(), p[1].toDouble(), p[2].toDouble()]);
    }
    
    List<int> assignments = List.filled(pixels.length, 0);
    
    for (int iter = 0; iter < maxIterations; iter++) {
      // Assign
      for (int i = 0; i < pixels.length; i++) {
        double minDist = double.infinity;
        int bestCluster = 0;
        for (int c = 0; c < k; c++) {
          double dist = _rgbDistSquared(pixels[i], centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = c;
          }
        }
        assignments[i] = bestCluster;
      }
      
      // Update
      List<List<double>> newCentroids = List.generate(k, (_) => [0.0, 0.0, 0.0]);
      List<int> counts = List.filled(k, 0);
      
      for (int i = 0; i < pixels.length; i++) {
        int cluster = assignments[i];
        newCentroids[cluster][0] += pixels[i][0];
        newCentroids[cluster][1] += pixels[i][1];
        newCentroids[cluster][2] += pixels[i][2];
        counts[cluster]++;
      }
      
      for (int c = 0; c < k; c++) {
        if (counts[c] > 0) {
          centroids[c][0] = newCentroids[c][0] / counts[c];
          centroids[c][1] = newCentroids[c][1] / counts[c];
          centroids[c][2] = newCentroids[c][2] / counts[c];
        }
      }
    }
    
    List<ColorData> results = [];
    for (var c in centroids) {
      results.add(getNearestColor(c[0].toInt().clamp(0, 255), c[1].toInt().clamp(0, 255), c[2].toInt().clamp(0, 255)));
    }
    
    // Remove duplicates based on name
    var uniqueResults = <String, ColorData>{};
    for (var r in results) {
      uniqueResults[r.name] = r;
    }
    
    return uniqueResults.values.toList();
  }

  static double _rgbDistSquared(List<int> p1, List<double> p2) {
    double dr = p1[0] - p2[0];
    double dg = p1[1] - p2[1];
    double db = p1[2] - p2[2];
    return dr*dr + dg*dg + db*db;
  }
}

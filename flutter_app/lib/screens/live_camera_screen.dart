import 'dart:async';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import '../services/color_logic.dart';

class LiveCameraScreen extends StatefulWidget {
  const LiveCameraScreen({super.key});

  @override
  State<LiveCameraScreen> createState() => _LiveCameraScreenState();
}

class _LiveCameraScreenState extends State<LiveCameraScreen> {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  bool _isProcessing = false;
  ColorData? _centerColor;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isNotEmpty) {
        _controller = CameraController(_cameras[0], ResolutionPreset.low, enableAudio: false);
        await _controller!.initialize();
        if (!mounted) return;
        
        setState(() {});

        _controller!.startImageStream((CameraImage image) {
          if (!_isProcessing) {
            _processCameraImage(image);
          }
        });
      }
    } catch (e) {
      debugPrint("Camera Error: $e");
    }
  }

  Future<void> _processCameraImage(CameraImage image) async {
    _isProcessing = true;
    try {
      if (image.format.group == ImageFormatGroup.yuv420) {
        // Fast center pixel extraction for Android
        final int width = image.width;
        final int height = image.height;
        final int uvRowStride = image.planes[1].bytesPerRow;
        final int uvPixelStride = image.planes[1].bytesPerPixel ?? 1;

        final int x = width ~/ 2;
        final int y = height ~/ 2;

        final int uvIndex = uvPixelStride * (x ~/ 2) + uvRowStride * (y ~/ 2);
        final int index = y * width + x;

        final yp = image.planes[0].bytes[index];
        final up = image.planes[1].bytes[uvIndex];
        final vp = image.planes[2].bytes[uvIndex];

        int r = (yp + vp * 1436 / 1024 - 179).round().clamp(0, 255);
        int g = (yp - up * 46549 / 131072 + 44 - vp * 93604 / 131072 + 91).round().clamp(0, 255);
        int b = (yp + up * 1814 / 1024 - 227).round().clamp(0, 255);

        final result = ColorLogic.getNearestColor(r, g, b);
        setState(() {
          _centerColor = result;
        });
      } else if (image.format.group == ImageFormatGroup.bgra8888) {
        // Fast center pixel extraction for iOS
        final int width = image.width;
        final int height = image.height;
        final int x = width ~/ 2;
        final int y = height ~/ 2;
        
        final int index = (y * width + x) * 4;
        final int b = image.planes[0].bytes[index];
        final int g = image.planes[0].bytes[index+1];
        final int r = image.planes[0].bytes[index+2];

        final result = ColorLogic.getNearestColor(r, g, b);
        setState(() {
          _centerColor = result;
        });
      }
    } catch (e) {
      debugPrint("Process Error: $e");
    } finally {
      // Throttle slightly
      await Future.delayed(const Duration(milliseconds: 100));
      _isProcessing = false;
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null || !_controller!.value.isInitialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    
    return Scaffold(
      appBar: AppBar(title: const Text('Live Edge AI Feed')),
      body: Stack(
        children: [
          Positioned.fill(
            child: CameraPreview(_controller!),
          ),
          // Crosshair
          const Center(
            child: Icon(Icons.add, color: Colors.white, size: 50),
          ),
          Positioned(
            bottom: 30,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.7),
                borderRadius: BorderRadius.circular(15),
              ),
              child: _centerColor != null
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircleAvatar(
                          backgroundColor: _hexToColor(_centerColor!.hex),
                          radius: 20,
                        ),
                        const SizedBox(width: 15),
                        Text(
                          _centerColor!.name,
                          style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                        ),
                      ],
                    )
                  : const Text('Scanning...', style: TextStyle(color: Colors.white), textAlign: TextAlign.center),
            ),
          )
        ],
      ),
    );
  }
}

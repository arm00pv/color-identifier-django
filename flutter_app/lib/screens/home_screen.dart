import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb, compute;
import 'package:image/image.dart' as img;
import 'live_camera_screen.dart';
import '../services/color_logic.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  File? _image;
  final ImagePicker _picker = ImagePicker();
  bool _isLoading = false;
  List<ColorData> _colors = [];

  Future<void> _pickImage(ImageSource source) async {
    final XFile? pickedFile = await _picker.pickImage(source: source);
    if (pickedFile != null) {
      setState(() {
        _image = File(pickedFile.path);
        _colors = [];
        _isLoading = true;
      });
      final bytes = await pickedFile.readAsBytes();
      // Run heavy image processing in a background isolate
      final resultColors = await compute(_processImageBytes, bytes);
      
      setState(() {
        _colors = resultColors;
        _isLoading = false;
      });
    }
  }

  // Must be static/top-level for compute
  static List<ColorData> _processImageBytes(Uint8List bytes) {
    final decodedImage = img.decodeImage(bytes);
    if (decodedImage == null) return [];
    
    // Resize for faster processing
    final smallImage = img.copyResize(decodedImage, width: 100);
    List<List<int>> pixels = [];
    
    for (int y = 0; y < smallImage.height; y++) {
      for (int x = 0; x < smallImage.width; x++) {
        final pixel = smallImage.getPixel(x, y);
        pixels.add([pixel.r.toInt(), pixel.g.toInt(), pixel.b.toInt()]);
      }
    }
    
    return ColorLogic.getDominantColors(pixels, k: 5);
  }

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Standalone Edge AI App')),
      body: Center(
        child: SingleChildScrollView(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_image != null && !kIsWeb)
                Image.file(_image!, height: 300)
              else if (_image != null && kIsWeb)
                const Text("Image uploaded on Web", style: TextStyle(fontSize: 16)),
              
              const SizedBox(height: 20),
              
              if (_isLoading)
                const CircularProgressIndicator()
              else if (_colors.isNotEmpty)
                Column(
                  children: _colors.map((c) {
                    return ListTile(
                      leading: CircleAvatar(backgroundColor: _hexToColor(c.hex)),
                      title: Text(c.name),
                      subtitle: Text(c.hex),
                    );
                  }).toList(),
                )
              else
                const Text('Pick an image to extract colors, or open Live Camera'),
                
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ElevatedButton.icon(
                    onPressed: () => _pickImage(ImageSource.gallery),
                    icon: const Icon(Icons.photo),
                    label: const Text('Gallery'),
                  ),
                  const SizedBox(width: 20),
                  ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const LiveCameraScreen()));
                    },
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('Live Camera'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

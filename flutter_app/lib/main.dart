import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

import 'services/color_logic.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ColorLogic.init();
  runApp(const ColorIdentifierApp());
}

class ColorIdentifierApp extends StatelessWidget {
  const ColorIdentifierApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Color Identifier',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple, brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

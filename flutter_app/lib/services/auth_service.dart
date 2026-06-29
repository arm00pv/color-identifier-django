import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'dart:io' show Platform;

class AuthService {
  static const String baseUrl = 'http://127.0.0.1:8300/api';
  static String? _token;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('jwt_token');
    
    // RevenueCat Initialization
    await Purchases.setLogLevel(LogLevel.debug);
    PurchasesConfiguration configuration;
    if (Platform.isAndroid) {
      configuration = PurchasesConfiguration("goog_api_key_here");
    } else {
      configuration = PurchasesConfiguration("appl_api_key_here");
    }
    await Purchases.configure(configuration);
  }

  static bool get isLoggedIn => _token != null;

  static Future<bool> login(String username, String password) async {
    try {
      final response = await http.post(
        Uri.parse('http://127.0.0.1:8300/api/token/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _token = data['access'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('jwt_token', _token!);
        
        // Log into RevenueCat securely using Django username as App User ID
        await Purchases.logIn(username);
        
        return true;
      }
    } catch (e) {
      print("Login error: \$e");
    }
    return false;
  }

  static Future<bool> register(String username, String password) async {
    try {
      final response = await http.post(
        Uri.parse('\$baseUrl/register/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}),
      );
      return response.statusCode == 200;
    } catch (e) {
      print("Register error: \$e");
      return false;
    }
  }

  static Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await Purchases.logOut();
  }

  static Future<Map<String, dynamic>> checkSubscription(String action) async {
    if (_token == null) return {'allowed': false, 'error': 'Not logged in'};
    
    try {
      final response = await http.post(
        Uri.parse('\$baseUrl/subscription/check/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer \$_token'
        },
        body: jsonEncode({'action': action}),
      );
      
      final data = jsonDecode(response.body);
      return data;
    } catch (e) {
      return {'allowed': false, 'error': 'Network error'};
    }
  }
}

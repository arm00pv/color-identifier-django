import 'package:flutter/material.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:flutter/services.dart';

class PaywallScreen extends StatelessWidget {
  final String reason;
  
  const PaywallScreen({super.key, required this.reason});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Upgrade to Premium'),
        backgroundColor: Colors.amber.shade700,
      ),
      body: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.amber.shade900, Colors.black],
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.star, size: 100, color: Colors.amber),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                reason,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 22, color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 40),
            _buildPlanCard('\$2.99 / month', 'Billed Monthly', context),
            const SizedBox(height: 20),
            _buildPlanCard('\$19.99 / year', 'Save 45%!', context, isPopular: true),
            const SizedBox(height: 40),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Not now, thanks', style: TextStyle(color: Colors.white70)),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildPlanCard(String price, String subtitle, BuildContext context, {bool isPopular = false}) {
    return Card(
      color: Colors.white.withOpacity(0.1),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(15),
        side: isPopular ? const BorderSide(color: Colors.amber, width: 2) : BorderSide.none,
      ),
      child: InkWell(
        onTap: () async {
          try {
            // Note: In production you would fetch Offerings and pass the Package here.
            // This is a placeholder demonstrating RevenueCat integration.
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Processing purchase with RevenueCat...')));
            // CustomerInfo customerInfo = await Purchases.purchasePackage(package);
            // if (customerInfo.entitlements.all["premium"]?.isActive == true) { 
            //   // Unlock features
            // }
          } on PlatformException catch (e) {
            final errorCode = PurchasesErrorHelper.getErrorCode(e);
            if (errorCode != PurchasesErrorCode.purchaseCancelledError) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? 'Unknown error')));
            }
          }
        },
        child: Container(
          width: 300,
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              if (isPopular)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: Colors.amber, borderRadius: BorderRadius.circular(10)),
                  child: const Text('MOST POPULAR', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                ),
              const SizedBox(height: 10),
              Text(price, style: const TextStyle(fontSize: 28, color: Colors.white, fontWeight: FontWeight.bold)),
              Text(subtitle, style: const TextStyle(color: Colors.amberAccent)),
            ],
          ),
        ),
      ),
    );
  }
}

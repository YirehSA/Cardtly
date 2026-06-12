package com.cardtly.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register our custom plugins. Must be called BEFORE
        // super.onCreate so the bridge picks them up.
        registerPlugin(NfcSharePlugin.class);   // HCE phone-to-phone tap
        registerPlugin(CardWidgetPlugin.class); // home-screen QR widget sync
        super.onCreate(savedInstanceState);
    }
}

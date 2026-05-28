package com.cardtly.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register our custom NfcShare plugin (HCE phone-to-phone tap).
        // Must be called BEFORE super.onCreate so the bridge picks it up.
        registerPlugin(NfcSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

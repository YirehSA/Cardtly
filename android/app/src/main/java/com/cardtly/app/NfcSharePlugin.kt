package com.cardtly.app

import android.nfc.NfcAdapter
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor plugin that lets the web app arm and disarm phone-to-phone
 * NFC sharing. Exposes three methods to JS via window.Capacitor.Plugins.NfcShare:
 *
 *   startBroadcast({ url })  - begin emulating an NDEF tag with the
 *                              given URL. Returns success or rejects
 *                              with the reason (no NFC, NFC disabled).
 *   stopBroadcast()          - stop emulating.
 *   isSupported()            - returns { supported, enabled } so the
 *                              web app can show appropriate UI before
 *                              the user tries to share.
 *
 * The actual NFC responder is [CardtlyHceService]; this plugin only
 * mutates the shared [NfcShareBroadcast] state.
 */
@CapacitorPlugin(name = "NfcShare")
class NfcSharePlugin : Plugin() {

    @PluginMethod
    fun startBroadcast(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("missing_url")
            return
        }
        val adapter = NfcAdapter.getDefaultAdapter(context)
        if (adapter == null) {
            call.reject("nfc_not_supported")
            return
        }
        if (!adapter.isEnabled) {
            call.reject("nfc_disabled")
            return
        }
        NfcShareBroadcast.arm(url)
        val result = JSObject()
        result.put("success", true)
        call.resolve(result)
    }

    @PluginMethod
    fun stopBroadcast(call: PluginCall) {
        NfcShareBroadcast.disarm()
        val result = JSObject()
        result.put("success", true)
        call.resolve(result)
    }

    @PluginMethod
    fun isSupported(call: PluginCall) {
        val adapter = NfcAdapter.getDefaultAdapter(context)
        val result = JSObject()
        result.put("supported", adapter != null)
        result.put("enabled", adapter?.isEnabled == true)
        call.resolve(result)
    }
}

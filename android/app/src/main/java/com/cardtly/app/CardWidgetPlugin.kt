package com.cardtly.app

import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor plugin feeding the home-screen QR widget. The web app
 * calls setCard whenever the dashboard loads with the user's card,
 * so the widget stays in sync with whatever card they own - even
 * after slug or name changes. Exposed to JS as
 * window.Capacitor.Plugins.CardWidget.
 *
 *   setCard({ url, name })  - persist + re-render all widgets
 *   clearCard()             - wipe (e.g. on account deletion)
 */
@CapacitorPlugin(name = "CardWidget")
class CardWidgetPlugin : Plugin() {

    @PluginMethod
    fun setCard(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("missing_url")
            return
        }
        val name = call.getString("name") ?: ""
        context.getSharedPreferences(CardQrWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(CardQrWidgetProvider.KEY_URL, url)
            .putString(CardQrWidgetProvider.KEY_NAME, name)
            .apply()
        CardQrWidgetProvider.updateAll(context)
        val result = JSObject()
        result.put("success", true)
        call.resolve(result)
    }

    @PluginMethod
    fun clearCard(call: PluginCall) {
        context.getSharedPreferences(CardQrWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit().clear().apply()
        CardQrWidgetProvider.updateAll(context)
        val result = JSObject()
        result.put("success", true)
        call.resolve(result)
    }
}

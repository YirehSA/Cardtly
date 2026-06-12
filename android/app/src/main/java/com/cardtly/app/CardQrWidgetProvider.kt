package com.cardtly.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.widget.RemoteViews
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/**
 * Home-screen widget showing the user's Cardtly card QR code.
 *
 * Data flow: the web app (dashboard) calls the CardWidget Capacitor
 * plugin with the card URL + name whenever it loads; the plugin
 * persists them to SharedPreferences and triggers [updateAll]. The
 * widget renders entirely from those prefs, so it works offline and
 * survives reboots without the app running.
 *
 * Before the app has synced a card (fresh install, never signed in)
 * the widget shows a "set up" state that opens the app on tap.
 */
class CardQrWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) updateWidget(context, appWidgetManager, id)
    }

    companion object {
        const val PREFS = "cardtly_widget"
        const val KEY_URL = "card_url"
        const val KEY_NAME = "card_name"

        /** Re-render every placed instance of the widget. */
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, CardQrWidgetProvider::class.java))
            for (id in ids) updateWidget(context, manager, id)
        }

        private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val url = prefs.getString(KEY_URL, null)
            val name = prefs.getString(KEY_NAME, null)

            val views = RemoteViews(context.packageName, R.layout.widget_card_qr)

            if (url.isNullOrBlank()) {
                // Not synced yet - prompt to open the app once.
                views.setImageViewResource(R.id.widget_qr, R.mipmap.ic_launcher_round)
                views.setTextViewText(R.id.widget_name, context.getString(R.string.widget_empty_title))
                views.setTextViewText(R.id.widget_url, context.getString(R.string.widget_empty_subtitle))
            } else {
                views.setImageViewBitmap(R.id.widget_qr, qrBitmap(url, 512))
                views.setTextViewText(R.id.widget_name, name?.takeIf { it.isNotBlank() } ?: context.getString(R.string.widget_default_name))
                views.setTextViewText(R.id.widget_url, url.removePrefix("https://").removePrefix("www."))
            }

            // Tapping anywhere on the widget opens the app.
            val launch = Intent(context, MainActivity::class.java)
            val pending = PendingIntent.getActivity(
                context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pending)

            manager.updateAppWidget(widgetId, views)
        }

        /**
         * Render the URL as a QR bitmap. Classic black-on-white for
         * maximum scanner compatibility; RGB_565 halves the bitmap
         * memory vs ARGB_8888 (RemoteViews has a hard bitmap budget).
         */
        private fun qrBitmap(content: String, size: Int): Bitmap {
            val hints = mapOf(EncodeHintType.MARGIN to 1)
            val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints)
            val pixels = IntArray(size * size)
            for (y in 0 until size) {
                for (x in 0 until size) {
                    pixels[y * size + x] = if (matrix[x, y]) Color.BLACK else Color.WHITE
                }
            }
            return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.RGB_565)
        }
    }
}

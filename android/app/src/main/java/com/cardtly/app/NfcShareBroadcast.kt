package com.cardtly.app

/**
 * Shared state between [NfcSharePlugin] (JS bridge) and
 * [CardtlyHceService] (Android HCE responder).
 *
 * The plugin sets the URL and arms the broadcast when the user opens
 * the "Tap to share" modal. The HCE service reads from here whenever
 * an external NFC reader queries the standard NDEF Tag Application
 * AID (D2760000850101). When [enabled] is false the service returns
 * an error status, so a phone in someone's pocket can't accidentally
 * share their card by brushing against an NFC reader.
 */
object NfcShareBroadcast {
    @Volatile var enabled: Boolean = false
        private set

    @Volatile var ndefFile: ByteArray = buildNdefFile("")
        private set

    /**
     * Callback fired by [CardtlyHceService] when a reader has just
     * successfully read our NDEF file. Plugin assigns this in
     * startBroadcast so it can post a Capacitor event back to JS
     * (sound, vibration, success animation in the modal).
     */
    @Volatile var onTapSuccess: (() -> Unit)? = null

    /**
     * Capability Container (CC) file - tells the reader where to find
     * the NDEF file and how big it is. Standard NFC Forum Type 4 Tag
     * 2.0 layout. NDEF file ID = E1 04, max NDEF size = 1024 bytes,
     * read access = anyone, write access = none.
     */
    val ccFile: ByteArray = b(
        0x00, 0x0F,             // CCLEN = 15 bytes total
        0x20,                   // Mapping version 2.0
        0x00, 0x3B,             // MLe (max read APDU size = 59)
        0x00, 0x34,             // MLc (max write APDU size = 52)
        0x04, 0x06,             // NDEF File Control TLV
        0xE1, 0x04,             // NDEF file ID
        0x04, 0x00,             // Max NDEF file size = 1024
        0x00,                   // Read access: anyone
        0xFF                    // Write access: none
    )

    fun arm(url: String) {
        ndefFile = buildNdefFile(url)
        enabled = true
    }

    fun disarm() {
        enabled = false
    }

    /**
     * Build the NDEF file contents for a URI record. Format:
     *   [2 bytes NDEF length, big-endian]
     *   [NDEF record header]   = D1 (MB|ME|SR|TNF=well-known)
     *   [type length]          = 01
     *   [payload length]       = N
     *   [type]                 = 55 ("U" for URI)
     *   [URI prefix code]      = 04 for https:// (drops the prefix
     *                            from the URI for compactness)
     *   [URI bytes]            = "cardtly.com/yourname"
     */
    private fun buildNdefFile(url: String): ByteArray {
        if (url.isBlank()) return b(0x00, 0x00)

        val (prefixCode, rest) = when {
            url.startsWith("https://www.") -> 0x02 to url.substring(12)
            url.startsWith("http://www.")  -> 0x01 to url.substring(11)
            url.startsWith("https://")     -> 0x04 to url.substring(8)
            url.startsWith("http://")      -> 0x03 to url.substring(7)
            else                            -> 0x00 to url
        }

        val payload = byteArrayOf(prefixCode.toByte()) + rest.toByteArray(Charsets.UTF_8)
        val record  = b(0xD1, 0x01) + byteArrayOf(payload.size.toByte()) + b(0x55) + payload

        val nlen = record.size
        return byteArrayOf(
            ((nlen ushr 8) and 0xFF).toByte(),
            (nlen and 0xFF).toByte()
        ) + record
    }

    private fun b(vararg ints: Int): ByteArray = ByteArray(ints.size) { ints[it].toByte() }
}

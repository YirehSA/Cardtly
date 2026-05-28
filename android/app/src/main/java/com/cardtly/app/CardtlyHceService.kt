package com.cardtly.app

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/**
 * Host Card Emulation responder. When another NFC reader (a phone
 * doing a "tap to read" gesture, or a dedicated NFC reader) queries
 * our phone for the standard NDEF Tag Application AID, this service
 * gets the APDU commands and returns the user's Cardtly card URL as
 * an NDEF URI record.
 *
 * Registered in AndroidManifest.xml. The OS routes the standard NDEF
 * AID (D2760000850101) to this service when the screen is on,
 * regardless of foreground state - we use [NfcShareBroadcast.enabled]
 * to gate whether we actually respond, so the user has to explicitly
 * arm sharing from the "Tap to share" modal first.
 */
class CardtlyHceService : HostApduService() {

    private var selectedFile: ByteArray? = null

    override fun processCommandApdu(apdu: ByteArray?, extras: Bundle?): ByteArray {
        if (apdu == null) return SW_FAIL
        if (!NfcShareBroadcast.enabled) return SW_FAIL

        // SELECT NDEF Tag Application by AID
        if (apdu.size >= SELECT_AID.size && apdu.startsWith(SELECT_AID)) {
            return SW_SUCCESS
        }

        // SELECT Capability Container (file ID E1 03)
        if (apdu.size >= SELECT_CC.size && apdu.startsWith(SELECT_CC)) {
            selectedFile = NfcShareBroadcast.ccFile
            return SW_SUCCESS
        }

        // SELECT NDEF file (file ID E1 04)
        if (apdu.size >= SELECT_NDEF.size && apdu.startsWith(SELECT_NDEF)) {
            selectedFile = NfcShareBroadcast.ndefFile
            return SW_SUCCESS
        }

        // READ BINARY: 00 B0 [offsetHi] [offsetLo] [length]
        if (apdu.size >= 5 && apdu[0] == 0x00.toByte() && apdu[1] == 0xB0.toByte()) {
            val file = selectedFile ?: return SW_FAIL
            val offset = ((apdu[2].toInt() and 0xFF) shl 8) or (apdu[3].toInt() and 0xFF)
            var length = apdu[4].toInt() and 0xFF
            if (length == 0) length = 256
            if (offset >= file.size) return SW_FAIL
            val end = (offset + length).coerceAtMost(file.size)
            return file.copyOfRange(offset, end) + SW_SUCCESS
        }

        return SW_FAIL
    }

    override fun onDeactivated(reason: Int) {
        // Reader gone or link lost. Clear the selected file but leave
        // the broadcast armed - the user might tap a second device.
        selectedFile = null
    }

    private fun ByteArray.startsWith(prefix: ByteArray): Boolean {
        if (this.size < prefix.size) return false
        for (i in prefix.indices) if (this[i] != prefix[i]) return false
        return true
    }

    companion object {
        /** SELECT AID for the standard NFC Forum Type 4 Tag NDEF application. */
        private val SELECT_AID = byteArrayOf(
            0x00.toByte(), 0xA4.toByte(), 0x04.toByte(), 0x00.toByte(), 0x07.toByte(),
            0xD2.toByte(), 0x76.toByte(), 0x00.toByte(), 0x00.toByte(), 0x85.toByte(),
            0x01.toByte(), 0x01.toByte(), 0x00.toByte()
        )
        private val SELECT_CC = byteArrayOf(
            0x00.toByte(), 0xA4.toByte(), 0x00.toByte(), 0x0C.toByte(), 0x02.toByte(),
            0xE1.toByte(), 0x03.toByte()
        )
        private val SELECT_NDEF = byteArrayOf(
            0x00.toByte(), 0xA4.toByte(), 0x00.toByte(), 0x0C.toByte(), 0x02.toByte(),
            0xE1.toByte(), 0x04.toByte()
        )
        private val SW_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())
        private val SW_FAIL = byteArrayOf(0x6A.toByte(), 0x82.toByte())
    }
}

package com.openjarvis.app

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.exifinterface.media.ExifInterface
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Locale

/** Everything JavaScript can ask the phone to do. Only the OpenJarvis server page (and the local error page) can reach this object. */
class JarvisBridge(private val a: MainActivity) {
    private val voice = Voice(a)

    @JavascriptInterface fun isNative(): Boolean = true
    @JavascriptInterface fun getVersion(): String = try { a.packageManager.getPackageInfo(a.packageName, 0).versionName ?: "?" } catch (_: Exception) { "?" }
    @JavascriptInterface fun isLowRam(): Boolean {
        val am = a.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo(); am.getMemoryInfo(mi)
        return am.isLowRamDevice || mi.totalMem <= 2_300_000_000L
    }
    @JavascriptInterface fun getPermissions(): String = Perms.status(a).toString()
    @JavascriptInterface fun requestPermission(name: String) { a.runOnUiThread { Perms.request(a, name) } }
    @JavascriptInterface fun openAppSettings() { a.runOnUiThread { Perms.openAppSettings(a) } }

    @JavascriptInterface fun exec(callId: String, tool: String, argsJson: String) {
        Thread {
            try { Tools.run(a, callId, tool, JSONObject(argsJson.ifBlank { "{}" })) }
            catch (e: Exception) { a.reply(callId, false, null, e.message ?: "Bridge error") }
        }.start()
    }

    @JavascriptInterface fun listen(lang: String) = voice.listen(lang)
    @JavascriptInterface fun stopListen() = voice.stopListen()
    @JavascriptInterface fun speak(text: String, persona: String) = voice.speak(text, persona)
    @JavascriptInterface fun stopSpeak() = voice.stopSpeak()

    @JavascriptInterface fun stopAutomation() { Automation.stopped = true }
    @JavascriptInterface fun resumeAutomation() { Automation.stopped = false }
    @JavascriptInterface fun setAutomationActive(on: Boolean) { a.runOnUiThread { if (on) AutomationService.start(a) else AutomationService.stop(a) } }

    /** Reads a captured/screenshot image (only from OpenJarvis's own folders), applies EXIF rotation, downsizes, returns a JPEG data URL. */
    @JavascriptInterface fun readImageBase64(path: String, maxDim: Int): String {
        return try {
            val f = File(path).canonicalFile
            val roots = listOfNotNull(a.cacheDir, a.filesDir, a.getExternalFilesDir(null)).map { it.canonicalPath }
            if (roots.none { f.path.startsWith(it + File.separator) }) return ""
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(f.path, bounds)
            var sample = 1
            while (bounds.outWidth / sample > maxDim * 2 || bounds.outHeight / sample > maxDim * 2) sample *= 2
            var bmp = BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return ""
            val rot = when (ExifInterface(f.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f; ExifInterface.ORIENTATION_ROTATE_180 -> 180f; ExifInterface.ORIENTATION_ROTATE_270 -> 270f; else -> 0f
            }
            val scale = minOf(1f, maxDim.toFloat() / maxOf(bmp.width, bmp.height))
            if (rot != 0f || scale < 1f) { val m = Matrix().apply { postRotate(rot); postScale(scale, scale) }; bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true) }
            val out = ByteArrayOutputStream(); bmp.compress(Bitmap.CompressFormat.JPEG, 80, out); bmp.recycle()
            "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) { "" }
    }

    @JavascriptInterface fun saveToGallery(path: String): String {
        val f = File(path).canonicalFile
        val root = a.getExternalFilesDir(null)?.canonicalPath ?: return "Not available."
        if (!f.path.startsWith(root + File.separator)) return "Only files captured by OpenJarvis can be saved."
        return MediaSaver.save(a, f, f.extension.lowercase() == "mp4")
    }

    @JavascriptInterface fun getBackendUrl(): String = a.backendUrl()
    @JavascriptInterface fun setBackendUrl(url: String) { a.runOnUiThread { a.setBackend(url) } }
}

/** Android speech recognition + text-to-speech. The listening orb on screen (and Android's mic indicator) show when the mic is open. */
class Voice(private val a: MainActivity) {
    private var rec: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pending: Pair<String, String>? = null

    private fun event(type: String, vararg kv: Pair<String, Any>) { val o = JSONObject().put("type", type); kv.forEach { o.put(it.first, it.second) }; a.emit(o) }
    private fun err(code: String, msg: String) = event("stt_error", "code" to code, "message" to msg)
    private fun end() = event("stt_end")

    fun listen(lang: String) = a.runOnUiThread {
        if (!Perms.granted(a, Manifest.permission.RECORD_AUDIO)) { err("not-allowed", "Microphone permission is not granted. Allow it in Menu → Android permissions."); end(); return@runOnUiThread }
        if (!SpeechRecognizer.isRecognitionAvailable(a)) { err("unsupported", "This phone has no speech-recognition service installed."); end(); return@runOnUiThread }
        rec?.destroy()
        val r = SpeechRecognizer.createSpeechRecognizer(a); rec = r
        var done = false
        fun text(b: Bundle?) = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
            override fun onPartialResults(b: Bundle?) { text(b)?.let { event("stt_partial", "text" to it) } }
            override fun onResults(b: Bundle?) { if (done) return; done = true; text(b)?.let { event("stt_final", "text" to it) }; end() }
            override fun onError(code: Int) {
                if (done) return; done = true
                when (code) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> err("no-speech", "")
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER -> err("network", "Speech recognition needs an internet connection on this phone, or an offline language pack installed in Android settings.")
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> err("not-allowed", "Microphone permission is not granted.")
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> err("busy", "The speech service is busy. Try again.")
                    else -> err("error", "Speech recognition error $code.")
                }
                end()
            }
        })
        r.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true))
    }

    fun stopListen() = a.runOnUiThread { rec?.destroy(); rec = null }

    fun speak(text: String, persona: String) = a.runOnUiThread {
        pending = text to persona
        if (tts == null) {
            tts = TextToSpeech(a.applicationContext) { st ->
                a.runOnUiThread {
                    if (st == TextToSpeech.SUCCESS) {
                        ttsReady = true
                        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                            override fun onStart(utteranceId: String?) {}
                            override fun onDone(utteranceId: String?) { event("tts_done") }
                            @Deprecated("Deprecated in Java") override fun onError(utteranceId: String?) { event("tts_done") }
                        })
                        flush()
                    } else { pending = null; event("tts_done") }
                }
            }
        } else if (ttsReady) flush()
    }

    private fun flush() {
        val (text, persona) = pending ?: return
        pending = null
        val t = tts ?: return
        val loc = if (text.any { it in '\u0900'..'\u097F' }) Locale("hi", "IN") else Locale("en", "IN")
        val use = if (t.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) loc else Locale.US
        t.setLanguage(use)
        // Android has no gender API: use a voice whose name says female/male if the engine provides one, and always differ the pitch.
        val want = if (persona == "ADAM") "male" else "female"
        val unwanted = if (persona == "ADAM") "female" else "male"
        t.voices?.filter { it.locale.language == use.language }?.firstOrNull { it.name.lowercase().contains(want) && !it.name.lowercase().contains(unwanted) }?.let { t.setVoice(it) }
        t.setPitch(if (persona == "ADAM") 0.8f else 1.15f)
        if (t.speak(text, TextToSpeech.QUEUE_FLUSH, null, "oj") != TextToSpeech.SUCCESS) event("tts_done")
    }

    fun stopSpeak() = a.runOnUiThread { tts?.stop() }
}

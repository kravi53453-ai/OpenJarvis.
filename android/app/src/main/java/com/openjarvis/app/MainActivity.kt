package com.openjarvis.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.Lifecycle
import org.json.JSONObject

/** Hosts the OpenJarvis web UI (served by the OpenJarvis server) and exposes the native bridge to it. */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private val prefs by lazy { getSharedPreferences("oj", MODE_PRIVATE) }

    var pendingPerm: ((Map<String, Boolean>) -> Unit)? = null
    var pendingCamera: ((List<String>) -> Unit)? = null
    var pendingPick: ((Uri?) -> Unit)? = null
    var pendingCapture: ((Int, Intent?) -> Unit)? = null

    val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        pendingPerm?.invoke(r); pendingPerm = null; emitPermissionsChanged()
    }
    val cameraLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val list = res.data?.getStringArrayListExtra("paths") ?: arrayListOf()
        list.forEach { item -> val p = item.split("|", limit = 2); emit(JSONObject().put("type", "camera_result").put("kind", p[0]).put("path", p.getOrElse(1) { "" })) }
        pendingCamera?.invoke(list); pendingCamera = null
    }
    val pickLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> pendingPick?.invoke(uri); pendingPick = null }
    val captureLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res -> pendingCapture?.invoke(res.resultCode, res.data); pendingCapture = null }

    fun backendUrl(): String = prefs.getString("backend", "http://127.0.0.1:3000") ?: "http://127.0.0.1:3000"

    fun setBackend(url: String) {
        val u = Uri.parse(url.trim())
        val host = u.host ?: ""
        val local = host == "127.0.0.1" || host == "localhost"
        if (u.scheme != "https" && !(u.scheme == "http" && local)) {
            Toast.makeText(this, "Use https:// (plain http is only allowed for 127.0.0.1 or localhost).", Toast.LENGTH_LONG).show(); return
        }
        prefs.edit().putString("backend", url.trim().trimEnd('/')).apply()
        web.loadUrl(backendUrl())
    }

    private fun isBackend(u: Uri): Boolean { val b = Uri.parse(backendUrl()); return u.scheme == b.scheme && u.host == b.host && u.port == b.port }

    fun isResumedNow(): Boolean = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)

    fun emit(o: JSONObject) { runOnUiThread { if (::web.isInitialized) web.evaluateJavascript("window.__oj&&window.__oj.onEvent(${JSONObject.quote(o.toString())})", null) } }
    fun emitPermissionsChanged() = emit(JSONObject().put("type", "permissions_changed"))

    fun reply(callId: String, ok: Boolean, result: Any?, error: String?) {
        val o = JSONObject().put("ok", ok)
        if (result != null) o.put("result", result)
        if (error != null) o.put("error", error)
        runOnUiThread { if (::web.isInitialized) web.evaluateJavascript("window.__oj&&window.__oj.onResult(${JSONObject.quote(callId)},${JSONObject.quote(o.toString())})", null) }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        web.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true
            allowFileAccess = false; allowContentAccess = false // android_asset pages (the offline notice) still load
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }
        WebView.setWebContentsDebuggingEnabled(false)
        if (android.os.Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false) // keep running while another app is on screen
        web.setBackgroundColor(0xFF0B0E14.toInt())
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (isBackend(u) || u.toString().startsWith("file:///android_asset/")) return false
                if (u.scheme == "https" || u.scheme == "http") try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (_: Exception) {}
                return true // never navigate the bridge-enabled WebView to another site
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) view.loadUrl("file:///android_asset/offline.html")
            }
        }
        web.addJavascriptInterface(JarvisBridge(this), "OJNative")
        setContentView(web)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { moveTaskToBack(true) } })
        web.loadUrl(backendUrl())
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handleIntent(intent) }

    private fun handleIntent(i: Intent?) {
        if (i?.getBooleanExtra("stop", false) == true) { Automation.stopped = true; emit(JSONObject().put("type", "stop_requested")) }
    }

    override fun onResume() { super.onResume(); emitPermissionsChanged() }
    override fun onDestroy() { if (::web.isInitialized) web.destroy(); super.onDestroy() }
}

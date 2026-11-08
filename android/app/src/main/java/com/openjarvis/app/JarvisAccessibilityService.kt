package com.openjarvis.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * Real Android AccessibilityService. It does nothing on its own: every action is requested by the user through OpenJarvis.
 * Password fields are never read or typed into. Android may hide windows from accessibility (secure screens, some banking apps).
 */
class JarvisAccessibilityService : AccessibilityService() {
    companion object {
        @Volatile var instance: JarvisAccessibilityService? = null
        private const val MAX_NODES = 150
    }

    private val main = Handler(Looper.getMainLooper())

    override fun onServiceConnected() { instance = this }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) { /* we poll on demand; nothing is recorded */ }
    override fun onInterrupt() {}
    override fun onUnbind(intent: android.content.Intent?): Boolean { instance = null; return super.onUnbind(intent) }
    override fun onDestroy() { instance = null; super.onDestroy() }

    // ---------- reading ----------
    fun dump(): String? {
        val root = rootInActiveWindow ?: return null
        val arr = JSONArray()
        var count = 0
        fun walk(n: AccessibilityNodeInfo?, depth: Int) {
            if (n == null || count >= MAX_NODES || depth > 30) return
            if (n.isVisibleToUser) {
                val t = n.text?.toString()
                val d = n.contentDescription?.toString()
                if (!t.isNullOrBlank() || !d.isNullOrBlank() || n.isClickable || n.isEditable || n.isScrollable) {
                    val r = Rect(); n.getBoundsInScreen(r)
                    val o = JSONObject()
                    if (n.isPassword) o.put("text", "[password field hidden]")
                    else { if (!t.isNullOrBlank()) o.put("text", t.take(120)); if (!d.isNullOrBlank()) o.put("desc", d.take(120)) }
                    n.viewIdResourceName?.let { o.put("id", it.substringAfterLast('/')) }
                    if (n.isClickable) o.put("clickable", true)
                    if (n.isEditable) o.put("editable", true)
                    if (n.isScrollable) o.put("scrollable", true)
                    o.put("x", r.centerX()); o.put("y", r.centerY())
                    arr.put(o); count++
                }
            }
            for (i in 0 until n.childCount) walk(n.getChild(i), depth + 1)
        }
        walk(root, 0)
        val dm = resources.displayMetrics
        return JSONObject().put("package", root.packageName?.toString()).put("screen", "${dm.widthPixels}x${dm.heightPixels}")
            .put("elements", arr).put("truncated", count >= MAX_NODES).toString()
    }

    private fun findNode(text: String): AccessibilityNodeInfo? {
        val root = rootInActiveWindow ?: return null
        val q = text.trim().lowercase()
        var exact: AccessibilityNodeInfo? = null
        var partial: AccessibilityNodeInfo? = null
        var seen = 0
        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null || seen++ > 2000 || exact != null) return
            if (n.isVisibleToUser && !n.isPassword) {
                val t = n.text?.toString()?.lowercase(); val d = n.contentDescription?.toString()?.lowercase()
                if (t == q || d == q) { exact = n; return }
                if (partial == null && ((t?.contains(q) == true) || (d?.contains(q) == true))) partial = n
            }
            for (i in 0 until n.childCount) walk(n.getChild(i))
        }
        walk(root)
        return exact ?: partial
    }

    // ---------- acting ----------
    private fun gesture(path: Path, durationMs: Long, cb: (Boolean) -> Unit) {
        main.post {
            val g = GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(path, 0, durationMs.coerceAtLeast(1))).build()
            val sent = dispatchGesture(g, object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) { cb(true) }
                override fun onCancelled(gestureDescription: GestureDescription?) { cb(false) }
            }, null)
            if (!sent) cb(false)
        }
    }

    fun tapXY(x: Float, y: Float, long: Boolean, cb: (Boolean) -> Unit) {
        val p = Path().apply { moveTo(x, y); lineTo(x, y) }
        gesture(p, if (long) 900 else 60, cb)
    }

    /** Taps/long-presses an element found by visible text. Returns a description of what was done, or null if not found. */
    fun tapText(text: String, long: Boolean, cb: (Boolean, String) -> Unit) {
        val node = findNode(text)
        if (node == null) { cb(false, "No visible element matches \"$text\". Call read_screen to see what is on screen."); return }
        var n: AccessibilityNodeInfo? = node
        var depth = 0
        while (n != null && depth < 8) {
            val ok = if (long) (n.isLongClickable && n.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)) else (n.isClickable && n.performAction(AccessibilityNodeInfo.ACTION_CLICK))
            if (ok) { cb(true, "${if (long) "Long-pressed" else "Tapped"} \"$text\" via accessibility action."); return }
            n = n.parent; depth++
        }
        val r = Rect(); node.getBoundsInScreen(r)
        tapXY(r.centerX().toFloat(), r.centerY().toFloat(), long) { ok -> cb(ok, if (ok) "${if (long) "Long-pressed" else "Tapped"} \"$text\" at (${r.centerX()},${r.centerY()}) by gesture." else "Gesture was cancelled by Android.") }
    }

    fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long, cb: (Boolean) -> Unit) {
        val p = Path().apply { moveTo(x1, y1); lineTo(x2, y2) }
        gesture(p, durationMs, cb)
    }

    fun scroll(down: Boolean, cb: (Boolean, String) -> Unit) {
        val root = rootInActiveWindow
        var target: AccessibilityNodeInfo? = null
        fun walk(n: AccessibilityNodeInfo?) { if (n == null || target != null) return; if (n.isVisibleToUser && n.isScrollable) { target = n; return }; for (i in 0 until n.childCount) walk(n.getChild(i)) }
        walk(root)
        val t = target
        if (t != null && t.performAction(if (down) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)) { cb(true, "Scrolled ${if (down) "down" else "up"}."); return }
        val dm = resources.displayMetrics
        val x = dm.widthPixels / 2f
        val from = dm.heightPixels * (if (down) 0.7f else 0.3f); val to = dm.heightPixels * (if (down) 0.3f else 0.7f)
        swipe(x, from, x, to, 350) { ok -> cb(ok, if (ok) "Scrolled ${if (down) "down" else "up"} by swipe gesture." else "Scroll gesture was cancelled.") }
    }

    /** Returns null on success, otherwise an error message. Appends to existing text. */
    fun typeText(text: String): String? {
        val root = rootInActiveWindow ?: return "No readable window."
        var target: AccessibilityNodeInfo? = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (target == null) {
            fun walk(n: AccessibilityNodeInfo?) { if (n == null || target != null) return; if (n.isVisibleToUser && n.isEditable) { target = n; return }; for (i in 0 until n.childCount) walk(n.getChild(i)) }
            walk(root)
        }
        val t = target ?: return "No text field found. Tap a text field first."
        if (t.isPassword) return "Refusing to type into a password field."
        val hint = Build.VERSION.SDK_INT >= 26 && t.isShowingHintText
        val existing = if (hint) "" else (t.text?.toString() ?: "")
        val args = Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, existing + text) }
        return if (t.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) null else "The app refused text input."
    }

    fun press(button: String): Boolean = when (button) {
        "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
        "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
        "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
        "notifications" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
        else -> false
    }
}

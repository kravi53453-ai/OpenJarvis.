package com.openjarvis.app

import android.Manifest
import android.app.AlertDialog
import android.app.NotificationChannel
import android.app.NotificationManager
import android.bluetooth.BluetoothManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract
import android.provider.OpenableColumns
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

object Automation { @Volatile var stopped = false }

object Perms {
    fun granted(c: Context, p: String) = ContextCompat.checkSelfPermission(c, p) == PackageManager.PERMISSION_GRANTED

    fun accessibilityEnabled(c: Context): Boolean {
        if (JarvisAccessibilityService.instance != null) return true
        val enabled = Settings.Secure.getString(c.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        val cn = ComponentName(c, JarvisAccessibilityService::class.java)
        return enabled.split(':').any { it.equals(cn.flattenToString(), true) || it.equals(cn.flattenToShortString(), true) }
    }

    /** Real status read from Android — never assumed. */
    fun status(c: Context): JSONObject {
        fun s(b: Boolean) = if (b) "granted" else "not_granted"
        return JSONObject()
            .put("microphone", s(granted(c, Manifest.permission.RECORD_AUDIO)))
            .put("camera", s(granted(c, Manifest.permission.CAMERA)))
            .put("contacts", s(granted(c, Manifest.permission.READ_CONTACTS)))
            .put("phone", s(granted(c, Manifest.permission.CALL_PHONE)))
            .put("location", s(granted(c, Manifest.permission.ACCESS_FINE_LOCATION) || granted(c, Manifest.permission.ACCESS_COARSE_LOCATION)))
            .put("notifications", if (Build.VERSION.SDK_INT >= 33) s(granted(c, Manifest.permission.POST_NOTIFICATIONS)) else s(NotificationManagerCompat.from(c).areNotificationsEnabled()))
            .put("bluetooth", if (Build.VERSION.SDK_INT >= 31) s(granted(c, Manifest.permission.BLUETOOTH_CONNECT)) else "granted")
            .put("accessibility", s(accessibilityEnabled(c)))
            .put("screen_capture", "on_request")
    }

    fun openAppSettings(a: MainActivity) {
        a.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", a.packageName, null)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun request(a: MainActivity, name: String) {
        val all = buildList {
            add(Manifest.permission.RECORD_AUDIO); add(Manifest.permission.CAMERA); add(Manifest.permission.READ_CONTACTS); add(Manifest.permission.CALL_PHONE)
            add(Manifest.permission.ACCESS_FINE_LOCATION); add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            if (Build.VERSION.SDK_INT >= 31) add(Manifest.permission.BLUETOOTH_CONNECT)
        }
        val list: List<String> = when (name) {
            "microphone" -> listOf(Manifest.permission.RECORD_AUDIO)
            "camera" -> listOf(Manifest.permission.CAMERA)
            "contacts" -> listOf(Manifest.permission.READ_CONTACTS)
            "phone" -> listOf(Manifest.permission.CALL_PHONE)
            "location" -> listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            "notifications" -> if (Build.VERSION.SDK_INT >= 33) listOf(Manifest.permission.POST_NOTIFICATIONS) else {
                a.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, a.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return
            }
            "bluetooth" -> if (Build.VERSION.SDK_INT >= 31) listOf(Manifest.permission.BLUETOOTH_CONNECT) else emptyList()
            "accessibility" -> { a.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return }
            "all_runtime" -> all
            else -> emptyList()
        }
        val missing = list.filter { !granted(a, it) }
        if (missing.isEmpty()) { a.emitPermissionsChanged(); return }
        a.pendingPerm = { result ->
            // Denied and Android will no longer show the prompt → send the user to the correct settings screen.
            if (name != "all_runtime" && result.values.any { !it } && missing.any { !a.shouldShowRequestPermissionRationale(it) }) openAppSettings(a)
        }
        a.permLauncher.launch(missing.toTypedArray())
    }
}

object Tools {
    private val AUTOMATION = setOf("read_screen", "tap", "long_press", "swipe", "scroll", "type_text", "press", "open_app")
    private val NUMBER = Regex("^[+0-9*#() .-]{3,24}$")
    private const val A11Y_OFF = "The Accessibility service is not enabled. Open OpenJarvis → Menu → Android permissions → Accessibility and turn it on."

    fun run(a: MainActivity, id: String, tool: String, args: JSONObject) {
        val ok: (Any?) -> Unit = { r -> a.reply(id, true, r, null) }
        val fail: (String) -> Unit = { m -> a.reply(id, false, null, m) }
        try {
            if (Automation.stopped && tool in AUTOMATION) return fail("Stopped by the user.")
            val svc = JarvisAccessibilityService.instance
            when (tool) {
                "open_app" -> openApp(a, args.optString("app_name"), ok, fail)
                "read_screen" -> { if (svc == null) return fail(A11Y_OFF); val d = svc.dump(); if (d == null) fail("Android did not expose this window (secure screen, lock screen, or an app that blocks accessibility).") else ok(d) }
                "tap", "long_press" -> {
                    if (svc == null) return fail(A11Y_OFF)
                    val long = tool == "long_press"
                    if (args.has("x") && args.has("y")) svc.tapXY(args.getDouble("x").toFloat(), args.getDouble("y").toFloat(), long) { g -> if (g) ok("Gesture completed.") else fail("Android cancelled the gesture.") }
                    else if (args.optString("text").isNotBlank()) svc.tapText(args.getString("text"), long) { g, m -> if (g) ok(m) else fail(m) }
                    else fail("Provide text, or x and y.")
                }
                "swipe" -> { if (svc == null) return fail(A11Y_OFF); svc.swipe(args.getDouble("x1").toFloat(), args.getDouble("y1").toFloat(), args.getDouble("x2").toFloat(), args.getDouble("y2").toFloat(), args.optLong("duration_ms", 300)) { g -> if (g) ok("Swipe completed.") else fail("Android cancelled the swipe.") } }
                "scroll" -> { if (svc == null) return fail(A11Y_OFF); svc.scroll(args.optString("direction") != "up") { g, m -> if (g) ok(m) else fail(m) } }
                "type_text" -> { if (svc == null) return fail(A11Y_OFF); val e = svc.typeText(args.optString("text")); if (e == null) ok("Text entered.") else fail(e) }
                "press" -> { if (svc == null) return fail(A11Y_OFF); if (svc.press(args.optString("button"))) ok("Pressed ${args.optString("button")}.") else fail("Android refused that button.") }
                "find_contact" -> findContact(a, args.optString("query"), ok, fail)
                "call_phone" -> callPhone(a, args.optString("number").trim(), args.optString("name"), ok, fail)
                "open_camera" -> openCamera(a, args, ok, fail)
                "take_screenshot" -> screenshot(a, ok, fail)
                "get_location" -> location(a, ok, fail)
                "show_notification" -> notification(a, args.optString("title"), args.optString("text"), ok, fail)
                "read_clipboard" -> a.runOnUiThread {
                    val cm = a.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    val t = cm.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(a)?.toString()
                    if (t.isNullOrEmpty()) ok("Clipboard is empty, or Android did not allow access (only the app on screen can read it).") else ok(t.take(2000))
                }
                "set_clipboard" -> a.runOnUiThread { (a.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("OpenJarvis", args.optString("text"))); ok("Copied to clipboard.") }
                "share_text" -> a.runOnUiThread { a.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, args.optString("text")), "Share").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); ok("Share sheet opened; the user chooses where to send it.") }
                "open_url" -> {
                    val u = Uri.parse(args.optString("url"))
                    if (u.scheme != "http" && u.scheme != "https") return fail("Only http/https links can be opened.")
                    a.runOnUiThread { try { a.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); ok("Link opened.") } catch (e: ActivityNotFoundException) { fail("No browser available.") } }
                }
                "pick_file" -> a.runOnUiThread { a.pendingPick = { uri -> if (uri == null) ok("No file chosen.") else Thread { ok(describe(a, uri)) }.start() }; a.pickLauncher.launch(arrayOf("*/*")) }
                "bluetooth_status" -> bluetooth(a, ok, fail)
                else -> fail("Unknown tool: $tool")
            }
        } catch (e: Exception) { fail(e.message ?: e.javaClass.simpleName) }
    }

    private fun openApp(a: MainActivity, name: String, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        val q = name.trim().lowercase()
        if (q.isEmpty()) return fail("app_name is required.")
        val pm = a.packageManager
        val apps = pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0).map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
        val m = apps.firstOrNull { it.second.lowercase() == q } ?: apps.firstOrNull { it.second.lowercase().startsWith(q) } ?: apps.firstOrNull { it.second.lowercase().contains(q) }
            ?: return fail("No installed app matches \"$name\".")
        val li = pm.getLaunchIntentForPackage(m.first) ?: return fail("${m.second} has no launch screen.")
        a.runOnUiThread {
            try {
                a.startActivity(li.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                ok("Launch of ${m.second} requested. Android only allows this while OpenJarvis is on screen or was just used; if the app did not open, bring OpenJarvis to the front and ask again.")
            } catch (e: Exception) { fail("Android blocked launching ${m.second}: ${e.message}") }
        }
    }

    private fun findContact(a: MainActivity, q: String, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        if (!Perms.granted(a, Manifest.permission.READ_CONTACTS)) return fail("Contacts permission is not granted. Open Menu → Android permissions → Contacts.")
        val out = JSONArray()
        a.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER),
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?", arrayOf("%$q%"), "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC")?.use { c ->
            while (c.moveToNext() && out.length() < 10) out.put(JSONObject().put("name", c.getString(0)).put("number", c.getString(1)))
        }
        if (out.length() == 0) ok("No contact matches \"$q\".") else ok(out.toString())
    }

    private fun callPhone(a: MainActivity, number: String, name: String, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        if (!NUMBER.matches(number)) return fail("That does not look like a valid phone number.")
        a.runOnUiThread {
            if (!a.isResumedNow()) return@runOnUiThread fail("OpenJarvis must be on screen so you can confirm the call.")
            AlertDialog.Builder(a).setTitle("Call ${name.ifBlank { "this number" }}?").setMessage(number).setCancelable(false)
                .setPositiveButton("Call") { _, _ -> placeCall(a, number, ok, fail) }
                .setNegativeButton("Cancel") { _, _ -> ok("The user declined. Nothing was dialed.") }.show()
        }
    }

    private fun placeCall(a: MainActivity, number: String, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        val digits = number.filter { it.isDigit() }
        val direct = Perms.granted(a, Manifest.permission.CALL_PHONE) && digits.length > 3 // short/emergency numbers always go through the dialer
        try {
            a.startActivity(Intent(if (direct) Intent.ACTION_CALL else Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number))).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            ok(if (direct) "Android was asked to place the call. OpenJarvis cannot tell whether it connected or was answered." else "The dialer was opened with the number filled in. The user must press the call button.")
        } catch (e: SecurityException) { fail("Android refused the call: ${e.message}") }
        catch (e: ActivityNotFoundException) { fail("This device has no phone app.") }
    }

    private fun openCamera(a: MainActivity, args: JSONObject, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        if (!Perms.granted(a, Manifest.permission.CAMERA)) { a.runOnUiThread { Perms.request(a, "camera") }; return fail("Camera permission is not granted yet. A permission prompt was shown; ask again after allowing.") }
        a.runOnUiThread {
            if (!a.isResumedNow()) return@runOnUiThread fail("OpenJarvis must be on screen to open the camera.")
            a.pendingCamera = { list ->
                if (list.isEmpty()) ok("The camera was closed without saving anything.")
                else ok(JSONObject().put("saved", JSONArray(list.map { val p = it.split("|", limit = 2); JSONObject().put("kind", p[0]).put("path", p.getOrElse(1) { "" }) })).toString())
            }
            a.cameraLauncher.launch(Intent(a, CameraActivity::class.java).putExtra("mode", args.optString("mode", "photo")).putExtra("lens", args.optString("lens", "rear")).putExtra("auto", args.optString("auto_capture") == "true"))
        }
    }

    private fun screenshot(a: MainActivity, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        a.runOnUiThread {
            if (!a.isResumedNow()) return@runOnUiThread fail("OpenJarvis must be on screen to ask Android for screen-capture consent.")
            val mpm = a.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            a.pendingCapture = { code, data ->
                if (code != android.app.Activity.RESULT_OK || data == null) fail("Screen capture was not allowed.")
                else {
                    ScreenCaptureService.callback = { file, err ->
                        if (file != null) { a.emit(JSONObject().put("type", "screenshot_result").put("path", file.absolutePath)); ok(JSONObject().put("path", file.absolutePath).put("note", "Screenshot saved. Its content is not analysed automatically; the user can attach it in chat.").toString()) }
                        else fail(err ?: "Screen capture failed.")
                    }
                    ContextCompat.startForegroundService(a, Intent(a, ScreenCaptureService::class.java).putExtra(ScreenCaptureService.EXTRA_CODE, code).putExtra(ScreenCaptureService.EXTRA_DATA, data))
                    a.moveTaskToBack(true) // so the screenshot shows the other app, not OpenJarvis
                }
            }
            a.captureLauncher.launch(mpm.createScreenCaptureIntent())
        }
    }

    private fun location(a: MainActivity, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        if (!Perms.granted(a, Manifest.permission.ACCESS_FINE_LOCATION) && !Perms.granted(a, Manifest.permission.ACCESS_COARSE_LOCATION)) return fail("Location permission is not granted.")
        val lm = a.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        var best: Location? = null
        for (p in lm.getProviders(true)) {
            val l = try { lm.getLastKnownLocation(p) } catch (_: SecurityException) { null }
            val cur = best
            if (l != null && (cur == null || l.time > cur.time)) best = l
        }
        val b = best ?: return fail("No recent location is available. Open a maps app once so Android can find your position, then retry.")
        ok(JSONObject().put("latitude", b.latitude).put("longitude", b.longitude).put("accuracy_m", b.accuracy.toDouble()).put("age_seconds", (System.currentTimeMillis() - b.time) / 1000).toString())
    }

    private fun notification(a: MainActivity, title: String, text: String, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        if (Build.VERSION.SDK_INT >= 33 && !Perms.granted(a, Manifest.permission.POST_NOTIFICATIONS)) return fail("Notification permission is not granted.")
        val nm = a.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("oj_general", "OpenJarvis", NotificationManager.IMPORTANCE_DEFAULT))
        nm.notify((System.currentTimeMillis() % 100000).toInt(), NotificationCompat.Builder(a, "oj_general").setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title.take(80)).setContentText(text.take(300)).setAutoCancel(true).build())
        ok("Notification shown.")
    }

    private fun describe(a: MainActivity, uri: Uri): String {
        var name = "file"; var size = -1L
        a.contentResolver.query(uri, null, null, null, null)?.use { c ->
            if (c.moveToFirst()) { val n = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); val s = c.getColumnIndex(OpenableColumns.SIZE); if (n >= 0) name = c.getString(n); if (s >= 0) size = c.getLong(s) }
        }
        val mime = a.contentResolver.getType(uri) ?: ""
        val o = JSONObject().put("name", name).put("size_bytes", size).put("type", mime)
        val textual = mime.startsWith("text/") || mime.contains("json") || mime.contains("xml") || mime.contains("csv")
        if (textual && size in 0..200_000) a.contentResolver.openInputStream(uri)?.use { o.put("content", it.readBytes().toString(Charsets.UTF_8).take(20000)) } else o.put("content", "(not read: binary or too large)")
        return o.toString()
    }

    private fun bluetooth(a: MainActivity, ok: (Any?) -> Unit, fail: (String) -> Unit) {
        val adapter = (a.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter ?: return ok("This device has no Bluetooth.")
        val o = JSONObject().put("enabled", adapter.isEnabled)
        if (Build.VERSION.SDK_INT >= 31 && !Perms.granted(a, Manifest.permission.BLUETOOTH_CONNECT)) return ok(o.put("paired_devices", "(Nearby devices permission not granted)").toString())
        try { o.put("paired_devices", JSONArray(adapter.bondedDevices.map { it.name ?: "unnamed" })) } catch (e: SecurityException) { fail("Android refused access to paired devices.") ; return }
        ok(o.toString())
    }
}

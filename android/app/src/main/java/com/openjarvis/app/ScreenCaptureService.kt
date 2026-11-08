package com.openjarvis.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream

/** One-shot screen capture using MediaProjection. Android shows its own consent dialog first; a notification is visible while capturing. */
class ScreenCaptureService : Service() {
    companion object {
        const val EXTRA_CODE = "code"; const val EXTRA_DATA = "data"; const val EXTRA_DELAY = "delay"
        @Volatile var callback: ((File?, String?) -> Unit)? = null
    }

    private val handler = Handler(Looper.getMainLooper())
    private var projection: MediaProjection? = null
    private var finished = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("oj_capture", "Screen capture", NotificationManager.IMPORTANCE_LOW))
        val n: Notification = NotificationCompat.Builder(this, "oj_capture").setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle("OpenJarvis is capturing the screen").setOngoing(true).build()
        if (Build.VERSION.SDK_INT >= 29) startForeground(3, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION) else startForeground(3, n)
        val code = intent?.getIntExtra(EXTRA_CODE, 0) ?: 0
        @Suppress("DEPRECATION") val data: Intent? = intent?.getParcelableExtra(EXTRA_DATA)
        val delay = intent?.getLongExtra(EXTRA_DELAY, 1200) ?: 1200
        if (data == null) { finish(null, "No capture permission data."); return START_NOT_STICKY }
        handler.postDelayed({ capture(code, data) }, delay) // wait for the consent dialog / OpenJarvis window to go away
        handler.postDelayed({ finish(null, "Screen capture timed out.") }, delay + 6000)
        return START_NOT_STICKY
    }

    private fun capture(code: Int, data: Intent) {
        try {
            val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val mp = mpm.getMediaProjection(code, data); projection = mp
            mp.registerCallback(object : MediaProjection.Callback() { override fun onStop() {} }, handler) // required on Android 14+
            val dm = resources.displayMetrics
            val w = dm.widthPixels; val h = dm.heightPixels
            val reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
            val vd = mp.createVirtualDisplay("openjarvis", w, h, dm.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.surface, null, handler)
            reader.setOnImageAvailableListener({ r ->
                val img = r.acquireLatestImage() ?: return@setOnImageAvailableListener
                try {
                    val plane = img.planes[0]
                    val rowPad = plane.rowStride - plane.pixelStride * w
                    val bmp = Bitmap.createBitmap(w + rowPad / plane.pixelStride, h, Bitmap.Config.ARGB_8888)
                    bmp.copyPixelsFromBuffer(plane.buffer)
                    val crop = Bitmap.createBitmap(bmp, 0, 0, w, h)
                    val dir = File(cacheDir, "shots").apply { mkdirs() }
                    dir.listFiles()?.sortedBy { it.lastModified() }?.dropLast(4)?.forEach { it.delete() } // keep cache small
                    val f = File(dir, "shot_${System.currentTimeMillis()}.jpg")
                    FileOutputStream(f).use { crop.compress(Bitmap.CompressFormat.JPEG, 85, it) }
                    bmp.recycle(); crop.recycle()
                    vd.release(); reader.close()
                    finish(f, null)
                } catch (e: Exception) { finish(null, "Capture failed: ${e.message}") } finally { img.close() }
            }, handler)
        } catch (e: Exception) { finish(null, "Capture failed: ${e.message}") }
    }

    private fun finish(f: File?, err: String?) {
        if (finished) return
        finished = true
        handler.removeCallbacksAndMessages(null)
        try { projection?.stop() } catch (_: Exception) {}
        callback?.invoke(f, err); callback = null
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
    }
}

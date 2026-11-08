package com.openjarvis.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/** Keeps OpenJarvis alive while it operates other apps, and shows a visible notification with a Stop button. */
class AutomationService : Service() {
    companion object {
        fun start(c: Context) { try { ContextCompat.startForegroundService(c, Intent(c, AutomationService::class.java)) } catch (_: Exception) { /* not allowed from background */ } }
        fun stop(c: Context) { c.stopService(Intent(c, AutomationService::class.java)) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("oj_auto", "OpenJarvis tasks", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java).putExtra("stop", true).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(this, "oj_auto").setSmallIcon(android.R.drawable.ic_menu_manage)
            .setContentTitle("OpenJarvis is working on your phone").setContentText("Press Stop to cancel at any time.")
            .setOngoing(true).addAction(0, "Stop", stop).build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(2, n, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(2, n)
        return START_NOT_STICKY
    }
}

package com.openjarvis.app

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

/**
 * Safe starter only. Do not execute arbitrary natural-language actions here.
 * Add an explicit, user-approved action queue, target validation, timeouts,
 * audit log and a global stop flag before enabling automation.
 */
class OpenJarvisAccessibilityService : AccessibilityService() {
    @Volatile private var stopped: Boolean = true

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (stopped || event == null) return
        // TODO: Parse only approved events; avoid collecting unrelated screen content.
    }

    override fun onInterrupt() {
        stopped = true
    }

    fun stopAutomation() {
        stopped = true
    }
}

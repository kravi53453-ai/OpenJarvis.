package com.openjarvis.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File

/**
 * Real in-app camera (CameraX): live preview, photo + video, front/rear, flash/torch, zoom.
 * Everything is visible: nothing records unless the preview is on screen, and recording shows a red REC timer.
 */
class CameraActivity : ComponentActivity() {
    private lateinit var preview: PreviewView
    private lateinit var status: TextView
    private lateinit var countdown: TextView
    private lateinit var shutter: Button
    private lateinit var modeBtn: Button
    private lateinit var flashBtn: Button
    private lateinit var viewBtn: Button
    private lateinit var saveBtn: Button
    private var provider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var recording: Recording? = null
    private var lens = CameraSelector.LENS_FACING_BACK
    private var videoMode = false
    private var autoCapture = false
    private var flashIdx = 0 // 0 off, 1 auto, 2 on
    private var recStart = 0L
    private val saved = ArrayList<String>()
    private var lastFile: File? = null
    private var lastVideo = false
    private val handler = Handler(Looper.getMainLooper())

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startCamera() else { Toast.makeText(this, "Camera permission was not granted.", Toast.LENGTH_LONG).show(); finish() }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label; isAllCaps = false; setTextColor(Color.WHITE); setBackgroundColor(0x99000000.toInt()); setPadding(dp(10), dp(6), dp(10), dp(6))
        setOnClickListener { onClick() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        videoMode = intent.getStringExtra("mode") == "video"
        lens = if (intent.getStringExtra("lens") == "front") CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
        autoCapture = intent.getBooleanExtra("auto", false)

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        preview = PreviewView(this)
        root.addView(preview, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)

        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12), dp(36), dp(12), dp(8)) }
        top.addView(button("✕ Close") { finish() })
        status = TextView(this).apply { setTextColor(Color.WHITE); textSize = 16f; setPadding(dp(14), 0, 0, 0) }
        top.addView(status)
        root.addView(top, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP))

        countdown = TextView(this).apply { setTextColor(Color.WHITE); textSize = 96f; gravity = Gravity.CENTER }
        root.addView(countdown, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))

        val bottom = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), dp(8), dp(12), dp(24)); setBackgroundColor(0x66000000) }
        val zoom = SeekBar(this).apply {
            max = 100
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar?, p: Int, fromUser: Boolean) { camera?.cameraControl?.setLinearZoom(p / 100f) }
                override fun onStartTrackingTouch(s: SeekBar?) {}
                override fun onStopTrackingTouch(s: SeekBar?) {}
            })
        }
        bottom.addView(TextView(this).apply { text = "Zoom"; setTextColor(Color.WHITE) })
        bottom.addView(zoom)
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER; setPadding(0, dp(8), 0, dp(8)) }
        val lp = { LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { setMargins(dp(4), 0, dp(4), 0) } }
        row.addView(button("Flip") { lens = if (lens == CameraSelector.LENS_FACING_BACK) CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK; bind() }, lp())
        flashBtn = button("Flash: off") { cycleFlash() }; row.addView(flashBtn, lp())
        shutter = button("") { shutterPressed() }; row.addView(shutter, lp())
        modeBtn = button("") { if (recording == null) { videoMode = !videoMode; bind() } }; row.addView(modeBtn, lp())
        bottom.addView(row)
        val row2 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
        viewBtn = button("View last") { viewLast() }.apply { visibility = android.view.View.GONE }
        saveBtn = button("Save to gallery") { lastFile?.let { Toast.makeText(this@CameraActivity, MediaSaver.save(this@CameraActivity, it, lastVideo), Toast.LENGTH_LONG).show() } }.apply { visibility = android.view.View.GONE }
        row2.addView(viewBtn, lp()); row2.addView(saveBtn, lp())
        bottom.addView(row2)
        root.addView(bottom, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        setContentView(root)
        updateLabels()

        if (Perms.granted(this, Manifest.permission.CAMERA)) startCamera() else permLauncher.launch(Manifest.permission.CAMERA)
    }

    private fun startCamera() {
        val f = ProcessCameraProvider.getInstance(this)
        f.addListener({ provider = f.get(); bind(); if (autoCapture) startCountdown() }, ContextCompat.getMainExecutor(this))
    }

    private fun bind() {
        val p = provider ?: return
        var sel = CameraSelector.Builder().requireLensFacing(lens).build()
        val has = try { p.hasCamera(sel) } catch (_: Exception) { false }
        if (!has) {
            Toast.makeText(this, "That camera is not available on this device.", Toast.LENGTH_SHORT).show()
            lens = if (lens == CameraSelector.LENS_FACING_BACK) CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
            sel = CameraSelector.Builder().requireLensFacing(lens).build()
        }
        p.unbindAll()
        val pv = Preview.Builder().build().also { it.setSurfaceProvider(preview.surfaceProvider) }
        try {
            camera = if (videoMode) {
                val recorder = Recorder.Builder().setQualitySelector(QualitySelector.from(Quality.SD, FallbackStrategy.lowerQualityOrHigherThan(Quality.SD))).build()
                val vc = VideoCapture.withOutput(recorder)
                videoCapture = vc; imageCapture = null
                p.bindToLifecycle(this, sel, pv, vc)
            } else {
                val ic = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).setFlashMode(flashMode()).build()
                imageCapture = ic; videoCapture = null
                p.bindToLifecycle(this, sel, pv, ic)
            }
        } catch (e: Exception) { Toast.makeText(this, "Camera error: ${e.message}", Toast.LENGTH_LONG).show() }
        updateLabels()
    }

    private fun flashMode() = when (flashIdx) { 1 -> ImageCapture.FLASH_MODE_AUTO; 2 -> ImageCapture.FLASH_MODE_ON; else -> ImageCapture.FLASH_MODE_OFF }

    private fun cycleFlash() {
        if (camera?.cameraInfo?.hasFlashUnit() != true) { Toast.makeText(this, "This camera has no flash.", Toast.LENGTH_SHORT).show(); return }
        flashIdx = if (videoMode) (if (flashIdx == 2) 0 else 2) else (flashIdx + 1) % 3
        if (videoMode) camera?.cameraControl?.enableTorch(flashIdx == 2) else imageCapture?.flashMode = flashMode()
        updateLabels()
    }

    private fun updateLabels() {
        if (!::shutter.isInitialized) return
        shutter.text = if (recording != null) "■ Stop" else if (videoMode) "● Record" else "● Photo"
        modeBtn.text = if (videoMode) "Mode: Video" else "Mode: Photo"
        flashBtn.text = "Flash: " + (if (videoMode) (if (flashIdx == 2) "torch" else "off") else listOf("off", "auto", "on")[flashIdx])
        if (recording == null) status.text = if (lens == CameraSelector.LENS_FACING_BACK) "Rear camera" else "Front camera"
    }

    private fun mediaDir(): File = getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: filesDir

    private fun shutterPressed() { if (videoMode) toggleRecord() else takePhoto() }

    private fun takePhoto() {
        val ic = imageCapture ?: return
        val f = File(mediaDir(), "OJ_${System.currentTimeMillis()}.jpg")
        ic.takePicture(ImageCapture.OutputFileOptions.Builder(f).build(), ContextCompat.getMainExecutor(this), object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(output: ImageCapture.OutputFileResults) { captured(f, false) }
            override fun onError(exc: ImageCaptureException) { Toast.makeText(this@CameraActivity, "Photo failed: ${exc.message}", Toast.LENGTH_LONG).show() }
        })
    }

    @SuppressLint("MissingPermission")
    private fun toggleRecord() {
        val vc = videoCapture ?: return
        recording?.let { it.stop(); recording = null; return }
        val f = File(mediaDir(), "OJ_${System.currentTimeMillis()}.mp4")
        var pending = vc.output.prepareRecording(this, FileOutputOptions.Builder(f).build())
        if (Perms.granted(this, Manifest.permission.RECORD_AUDIO)) pending = pending.withAudioEnabled()
        recording = pending.start(ContextCompat.getMainExecutor(this)) { ev ->
            when (ev) {
                is VideoRecordEvent.Start -> { recStart = System.currentTimeMillis(); tick(); updateLabels() }
                is VideoRecordEvent.Finalize -> {
                    recording = null; handler.removeCallbacksAndMessages(null); updateLabels()
                    if (!ev.hasError()) captured(f, true) else Toast.makeText(this, "Recording failed (code ${ev.error}).", Toast.LENGTH_LONG).show()
                }
                else -> {}
            }
        }
    }

    private fun tick() {
        if (recording == null) return
        val s = (System.currentTimeMillis() - recStart) / 1000
        status.text = "● REC %02d:%02d".format(s / 60, s % 60); status.setTextColor(Color.RED)
        handler.postDelayed({ tick() }, 500)
    }

    private fun captured(f: File, video: Boolean) {
        status.setTextColor(Color.WHITE)
        saved.add("${if (video) "video" else "photo"}|${f.absolutePath}")
        lastFile = f; lastVideo = video
        viewBtn.visibility = android.view.View.VISIBLE; saveBtn.visibility = android.view.View.VISIBLE
        Toast.makeText(this, "${if (video) "Video" else "Photo"} captured.", Toast.LENGTH_SHORT).show()
        if (autoCapture && !video) finish()
        updateLabels()
    }

    private fun startCountdown() {
        var n = 3
        fun step() {
            if (isFinishing) return
            if (n == 0) { countdown.text = ""; shutterPressed(); return }
            countdown.text = n.toString(); n--
            handler.postDelayed({ step() }, 1000)
        }
        step()
    }

    private fun viewLast() {
        val f = lastFile ?: return
        try {
            val uri = FileProvider.getUriForFile(this, "$packageName.files", f)
            startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, if (lastVideo) "video/mp4" else "image/jpeg").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        } catch (e: Exception) { Toast.makeText(this, "No app can open this file.", Toast.LENGTH_SHORT).show() }
    }

    override fun onPause() { recording?.stop(); recording = null; super.onPause() } // never keep recording when not on screen

    override fun finish() {
        setResult(RESULT_OK, Intent().putStringArrayListExtra("paths", saved))
        super.finish()
    }
}

package com.openjarvis.app

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File

object MediaSaver {
    /** Copies a captured file into the shared gallery (Android 10+). Older Android needs a storage permission OpenJarvis does not request. */
    fun save(ctx: Context, file: File, video: Boolean): String {
        if (Build.VERSION.SDK_INT < 29) return "On Android 9 and older the file stays in the app folder: ${file.absolutePath}"
        val cv = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, file.name)
            put(MediaStore.MediaColumns.MIME_TYPE, if (video) "video/mp4" else "image/jpeg")
            put(MediaStore.MediaColumns.RELATIVE_PATH, (if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/OpenJarvis")
        }
        val coll = if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val uri = ctx.contentResolver.insert(coll, cv) ?: return "Could not create a gallery entry."
        ctx.contentResolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } } ?: return "Could not write to the gallery."
        return "Saved to your gallery (${if (video) "Movies" else "Pictures"}/OpenJarvis)."
    }
}

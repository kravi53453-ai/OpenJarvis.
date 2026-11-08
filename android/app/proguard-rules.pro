# The WebView bridge is called by name from JavaScript.
-keepclassmembers class com.openjarvis.app.JarvisBridge { @android.webkit.JavascriptInterface <methods>; }

# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ---------------------------------------------------------------------------
# Capacitor WebView bridge — keep JS interface classes
# ---------------------------------------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep class org.lebenindeutschland.app.** { *; }
-dontwarn com.getcapacitor.**

# Keep Capacitor plugin classes registered via reflection
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# Keep JavaScript interface methods for WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

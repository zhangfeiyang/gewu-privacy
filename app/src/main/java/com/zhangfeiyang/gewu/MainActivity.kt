package com.zhangfeiyang.gewu

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var pageReady = false
    private var cssInsetTop = 0
    private var cssInsetRight = 0
    private var cssInsetBottom = 0
    private var cssInsetLeft = 0

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()
        window.statusBarColor = Color.rgb(12, 45, 74)
        WindowCompat.getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = false
        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(244, 247, 249))
            overScrollMode = WebView.OVER_SCROLL_NEVER
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = false
            settings.setSupportZoom(false)
            settings.mediaPlaybackRequiresUserGesture = false
            addJavascriptInterface(AndroidBridge(this@MainActivity), "NativeBridge")
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    pageReady = true
                    pushNativeInsets()
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?,
                ): Boolean {
                    val uri = request?.url ?: return true
                    if (uri.scheme == "file") return false
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
            }
            loadUrl("file:///android_asset/shell.html")
        }
        setContentView(webView)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or
                    WindowInsetsCompat.Type.displayCutout(),
            )
            val density = resources.displayMetrics.density
            cssInsetTop = (insets.top / density).roundToInt()
            cssInsetRight = (insets.right / density).roundToInt()
            cssInsetBottom = (insets.bottom / density).roundToInt()
            cssInsetLeft = (insets.left / density).roundToInt()
            pushNativeInsets()
            windowInsets
        }
        ViewCompat.requestApplyInsets(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "Boolean(window.handleAndroidBack && window.handleAndroidBack())",
                ) { result ->
                    if (result != "true") finish()
                }
            }
        })
    }

    override fun onPause() {
        webView.onPause()
        webView.evaluateJavascript("window.setAppVisible && window.setAppVisible(false)", null)
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.evaluateJavascript("window.setAppVisible && window.setAppVisible(true)", null)
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("NativeBridge")
        webView.destroy()
        super.onDestroy()
    }

    private fun pushNativeInsets() {
        if (!pageReady || !::webView.isInitialized) return
        webView.evaluateJavascript(
            "window.setNativeInsets&&window.setNativeInsets({" +
                "top:$cssInsetTop,right:$cssInsetRight," +
                "bottom:$cssInsetBottom,left:$cssInsetLeft})",
            null,
        )
    }

    private class AndroidBridge(private val context: Context) {
        @JavascriptInterface
        fun vibrate() {
            val vibrator = context.getSystemService(Vibrator::class.java) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE),
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(18)
            }
        }

        @JavascriptInterface
        fun share(title: String) {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.app_name))
                putExtra(Intent.EXTRA_TEXT, title)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(
                Intent.createChooser(intent, context.getString(R.string.share_app))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }

        @JavascriptInterface
        fun openUrl(url: String) {
            val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return
            if (uri.scheme != "https") return
            context.startActivity(
                Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }
}

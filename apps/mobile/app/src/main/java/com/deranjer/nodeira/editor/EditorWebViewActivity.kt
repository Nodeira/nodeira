package com.deranjer.nodeira.editor

import com.deranjer.nodeira.BuildConfig

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.core.graphics.ColorUtils
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream

/**
 * Hosts the embedded web editor (TipTap + Yjs + Hocuspocus) inside a WebView.
 *
 * Key mechanics (plan step 1):
 *  - The web build lives in `assets/web/` and is served from the virtual https origin
 *    `appassets.androidplatform.net` so the app shell loads offline and IndexedDB gets a
 *    stable origin (offline-first survives no network).
 *  - Any unknown path falls back to `index.html` (SPA routing), so navigating to
 *    `/embed/note/<id>` boots the chrome-less editor route added in apps/web.
 *  - `index.html` is rewritten on the fly to inject `window.nodeiraNative` (server URLs)
 *    and the JWT into localStorage *before* the app bundle runs, so REST + Yjs sync point
 *    at the user's server.
 */
class EditorWebViewActivity : Activity() {

    companion object {
        private const val TAG = "NodeiraWebView"
        private const val ASSET_HOST = "appassets.androidplatform.net"
        private const val ASSET_ROOT = "web"

        private const val EXTRA_SERVER = "server"
        private const val EXTRA_TOKEN = "token"
        private const val EXTRA_PATH = "path"

        // Brand surface tokens (see ui/theme/Color.kt) used to seed the system-bar chrome
        // before the page reports its real background.
        private val EDITOR_BG_LIGHT = 0xFFFBF8FF.toInt()
        private val EDITOR_BG_DARK = 0xFF121318.toInt()

        // Reads the editor's effective background color (body, falling back to <html>) as a
        // CSS color string, so the native chrome can match whatever theme the web app renders.
        private const val READ_BG_JS =
            "(function(){var t='rgba(0, 0, 0, 0)';" +
                "var c=getComputedStyle(document.body).backgroundColor;" +
                "if(!c||c===t||c==='transparent'){" +
                "c=getComputedStyle(document.documentElement).backgroundColor;}" +
                "return c;})()"

        /** Opens an embedded web surface at [path], e.g. `/embed/note/<id>` or `/embed/canvas/<id>`. */
        fun intent(ctx: Context, server: String, token: String, path: String): Intent =
            Intent(ctx, EditorWebViewActivity::class.java).apply {
                putExtra(EXTRA_SERVER, server)
                putExtra(EXTRA_TOKEN, token)
                putExtra(EXTRA_PATH, path)
            }

        fun notePath(noteId: String): String = "/embed/note/$noteId"
        fun canvasPath(canvasId: String): String = "/embed/canvas/$canvasId"
    }

    private lateinit var webView: WebView

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val server = intent.getStringExtra(EXTRA_SERVER).orEmpty().trimEnd('/')
        val token = intent.getStringExtra(EXTRA_TOKEN).orEmpty()
        val path = intent.getStringExtra(EXTRA_PATH).orEmpty().ifBlank { "/" }
        val wsBase = toWsUrl(server)

        webView = WebView(this)
        val root = FrameLayout(this)
        root.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)

        // Seed the system-bar strips + icon contrast from the system night mode so they match
        // the editor immediately (the web app's color scheme is "auto" → follows the system).
        // Refined precisely from the page's real background in onPageFinished below.
        val nightMode = resources.configuration.uiMode and
            Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        applyChromeForBackground(if (nightMode) EDITOR_BG_DARK else EDITOR_BG_LIGHT)

        // targetSdk 36 forces edge-to-edge, so without this the WebView (and the editor's
        // note title) would draw under the status bar. WebView.setPadding() only offsets
        // scrolling — Chromium sizes its CSS viewport (100vh/100dvh) from the View's measured
        // bounds, ignoring padding — so the inset has to shrink the WebView itself via margins
        // on its LayoutParams, not padding.
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime(),
            )
            val lp = webView.layoutParams as FrameLayout.LayoutParams
            lp.setMargins(bars.left, bars.top, bars.right, bars.bottom)
            webView.layoutParams = lp
            insets
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            // The page is served from https://appassets... while a self-hosted server may be
            // plain http(ws). Allowing that in a release build means the editor will silently
            // load active content over an unencrypted connection, so it is debug-only:
            // release builds require https and fail loudly otherwise.
            mixedContentMode =
                if (BuildConfig.DEBUG) {
                    WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                } else {
                    WebSettings.MIXED_CONTENT_NEVER_ALLOW
                }
        }
        // Remote debugging exposes the WebView — and the JWT in its localStorage — to any
        // adb client on the machine. Debug builds only.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                Log.d(TAG, "console: ${msg.message()} @${msg.sourceId()}:${msg.lineNumber()}")
                return true
            }
        }

        webView.webViewClient = AssetWebViewClient(server, wsBase, token)

        webView.loadUrl("https://$ASSET_HOST$path")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    /** Serves the bundled web build with SPA fallback + config injection. */
    private inner class AssetWebViewClient(
        private val apiBaseUrl: String,
        private val wsBaseUrl: String,
        private val token: String,
    ) : WebViewClientCompat() {

        override fun onPageFinished(view: WebView, url: String) {
            // Mantine applies its theme after hydration, so re-read shortly after load too.
            syncChromeToPage(view)
            view.postDelayed({ syncChromeToPage(view) }, 400)
        }

        private fun syncChromeToPage(view: WebView) {
            view.evaluateJavascript(READ_BG_JS) { result ->
                parseCssColor(result)?.let(::applyChromeForBackground)
            }
        }

        override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest,
        ): WebResourceResponse? {
            val url = request.url
            if (url.host != ASSET_HOST) return null // let real network requests through

            val path = (url.path ?: "/").trimStart('/')
            val assets = view.context.assets

            // 1. Try to serve an exact static asset (js/css/fonts/images).
            if (path.isNotEmpty() && !path.endsWith("/")) {
                try {
                    val stream = assets.open("$ASSET_ROOT/$path")
                    return WebResourceResponse(mimeOf(path), null, stream)
                } catch (_: IOException) {
                    // fall through to SPA fallback
                }
            }

            // 2. SPA fallback: serve index.html (with injected bootstrap) for any route.
            return try {
                val html = injectBootstrap(readAsset(assets.open("$ASSET_ROOT/index.html")))
                WebResourceResponse(
                    "text/html",
                    "utf-8",
                    ByteArrayInputStream(html.toByteArray(Charsets.UTF_8)),
                )
            } catch (e: IOException) {
                Log.e(TAG, "index.html missing from assets/$ASSET_ROOT — did you copy the web build?", e)
                null
            }
        }

        /**
         * Injects, at the very top of <head>:
         *  - `<base href="/">` so the web build's *relative* asset URLs (`./assets/...`,
         *    built with Vite `base: "./"` for Electron's file://) resolve against the
         *    origin root instead of the current route path
         *    (`/embed/note/<id>/assets/...`, which 404s → SPA-fallbacks to index.html).
         *  - a classic (non-deferred) script setting `window.nodeiraNative` + the JWT in
         *    localStorage, so config is present before the deferred module bundle runs.
         *
         * The base tag must precede the module/style tags, hence "top of <head>".
         */
        private fun injectBootstrap(html: String): String {
            val cfg = JSONObject()
                .put("apiBaseUrl", apiBaseUrl)
                .put("wsBaseUrl", wsBaseUrl)
                .toString()
            val inject = buildString {
                append("<base href=\"/\">")
                append("<script>")
                append("window.nodeiraNative=").append(cfg).append(";")
                append("try{localStorage.setItem('nodeira_token',")
                append(JSONObject.quote(token))
                append(");}catch(e){}")
                append("</script>")
            }
            val idx = html.indexOf("<head>")
            return if (idx >= 0) {
                html.substring(0, idx + 6) + inject + html.substring(idx + 6)
            } else {
                inject + html
            }
        }
    }

    /**
     * Paints the system-bar strips (the inset padding around the WebView) the same color as the
     * editor and flips the status/nav bar icons to dark or light for legibility against it.
     */
    private fun applyChromeForBackground(color: Int) {
        webView.setBackgroundColor(color)
        val light = ColorUtils.calculateLuminance(color) > 0.5
        WindowCompat.getInsetsController(window, webView).apply {
            isAppearanceLightStatusBars = light
            isAppearanceLightNavigationBars = light
        }
    }

    /** Parses a CSS `rgb(...)`/`rgba(...)` color (as returned by getComputedStyle) to an int. */
    private fun parseCssColor(jsResult: String?): Int? {
        val raw = jsResult?.trim()?.trim('"') ?: return null
        val nums = Regex("[\\d.]+").findAll(raw).map { it.value }.toList()
        if (nums.size < 3) return null
        val r = nums[0].toFloat().toInt().coerceIn(0, 255)
        val g = nums[1].toFloat().toInt().coerceIn(0, 255)
        val b = nums[2].toFloat().toInt().coerceIn(0, 255)
        // A fully transparent body bg tells us nothing about the theme — ignore it.
        val a = nums.getOrNull(3)?.toFloatOrNull() ?: 1f
        if (a == 0f) return null
        return Color.rgb(r, g, b)
    }

    private fun toWsUrl(httpUrl: String): String = when {
        httpUrl.startsWith("https://") -> "wss://" + httpUrl.removePrefix("https://")
        httpUrl.startsWith("http://") -> "ws://" + httpUrl.removePrefix("http://")
        else -> httpUrl
    }

    private fun readAsset(stream: InputStream): String =
        stream.bufferedReader(Charsets.UTF_8).use { it.readText() }

    private fun mimeOf(path: String): String = when (path.substringAfterLast('.').lowercase()) {
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "html" -> "text/html"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "gif" -> "image/gif"
        "webp" -> "image/webp"
        "ico" -> "image/x-icon"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "ttf" -> "font/ttf"
        "wasm" -> "application/wasm"
        "map" -> "application/json"
        else -> "application/octet-stream"
    }
}

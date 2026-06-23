package com.miniesports.app;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.app.ActivityCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

// ── Native Google Sign-In ─────────────────────────────────────────
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
// ─────────────────────────────────────────────────────────────────

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private AdView bannerAdView;
    private InterstitialAd interstitialAd;
    private RewardedAd rewardedAd;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> filePathCallback;
    private int pageLoadCount = 0;
    private boolean userLoggedIn = false;

    // ── Native Google Sign-In ─────────────────────────────────────
    private GoogleSignInClient googleSignInClient;
    // Web client ID (type 3) — google-services.json se liya
    private static final String WEB_CLIENT_ID =
        "247829466483-76misqmapf7pu81m9ims0r4p9lgufiap.apps.googleusercontent.com";
    // ─────────────────────────────────────────────────────────────

    private static final int INTERSTITIAL_TRIGGER  = 4;
    private static final int FILE_CHOOSER_REQUEST  = 101;
    private static final int PERMISSION_REQUEST    = 100;
    private static final int GOOGLE_SIGN_IN_REQUEST = 102;   // ← naya

    // =========================================================
    // URLs
    // =========================================================
    private static final String APP_URL =
        "https://deepsilence10161-source.github.io/ff-user-panel/";

    private static final String DEEP_LINK_SCHEME = "miniesports";

    // =========================================================
    // AdMob IDs (Test)
    // =========================================================
    private static final String ADMOB_BANNER       = "ca-app-pub-3940256099942544/6300978111";
    private static final String ADMOB_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
    private static final String ADMOB_REWARDED     = "ca-app-pub-3940256099942544/5224354917";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showLastCrashIfAny();
        setContentView(R.layout.activity_main);

        ActivityCompat.requestPermissions(this, new String[]{
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.READ_EXTERNAL_STORAGE
        }, PERMISSION_REQUEST);

        MobileAds.initialize(this, status -> {});

        // ── Native Google Sign-In init ────────────────────────
        GoogleSignInOptions gso = new GoogleSignInOptions
            .Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(WEB_CLIENT_ID)   // Firebase ke liye token chahiye
            .requestEmail()
            .build();
        googleSignInClient = GoogleSignIn.getClient(this, gso);
        // ─────────────────────────────────────────────────────

        swipeRefresh = findViewById(R.id.swipeRefresh);
        webView      = findViewById(R.id.webView);
        progressBar  = findViewById(R.id.progressBar);

        setupWebView();
        setupBannerAd();
        loadInterstitialAd();
        loadRewardedAd();

        handleIntent(getIntent());

        if (isOnline()) webView.loadUrl(APP_URL);
        else webView.loadUrl("file:///android_asset/no_internet.html");

        swipeRefresh.setOnRefreshListener(() -> {
            if (isOnline()) webView.reload();
            else webView.loadUrl("file:///android_asset/no_internet.html");
            swipeRefresh.setRefreshing(false);
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;
        if (DEEP_LINK_SCHEME.equals(data.getScheme())) {
            webView.evaluateJavascript(
                "if (window._onAuthDeepLink) window._onAuthDeepLink('" +
                data.toString().replace("'", "\\'") + "');",
                null
            );
        }
    }

    // =========================================================
    // JavaScript Bridge
    // =========================================================
    public class AndroidBridge {

        @JavascriptInterface
        public boolean isAndroidApp() { return true; }

        // ── Native Google Sign-In ─────────────────────────────
        // auth.js: window.Android.nativeGoogleSignIn()
        // Google ka official account picker khulega (saved accounts dikh'te hain)
        // Token wapas: window.onNativeGoogleToken(idToken)
        @JavascriptInterface
        public void nativeGoogleSignIn() {
            runOnUiThread(() -> {
                // Pehle sign out karo taaki har baar account picker aaye
                googleSignInClient.signOut().addOnCompleteListener(task -> {
                    Intent signInIntent = googleSignInClient.getSignInIntent();
                    startActivityForResult(signInIntent, GOOGLE_SIGN_IN_REQUEST);
                });
            });
        }

        // Sign out pe native Google session bhi clear karo
        @JavascriptInterface
        public void nativeGoogleSignOut() {
            if (googleSignInClient != null) {
                googleSignInClient.signOut();
                googleSignInClient.revokeAccess();
            }
        }

        // ── Chrome Custom Tab (fallback) ──────────────────────
        @JavascriptInterface
        public void openGoogleLogin(String url) {
            runOnUiThread(() -> {
                try {
                    CustomTabsIntent customTab = new CustomTabsIntent.Builder()
                        .setShowTitle(false).build();
                    customTab.intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                    customTab.launchUrl(MainActivity.this, Uri.parse(url));
                } catch (Exception e) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e2) {
                        Toast.makeText(MainActivity.this,
                            "Browser open nahi hua", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        // ── Rewarded Ad ───────────────────────────────────────
        @JavascriptInterface
        public void showRewardedAd(String adUnitId) {
            runOnUiThread(() -> {
                if (rewardedAd != null) {
                    rewardedAd.show(MainActivity.this, rewardItem -> {
                        webView.evaluateJavascript(
                            "window.onAdRewarded && window.onAdRewarded('" + adUnitId + "');",
                            null
                        );
                        loadRewardedAd();
                    });
                } else {
                    webView.evaluateJavascript(
                        "window.onAdRewarded && window.onAdRewarded(null);", null);
                }
            });
        }

        // ── Interstitial Ad ───────────────────────────────────
        @JavascriptInterface
        public void showInterstitialAd() {
            runOnUiThread(() -> showInterstitialNative());
        }

        // ── Banner Ad ─────────────────────────────────────────
        @JavascriptInterface
        public void showBannerAd(String adUnitId) {
            runOnUiThread(() -> {
                if (bannerAdView != null) bannerAdView.setVisibility(View.VISIBLE);
            });
        }

        @JavascriptInterface
        public void showBanner(String adUnitId) { showBannerAd(adUnitId); }

        @JavascriptInterface
        public void hideBannerAd() {
            runOnUiThread(() -> {
                if (bannerAdView != null) bannerAdView.setVisibility(View.GONE);
            });
        }

        @JavascriptInterface
        public void hideBanner() { hideBannerAd(); }

        // ── Utility ───────────────────────────────────────────
        @JavascriptInterface
        public boolean isOnline() { return MainActivity.this.isOnline(); }

        @JavascriptInterface
        public void showToast(String msg) {
            runOnUiThread(() ->
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show()
            );
        }

        // ── Login state ───────────────────────────────────────
        @JavascriptInterface
        public void onUserLoggedIn() { userLoggedIn = true; pageLoadCount = 0; }

        @JavascriptInterface
        public void onUserLoggedOut() { userLoggedIn = false; pageLoadCount = 0; }
    }
    // =========================================================

    // =========================================================
    // Google Sign-In Result
    // =========================================================
    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);

        if (req == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            filePathCallback.onReceiveValue(
                res == RESULT_OK && data != null ? new Uri[]{data.getData()} : null
            );
            filePathCallback = null;
        }

        // ── Native Google Sign-In result ──────────────────────
        else if (req == GOOGLE_SIGN_IN_REQUEST) {
            Task<GoogleSignInAccount> task =
                GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                String idToken = account.getIdToken();
                if (idToken != null) {
                    // Token mila — WebView mein inject karo
                    // auth.js mein window.onNativeGoogleToken() handle karega
                    final String safeToken = idToken.replace("'", "\\'");
                    webView.post(() ->
                        webView.evaluateJavascript(
                            "if(window.onNativeGoogleToken)" +
                            "  window.onNativeGoogleToken('" + safeToken + "');",
                            null
                        )
                    );
                } else {
                    // Token null — error signal do
                    webView.post(() ->
                        webView.evaluateJavascript(
                            "if(window.onNativeGoogleError)" +
                            "  window.onNativeGoogleError('Token null');",
                            null
                        )
                    );
                }
            } catch (ApiException e) {
                // User ne cancel kiya ya koi error
                final String errCode = String.valueOf(e.getStatusCode());
                webView.post(() ->
                    webView.evaluateJavascript(
                        "if(window.onNativeGoogleError)" +
                        "  window.onNativeGoogleError('Code:" + errCode + "');",
                        null
                    )
                );
            }
        }
    }

    private void setupWebView() {
        WebSettings s = webView.getSettings();

        // ── Core JS / Storage ────────────────────────────────
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        // ── PERFORMANCE OPTIMIZATIONS ─────────────────────────
        // 1. HTTP Cache — GitHub Pages ki files dusre load pe cache se
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // 2. Hardware acceleration — WebView ke liye (Activity level pe bhi set hai Manifest mein)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // 3. Image loading — lazy nahi, immediately load karo
        s.setLoadsImagesAutomatically(true);
        s.setBlockNetworkImage(false);

        // 4. Zoom controls disable — speed + cleaner UX
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);

        // 5. Text autosizing off — consistent layout, no reflow
        s.setTextZoom(100);

        // 6. Encoding
        s.setDefaultTextEncodingName("UTF-8");

        // 7. Remove WebView marker from User-Agent — Google OAuth block prevent
        s.setUserAgentString(s.getUserAgentString().replace("; wv)", ")"));

        // ── JavaScript Bridge ─────────────────────────────────
        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public void onPageStarted(WebView v, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                if (userLoggedIn) {
                    pageLoadCount++;
                    if (pageLoadCount % INTERSTITIAL_TRIGGER == 0) showInterstitialNative();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                String url = req.getUrl().toString();

                // App ki own URLs — WebView mein hi rehne do
                if (url.contains("deepsilence10161-source.github.io") ||
                    url.contains("deepsilence10161.workers.dev")       ||
                    url.contains("firebaseapp.com")                    ||
                    url.contains("googleapis.com")) {
                    return false;
                }

                // Google login — native sign-in use karte hain ab,
                // lekin agar koi aur accounts.google.com URL aaye to Custom Tab mein kholo
                if (url.contains("accounts.google.com")) {
                    try {
                        CustomTabsIntent customTab = new CustomTabsIntent.Builder()
                            .setShowTitle(false).build();
                        customTab.intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                        customTab.launchUrl(MainActivity.this, Uri.parse(url));
                    } catch (Exception e) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    }
                    return true;
                }

                // Baaki external links → browser
                if (url.startsWith("http") || url.startsWith("https")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView v, int code, String desc, String url) {
                if (url != null && url.equals(v.getUrl()))
                    v.loadUrl("file:///android_asset/no_internet.html");
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public void onProgressChanged(WebView v, int p) {
                progressBar.setProgress(p);
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin,
                    GeolocationPermissions.Callback cb) { cb.invoke(origin, true, false); }

            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> cb,
                    FileChooserParams p) {
                filePathCallback = cb;
                startActivityForResult(p.createIntent(), FILE_CHOOSER_REQUEST);
                return true;
            }

            @Override
            public boolean onCreateWindow(WebView v, boolean isDialog,
                    boolean isUserGesture, Message resultMsg) {
                WebView popup = new WebView(MainActivity.this);
                popup.getSettings().setJavaScriptEnabled(true);
                popup.getSettings().setDomStorageEnabled(true);
                AlertDialog d = new AlertDialog.Builder(MainActivity.this)
                    .setView(popup).create();
                popup.setWebChromeClient(new WebChromeClient() {
                    @Override public void onCloseWindow(WebView w) { d.dismiss(); }
                });
                popup.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView vv, WebResourceRequest r) {
                        String url = r.getUrl().toString();
                        if (url.contains("deepsilence10161-source.github.io") ||
                            url.contains("deepsilence10161.workers.dev")) {
                            d.dismiss();
                            return true;
                        }
                        // Popup mein bhi accounts.google.com aaye to Custom Tab
                        if (url.contains("accounts.google.com")) {
                            d.dismiss();
                            try {
                                CustomTabsIntent ct = new CustomTabsIntent.Builder().build();
                                ct.launchUrl(MainActivity.this, Uri.parse(url));
                            } catch (Exception e) {
                                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                            }
                            return true;
                        }
                        return false;
                    }
                });
                d.show();
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
        });
    }

    private void setupBannerAd() {
        bannerAdView = findViewById(R.id.bannerAdView);
        if (bannerAdView == null) return;
        try { bannerAdView.loadAd(new AdRequest.Builder().build()); }
        catch (Exception e) { /* crash nahi hoga */ }
    }

    private void loadInterstitialAd() {
        InterstitialAd.load(this, ADMOB_INTERSTITIAL,
            new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull InterstitialAd ad) {
                    interstitialAd = ad;
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override public void onAdDismissedFullScreenContent() {
                            webView.evaluateJavascript(
                                "window.onInterstitialDismissed && window.onInterstitialDismissed();",
                                null
                            );
                            loadInterstitialAd();
                        }
                    });
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError e) {
                    interstitialAd = null;
                }
            });
    }

    private void showInterstitialNative() {
        if (interstitialAd != null) interstitialAd.show(this);
    }

    private void loadRewardedAd() {
        RewardedAd.load(this, ADMOB_REWARDED,
            new AdRequest.Builder().build(),
            new RewardedAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull RewardedAd ad) { rewardedAd = ad; }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { rewardedAd = null; }
            });
    }

    private void showLastCrashIfAny() {
        File f = new File(getFilesDir(), "last_crash.txt");
        if (!f.exists()) return;
        try {
            StringBuilder sb = new StringBuilder();
            BufferedReader br = new BufferedReader(new FileReader(f));
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append("\n");
            br.close();
            new AlertDialog.Builder(this)
                .setTitle("Pichli baar crash hua tha")
                .setMessage(sb.toString())
                .setPositiveButton("OK", (d, w) -> f.delete())
                .setCancelable(false)
                .show();
        } catch (Exception ignored) { }
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo ni = cm.getActiveNetworkInfo();
        return ni != null && ni.isConnected();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack(); return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (bannerAdView != null) bannerAdView.resume();
    }

    @Override protected void onPause()   { super.onPause();   if (bannerAdView != null) bannerAdView.pause(); }
    @Override protected void onDestroy() { super.onDestroy(); if (bannerAdView != null) bannerAdView.destroy(); if (webView != null) webView.destroy(); }
}

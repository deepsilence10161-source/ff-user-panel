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

    private static final int INTERSTITIAL_TRIGGER  = 4;
    private static final int FILE_CHOOSER_REQUEST  = 101;
    private static final int PERMISSION_REQUEST    = 100;

    // =========================================================
    // URLs
    // =========================================================
    private static final String APP_URL =
        "https://deepsilence10161-source.github.io/ff-user-panel/";

    // Deep link scheme — AndroidManifest mein bhi yahi hona chahiye
    // Firebase redirect ke baad: miniesports://auth → MainActivity.onNewIntent()
    private static final String DEEP_LINK_SCHEME = "miniesports";

    // =========================================================
    // AdMob IDs
    // Test IDs abhi, real IDs Play Store se pehle replace karo:
    // private static final String ADMOB_BANNER       = "ca-app-pub-1032532795123223/9718498564";
    // private static final String ADMOB_INTERSTITIAL = "ca-app-pub-1032532795123223/7817221971";
    // private static final String ADMOB_REWARDED     = "ca-app-pub-1032532795123223/5092857849";
    private static final String ADMOB_BANNER       = "ca-app-pub-3940256099942544/6300978111";
    private static final String ADMOB_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
    private static final String ADMOB_REWARDED     = "ca-app-pub-3940256099942544/5224354917";
    // =========================================================

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

        swipeRefresh = findViewById(R.id.swipeRefresh);
        webView      = findViewById(R.id.webView);
        progressBar  = findViewById(R.id.progressBar);

        setupWebView();
        setupBannerAd();
        loadInterstitialAd();
        loadRewardedAd();

        // Deep link se aaye? (auth callback) — handle karo
        handleIntent(getIntent());

        if (isOnline()) webView.loadUrl(APP_URL);
        else webView.loadUrl("file:///android_asset/no_internet.html");

        swipeRefresh.setOnRefreshListener(() -> {
            if (isOnline()) webView.reload();
            else webView.loadUrl("file:///android_asset/no_internet.html");
            swipeRefresh.setRefreshing(false);
        });
    }

    // =========================================================
    // Deep Link Handler
    // Chrome Custom Tab se Google login ke baad yahan aata hai
    // =========================================================
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;

        // miniesports://auth?... ya miniesports://auth/callback
        if (DEEP_LINK_SCHEME.equals(data.getScheme())) {
            // App wapas foreground mein aaya — WebView ko signal do ki auth ho gaya
            // WebView mein firebase.auth() already chal raha tha
            // Custom Tab ne auth complete kiya → ab getRedirectResult() result milega
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

        // App identity — auth.js WebView detect karne ke liye
        @JavascriptInterface
        public boolean isAndroidApp() { return true; }

        // ── Google Login via Chrome Custom Tab ────────────────
        // auth.js: window.Android.openGoogleLogin(url)
        // Firebase signInWithRedirect ki URL Chrome Tab mein open hoti hai
        // Wahan se Google account select → redirect → miniesports:// deep link
        // → onNewIntent → WebView ko signal
        @JavascriptInterface
        public void openGoogleLogin(String url) {
            runOnUiThread(() -> {
                try {
                    CustomTabsIntent customTab = new CustomTabsIntent.Builder()
                        .setShowTitle(false)
                        .build();
                    customTab.intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                    customTab.launchUrl(MainActivity.this, Uri.parse(url));
                } catch (Exception e) {
                    // Chrome nahi hai — fallback: normal browser
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

        // ── Login state signals ───────────────────────────────
        @JavascriptInterface
        public void onUserLoggedIn() {
            userLoggedIn = true;
            pageLoadCount = 0;
        }

        @JavascriptInterface
        public void onUserLoggedOut() {
            userLoggedIn = false;
            pageLoadCount = 0;
        }
    }
    // =========================================================

    private void setupWebView() {
        WebSettings s = webView.getSettings();
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

        // WebView marker hatao — Google blocks "; wv)" user agent
        s.setUserAgentString(s.getUserAgentString().replace("; wv)", ")"));

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

                // Interstitial sirf logged-in users ke liye
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

                // Google login URL — Chrome Custom Tab mein open karo
                // Firebase signInWithRedirect yahan aata hai
                // Custom Tab mein Chrome ke saved accounts dikh'te hain ✅
                if (url.contains("accounts.google.com")) {
                    try {
                        CustomTabsIntent customTab = new CustomTabsIntent.Builder()
                            .setShowTitle(false)
                            .build();
                        customTab.intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                        customTab.launchUrl(MainActivity.this, Uri.parse(url));
                    } catch (Exception e) {
                        // Chrome nahi hai → normal browser
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    }
                    return true; // WebView navigate mat karo
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

            // onCreateWindow ab zaroorat nahi — Custom Tab handle karta hai login
            // Lekin koi aur popup aye to dismiss karo gracefully
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
        try {
            bannerAdView.loadAd(new AdRequest.Builder().build());
        } catch (Exception e) { /* crash nahi hoga */ }
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
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            filePathCallback.onReceiveValue(
                res == RESULT_OK && data != null ? new Uri[]{data.getData()} : null
            );
            filePathCallback = null;
        }
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

        // Custom Tab se wapas aaye? Firebase getRedirectResult trigger karo
        // JS mein _redirectAuthPending flag check hoga
        webView.evaluateJavascript(
            "if (window._redirectAuthPending && window.fbAuth) {" +
            "  window._redirectAuthPending = false;" +
            "  if (typeof window.fbAuth.getRedirectResult === 'function') {" +
            "    window.fbAuth.getRedirectResult()" +
            "      .then(function(r) { console.log('[Auth] onResume redirect result:', r && r.user ? 'user found' : 'no user'); })" +
            "      .catch(function(e) { console.warn('[Auth] onResume redirect error:', e && e.code); });" +
            "  }" +
            "}",
            null
        );
    }
    @Override protected void onPause()   { super.onPause();   if (bannerAdView != null) bannerAdView.pause(); }
    @Override protected void onDestroy() { super.onDestroy(); if (bannerAdView != null) bannerAdView.destroy(); if (webView != null) webView.destroy(); }
}

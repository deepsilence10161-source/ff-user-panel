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

    private static final int INTERSTITIAL_TRIGGER  = 4;
    private static final int FILE_CHOOSER_REQUEST  = 101;
    private static final int PERMISSION_REQUEST    = 100;

    // =========================================================
    // URLs
    // =========================================================
    private static final String APP_URL =
        "https://deepsilence10161-source.github.io/ff-user-panel/";

    // =========================================================
    // AdMob IDs — ad-manager.js ke saath sync
    // Test IDs abhi, real IDs Play Store se pehle replace karo
    // =========================================================
    // Real IDs (from ad-manager.js — enable before Play Store):
    // private static final String ADMOB_BANNER       = "ca-app-pub-1032532795123223/9718498564";
    // private static final String ADMOB_INTERSTITIAL = "ca-app-pub-1032532795123223/7817221971";
    // private static final String ADMOB_REWARDED     = "ca-app-pub-1032532795123223/5092857849";

    // Test IDs (use during development):
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

        if (isOnline()) webView.loadUrl(APP_URL);
        else webView.loadUrl("file:///android_asset/no_internet.html");

        swipeRefresh.setOnRefreshListener(() -> {
            if (isOnline()) webView.reload();
            else webView.loadUrl("file:///android_asset/no_internet.html");
            swipeRefresh.setRefreshing(false);
        });
    }

    // =========================================================
    // JavaScript Bridge
    // ad-manager.js inhe call karta hai: window.Android.*
    // =========================================================
    public class AndroidBridge {

        // ── Rewarded Ad ──────────────────────────────────────
        // ad-manager.js: window.Android.showRewardedAd(unitId)
        @JavascriptInterface
        public void showRewardedAd(String adUnitId) {
            runOnUiThread(() -> {
                if (rewardedAd != null) {
                    rewardedAd.show(MainActivity.this, rewardItem -> {
                        // ad-manager.js expects: window.onAdRewarded(adUnitId)
                        webView.evaluateJavascript(
                            "window.onAdRewarded && window.onAdRewarded('" + adUnitId + "');",
                            null
                        );
                        loadRewardedAd(); // preload next
                    });
                } else {
                    // ad-manager.js expects: window.onAdFailed(reason)
                    webView.evaluateJavascript(
                        "window.onAdFailed && window.onAdFailed('Ad not ready');",
                        null
                    );
                    loadRewardedAd();
                }
            });
        }

        // Legacy — no args version (compat)
        @JavascriptInterface
        public void showRewardedAd() {
            showRewardedAd(ADMOB_REWARDED);
        }

        // ad-manager.js: window.Android.isRewardedAdReady()
        @JavascriptInterface
        public boolean isRewardedAdReady() {
            return rewardedAd != null;
        }

        // ── Interstitial ──────────────────────────────────────
        // ad-manager.js: window.Android.showInterstitialAd(unitId)
        @JavascriptInterface
        public void showInterstitialAd(String adUnitId) {
            runOnUiThread(() -> {
                if (interstitialAd != null) {
                    interstitialAd.show(MainActivity.this);
                } else {
                    // Callback even if no ad — match flow nahi rukna chahiye
                    webView.evaluateJavascript(
                        "window.onInterstitialDismissed && window.onInterstitialDismissed();",
                        null
                    );
                }
            });
        }

        // Legacy
        @JavascriptInterface
        public void showInterstitial(String adUnitId) { showInterstitialAd(adUnitId); }

        // ── Banner ────────────────────────────────────────────
        // ad-manager.js: window.Android.showBannerAd(unitId)
        @JavascriptInterface
        public void showBannerAd(String adUnitId) {
            runOnUiThread(() -> {
                if (bannerAdView != null) {
                    bannerAdView.setVisibility(View.VISIBLE);
                    // ad-manager.js expects: window.onBannerLoaded()
                    webView.evaluateJavascript(
                        "window.onBannerLoaded && window.onBannerLoaded();",
                        null
                    );
                }
            });
        }

        // Legacy
        @JavascriptInterface
        public void showBanner(String adUnitId) { showBannerAd(adUnitId); }

        // ad-manager.js: window.Android.hideBannerAd()
        @JavascriptInterface
        public void hideBannerAd() {
            runOnUiThread(() -> {
                if (bannerAdView != null) bannerAdView.setVisibility(View.GONE);
            });
        }

        // Legacy
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

        // KEY FIX: WebView marker hatao — Google login fix
        s.setUserAgentString(s.getUserAgentString().replace("; wv)", ")"));

        // Bridge inject
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
                pageLoadCount++;
                // Auto interstitial har 4 page load
                if (pageLoadCount % INTERSTITIAL_TRIGGER == 0) showInterstitialNative();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                String url = req.getUrl().toString();
                if (url.contains("accounts.google.com")  ||
                    url.contains("firebaseapp.com")       ||
                    url.contains("deepsilence10161-source.github.io")) {
                    return false; // WebView mein rehne do
                }
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

            // Popup — Firebase signInWithPopup ke liye
            @Override
            public boolean onCreateWindow(WebView v, boolean isDialog,
                    boolean isUserGesture, Message resultMsg) {
                WebView popup = new WebView(MainActivity.this);
                WebSettings ps = popup.getSettings();
                ps.setJavaScriptEnabled(true);
                ps.setDomStorageEnabled(true);
                ps.setUserAgentString(ps.getUserAgentString().replace("; wv)", ")"));

                AlertDialog d = new AlertDialog.Builder(MainActivity.this)
                    .setView(popup).create();

                popup.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView vv, WebResourceRequest r) {
                        if (r.getUrl().toString().contains("deepsilence10161-source.github.io")) {
                            d.dismiss(); webView.reload(); return true;
                        }
                        return false;
                    }
                });
                popup.setWebChromeClient(new WebChromeClient() {
                    @Override public void onCloseWindow(WebView w) {
                        d.dismiss(); webView.reload();
                    }
                });

                d.show();
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
                resultMsg.sendToTarget();
                return true;
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
        });
    }

    private void setupBannerAd() {
        bannerAdView = findViewById(R.id.bannerAdView);
        if (bannerAdView == null) return;
        try {
            // adSize + adUnitId already set in activity_main.xml
            // Java mein dobara set karne se "IllegalStateException: ad size already set" aata hai
            bannerAdView.loadAd(new AdRequest.Builder().build());
        } catch (Exception e) {
            // Ad fail ho to bhi app crash nahi karega
        }
    }

    private void loadInterstitialAd() {
        InterstitialAd.load(this, ADMOB_INTERSTITIAL,
            new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull InterstitialAd ad) {
                    interstitialAd = ad;
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override public void onAdDismissedFullScreenContent() {
                            // ad-manager.js callback
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
                @Override public void onAdLoaded(@NonNull RewardedAd ad) {
                    rewardedAd = ad;
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError e) {
                    rewardedAd = null;
                }
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

    @Override protected void onResume()  { super.onResume();  if (bannerAdView != null) bannerAdView.resume(); }
    @Override protected void onPause()   { super.onPause();   if (bannerAdView != null) bannerAdView.pause(); }
    @Override protected void onDestroy() { super.onDestroy(); if (bannerAdView != null) bannerAdView.destroy(); if (webView != null) webView.destroy(); }
}

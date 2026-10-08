package com.miniesports.app;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.util.Log;
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

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;

import android.os.Build;
import android.provider.Settings;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.app.ActivityCompat;
import androidx.core.content.FileProvider;
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
    /* BUG FIX (2026-07): see setOnChildScrollUpCallback below — tracks the
       WEB PAGE's actual scroll position (reported via the JS bridge),
       since SwipeRefreshLayout can't see inside a WebView's own scrolling
       divs on its own. */
    private volatile boolean isContentAtTop = true;
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
    private static final int INSTALL_PERMISSION_REQUEST = 103;

    private final AtomicBoolean isApkDownloading = new AtomicBoolean(false);
    private volatile File pendingInstallApkFile = null;
    private volatile boolean _oldApkCleanupDone = false;

    /* ── D7 (2026-10-07): permission-request observability + retry ──
       TAG logcat me dikhta hai (CI ka location-permission-e2e job logcat
       dump karta hai), aur permAskCount duplicate prompt rokta hai. */
    private static final String TAG = "MiniEsportsApp";
    private final android.os.Handler permHandler =
            new android.os.Handler(android.os.Looper.getMainLooper());
    private int permAskCount = 0;

    /* ✅ D7 FIX (2026-10-07, CI-proof): Android 12+ (API 31+) ka rule — agar
       app ka targetSdk >= 31 hai to ACCESS_FINE_LOCATION AKELA maangna system
       chupchap IGNORE kar deta hai (koi dialog nahi). Saath me onCreate ke
       waqt bhi kuch ROMs request drop kar dete hain. Isliye:
         (1) COARSE + FINE DONO ek saath maangte hain (Android 12+ ka
             sarkaari tareeka),
         (2) requests onCreate + 4s + 12s par retry hoti hain (sirf tab jab
             koi system dialog saamne na ho),
         (3) har check logcat me likhta hai — CI se pakka pata chalta hai
             ki app ne maanga tha ya nahi.
       Live proof (run 37663353788/37665593158): API 34 par 16 koshish (~80s)
       tak ek bhi permissioncontroller window nahi aayi thi, focus pura waqt
       MainActivity par — yaani location kabhi grant hi nahi hota tha aur city
       auto-detect (core/modal.js) chupchap fail jata tha. */
    private java.util.ArrayList<String> _missingCorePerms() {
        java.util.ArrayList<String> needed = new java.util.ArrayList<>();
        boolean fineMissing = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != android.content.pm.PackageManager.PERMISSION_GRANTED;
        if (fineMissing) {
            needed.add(Manifest.permission.ACCESS_COARSE_LOCATION);
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= 33 &&
                ActivityCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS")
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            needed.add("android.permission.POST_NOTIFICATIONS");
        }
        return needed;
    }

    private void _askCorePerms(java.util.ArrayList<String> needed, String from) {
        if (needed == null || needed.isEmpty()) return;
        if (isFinishing() || isDestroyed()) return;
        if (permAskCount >= 3) return;
        permAskCount++;
        Log.i(TAG, "perm-ask(" + from + ", #" + permAskCount + "): " + needed);
        ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == PERMISSION_REQUEST) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < (perms == null ? 0 : perms.length); i++) {
                sb.append(perms[i]).append("=")
                  .append(i < results.length && results[i] == android.content.pm.PackageManager.PERMISSION_GRANTED ? "granted" : "denied")
                  .append(" ");
            }
            Log.i(TAG, "perm-result: " + sb);
        }
    }

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

        /* ═══ APP GUARD (2026-10-08): Check if app is blocked ═══ */
        String blockMsg = AppGuard.getBlockMessage(this);
        if (blockMsg != null) {
            showBlockScreen(blockMsg);
            return; // Don't continue loading the app
        }

        showLastCrashIfAny();
        setContentView(R.layout.activity_main);

        /* R23: OneSignal verification-dialog — subscription server पर register
           होते ही एक बार दिखता है; notification-permission सिर्फ उसके
           "Got it" button से माँगी जाती है (launch पर नहीं)। */
        OneSignalManager.setupPushSubscriptionObserver(this);
        /* ── ✅ FIX (2026-10-06): launch par sirf wahi permissions maango jo
           asli me zaroori hain ────────────────────────────────────────────
           PEHLE: CAMERA + ACCESS_FINE_LOCATION + READ_EXTERNAL_STORAGE
             → app khulte hi "Allow Mini eSports to take pictures and record
               video?" dialog (splash ke upar) aata tha. Camera poori app me
               kahin use hi nahi hota (verified) — naya user ghabra kar Deny
               daba deta tha, aur Play Store policy me bhi bina-zaroorat
               permission sawal uthati hai.
           AB: sirf LOCATION (city-detect — core/modal.js me use hota hai)
               aur NOTIFICATION (Android 13+ par POST_NOTIFICATIONS).
           Camera ki zaroorat sirf ADMIN panel ko OCR ke liye hai, aur woh
           alag web-app hai — uski permission wahan browser handle karta hai. */
        java.util.ArrayList<String> _needed = _missingCorePerms();
        Log.i(TAG, "perm-check(onCreate): missing=" + _needed + " askCount=" + permAskCount);
        _askCorePerms(_needed, "onCreate");
        /* ✅ D7-FOLLOW-UP (2026-10-07): kuch ROMs/API-34 emulator par
           onCreate ke waqt request chupchap drop ho jati hai (koi dialog
           hi nahi). 4s aur 12s baad dobara check karo — par tab HI maango
           jab koi system dialog saamne na ho (hasWindowFocus true), warna
           user ko do baar prompt dikh sakta hai. Log se CI me saaf pata
           chalega ki app ne request bheji thi ya nahi. */
        permHandler.postDelayed(() -> {
            java.util.ArrayList<String> n = _missingCorePerms();
            Log.i(TAG, "perm-check(4s): missing=" + n + " askCount=" + permAskCount + " focus=" + hasWindowFocus());
            if (!n.isEmpty() && permAskCount < 3 && hasWindowFocus()) _askCorePerms(n, "retry-4s");
        }, 4000);
        permHandler.postDelayed(() -> {
            java.util.ArrayList<String> n = _missingCorePerms();
            Log.i(TAG, "perm-check(12s): missing=" + n + " askCount=" + permAskCount + " focus=" + hasWindowFocus());
            if (!n.isEmpty() && permAskCount < 3 && hasWindowFocus()) _askCorePerms(n, "retry-12s");
        }, 12000);

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
        cleanupOldUpdateApks();

        handleIntent(getIntent());

        if (isOnline()) webView.loadUrl(APP_URL);
        else webView.loadUrl("file:///android_asset/no_internet.html");

        swipeRefresh.setEnabled(false);
        swipeRefresh.setOnRefreshListener(() -> swipeRefresh.setRefreshing(false));

        /* Disable native pull-to-refresh reload so dragging down inside modals
           or pressing back never triggers a full WebView reload. */
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> true);
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

        /* ✅ FIX (2026-10-06): login screen par back press se app band karne
           ke liye. Pehle back button hamesha JS router (window.goBack) ko
           diya jaata tha jo login screen par kuch nahi karta tha — user ko
           lagta tha "back button chalta hi nahi". Ab JS login-screen detect
           karke yeh method call karta hai (core/utils.js → goBack()). */
        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    finish();
                }
            });
        }

        /* R23 (2026-09-21): OneSignal native push — WebView के user को
           native SDK से bind/unbind करना (external_id = firebase-uid).
           OneSignalManager.login(uid) → OneSignal.login. */
        @JavascriptInterface
        public void osLogin(String uid) {
            try {
                if (uid != null && uid.length() > 10) {
                    OneSignalManager.login(uid);
                }
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void osLogout() {
            try {
                OneSignalManager.logout();
            } catch (Exception ignored) { }
        }

        /* ✅ FORCE UPDATE (2026-07): returns the REAL installed APK's
           versionName straight from PackageManager — this can only change
           by actually installing a new build, so it can't be spoofed by
           clearing localStorage/app data or by anything the web page does.
           Used by features/app-config.js to compare against
           appMinSupportedVersion from Supabase. */
        @JavascriptInterface
        public String getAppVersion() {
            try {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                return pi.versionName != null ? pi.versionName : "";
            } catch (Exception e) {
                return "";
            }
        }

        /* ✅ FORCE UPDATE (2026-07): SHA-256 of the APK's signing certificate.
           A version NUMBER inside an APK is just a string in the manifest —
           anyone can decompile the APK, edit versionName, and rebuild it
           (self-signed, since they don't have the real keystore). This
           fingerprint is tied to the actual signing key used by our own
           GitHub Actions release build, so a resigned/tampered APK will
           report a DIFFERENT hash here even if its versionName was edited
           to claim it's up to date. Optional: only enforced if
           window.CFG.appExpectedSigningHash is set in Admin Panel. */
        @JavascriptInterface
        public String getPackageIntegrityStatus() {
            try {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                String hash = AppGuard.getSigningHash(MainActivity.this);
                boolean debuggable = (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
                SharedPreferences guardPrefs = MainActivity.this.getSharedPreferences("__app_guard_internals", MODE_PRIVATE);
                int highestVC = guardPrefs.getInt("_last_vc", pi.versionCode);
                return "{\"versionCode\":" + pi.versionCode +
                       ",\"versionName\":\"" + (pi.versionName != null ? pi.versionName : "") + "\"" +
                       ",\"signingHash\":\"" + hash + "\"" +
                       ",\"packageName\":\"" + getPackageName() + "\"" +
                       ",\"isDebuggable\":" + debuggable +
                       ",\"highestVersionCode\":" + highestVC + "}";
            } catch (Exception e) { return "{\"error\":\"" + e.getMessage() + "\"}"; }
        }

        @JavascriptInterface
        public String getSigningHash() {
            try {
                Signature sig;
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    PackageInfo pi = getPackageManager().getPackageInfo(
                        getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                    if (pi.signingInfo == null) return "";
                    Signature[] sigs = pi.signingInfo.hasMultipleSigners()
                        ? pi.signingInfo.getApkContentsSigners()
                        : pi.signingInfo.getSigningCertificateHistory();
                    if (sigs == null || sigs.length == 0) return "";
                    sig = sigs[0];
                } else {
                    PackageInfo pi = getPackageManager().getPackageInfo(
                        getPackageName(), PackageManager.GET_SIGNATURES);
                    if (pi.signatures == null || pi.signatures.length == 0) return "";
                    sig = pi.signatures[0];
                }
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] digest = md.digest(sig.toByteArray());
                StringBuilder sb = new StringBuilder();
                for (byte b : digest) sb.append(String.format("%02X", b));
                return sb.toString();
            } catch (Exception e) {
                return "";
            }
        }

        /* BUG FIX (2026-07): called from JS (see styles/scroll listener in
           the web app) whenever #mainContent's scrollTop changes, so
           native pull-to-refresh (see setOnChildScrollUpCallback above)
           only fires when the page is genuinely scrolled to the top. */
        @JavascriptInterface
        public void reportScrollTop(boolean atTop) {
            runOnUiThread(() -> isContentAtTop = atTop);
        }

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

        // ── Native WhatsApp Share ─────────────────────────────
        // core/utils.js: window.Android.nativeShareWhatsApp(text)
        // ✅ FEATURE (2026-08-29): Junaid ka explicit, repeated final
        // instruction — "kahi bhi apk me url use na ho WhatsApp
        // kholne ke liye, direct app khole package name se". This is
        // a genuine ACTION_SEND intent addressed directly at the
        // com.whatsapp package — it never builds, parses, or navigates
        // to any wa.me / whatsapp:// / intent:// URL string anywhere
        // in this method, so it is structurally immune to the entire
        // net::ERR_UNKNOWN_URL_SCHEME bug class that kept recurring
        // across many sessions with every URL-based approach. Tries
        // the regular WhatsApp package first, then WhatsApp Business,
        // then falls back to Android's own generic share chooser
        // (still zero URLs — a plain ACTION_SEND with no target
        // package lets the OS show every app that can handle text,
        // including WhatsApp if installed under a name this method
        // didn't anticipate).
        @JavascriptInterface
        public void nativeShareWhatsApp(String text) {
            runOnUiThread(() -> {
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType("text/plain");
                sendIntent.putExtra(Intent.EXTRA_TEXT, text);

                sendIntent.setPackage("com.whatsapp");
                try {
                    startActivity(sendIntent);
                    return;
                } catch (Exception e) { /* not installed, try Business next */ }

                sendIntent.setPackage("com.whatsapp.w4b");
                try {
                    startActivity(sendIntent);
                    return;
                } catch (Exception e) { /* not installed either */ }

                // Neither WhatsApp variant found — generic chooser,
                // still no URL of any kind involved.
                sendIntent.setPackage(null);
                try {
                    startActivity(Intent.createChooser(sendIntent, "Share via"));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this,
                        "Koi app nahi mila share karne ke liye", Toast.LENGTH_SHORT).show();
                }
            });
        }

        // ── Native Android System Share Sheet (ACTION_SEND Chooser) ──
        @JavascriptInterface
        public void nativeShare(String title, String text) {
            runOnUiThread(() -> {
                try {
                    Intent sendIntent = new Intent(Intent.ACTION_SEND);
                    sendIntent.setType("text/plain");
                    if (title != null && !title.isEmpty()) {
                        sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                    }
                    sendIntent.putExtra(Intent.EXTRA_TEXT, text != null ? text : "");
                    Intent chooser = Intent.createChooser(sendIntent,
                        (title != null && !title.isEmpty()) ? title : "Share via");
                    startActivity(chooser);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this,
                        "Koi app nahi mila share karne ke liye", Toast.LENGTH_SHORT).show();
                }
            });
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

        // ── Old APK Cleanup ───────────────────────────────────
        /* ✅ APP GUARD (2026-10-08): Device-wide old APK cleanup.
           JS se call kar sakte ho: window.Android.cleanOldApks()
           Downloads, Bluetooth, WhatsApp, etc. se purani APK files
           delete karta hai. Returns count of deleted files. */
        @JavascriptInterface
        public int cleanOldApks() {
            try {
                return OldApkCleaner.cleanDeviceApks(MainActivity.this);
            } catch (Exception e) {
                Log.w(TAG, "cleanOldApks error: " + e.getMessage());
                return 0;
            }
        }

        /* ✅ APP GUARD: Request MANAGE_EXTERNAL_STORAGE permission
           (Android 11+). JS se call: window.Android.requestStoragePermission()
           Returns: true if already granted, false if dialog shown. */
        @JavascriptInterface
        public boolean requestStoragePermission() {
            try {
                return OldApkCleaner.requestStoragePermission(MainActivity.this);
            } catch (Exception e) {
                Log.w(TAG, "requestStoragePermission error: " + e.getMessage());
                return false;
            }
        }

        /* ✅ APP GUARD: Check if storage permission is needed. */
        @JavascriptInterface
        public boolean needsStoragePermission() {
            try {
                return OldApkCleaner.needsStoragePermission(MainActivity.this);
            } catch (Exception e) {
                return false;
            }
        }

        // ── In-App Direct APK Update (Download + Smart Resume + Cache + Native Install) ──
        @JavascriptInterface
        public boolean hasCachedUpdateApk(String targetVersion) {
            try {
                File dir = getUpdatesDir();
                String safeVer = sanitizeVersionTag(targetVersion);
                File apkFile = new File(dir, "MiniEsports-v" + safeVer + ".apk");
                return isValidApkFile(apkFile);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void downloadAndInstallApk(String apkUrl, String targetVersion) {
            if (apkUrl == null || apkUrl.trim().isEmpty()) {
                emitApkProgress(0, 0, 0, "error", "APK download link configured nahi hai");
                return;
            }
            final String cleanUrl = apkUrl.trim();
            final String safeVer = sanitizeVersionTag(targetVersion);
            final File dir = getUpdatesDir();
            final File finalApk = new File(dir, "MiniEsports-v" + safeVer + ".apk");
            final File partApk  = new File(dir, "MiniEsports-v" + safeVer + ".apk.part");

            // 1. Smart Cache Check: agar valid APK pehle se downloaded hai, seedha install prompt kholo!
            if (isValidApkFile(finalApk)) {
                long len = finalApk.length();
                emitApkProgress(100, len, len, "ready", "Update pehle se downloaded hai — installer khul raha hai...");
                runOnUiThread(() -> promptInstallApk(finalApk));
                return;
            }

            if (!isApkDownloading.compareAndSet(false, true)) {
                emitApkProgress(-1, 0, 0, "downloading", "Download pehle se chal raha hai...");
                return;
            }

            new Thread(() -> {
                HttpURLConnection conn = null;
                InputStream in = null;
                FileOutputStream out = null;
                try {
                    if (!dir.exists()) dir.mkdirs();

                    // Purane versions ke incomplete .part ya purane .apk files saaf karo
                    File[] existingFiles = dir.listFiles();
                    if (existingFiles != null) {
                        for (File f : existingFiles) {
                            String nm = f.getName();
                            if (!nm.equals(finalApk.getName()) && !nm.equals(partApk.getName())) {
                                try { f.delete(); } catch (Exception ignored) {}
                            }
                        }
                    }

                    long downloadedBytes = partApk.exists() ? partApk.length() : 0L;
                    emitApkProgress(0, downloadedBytes, 0, "connecting",
                        downloadedBytes > 0 ? "Download resume ho raha hai..." : "Server se connect ho raha hai...");

                    String currentUrl = cleanUrl;
                    int redirects = 0;
                    int responseCode = -1;
                    while (redirects < 8) {
                        URL u = new URL(currentUrl);
                        conn = (HttpURLConnection) u.openConnection();
                        conn.setInstanceFollowRedirects(false);
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(25000);
                        conn.setUseCaches(false);
                        conn.setRequestProperty("User-Agent", "MiniEsports-Android-Updater/2.0");
                        conn.setRequestProperty("Accept", "application/vnd.android.package-archive,application/octet-stream,*/*");
                        conn.setRequestProperty("Accept-Encoding", "identity");
                        conn.setRequestProperty("Connection", "keep-alive");
                        if (downloadedBytes > 0) {
                            conn.setRequestProperty("Range", "bytes=" + downloadedBytes + "-");
                        }
                        conn.connect();
                        responseCode = conn.getResponseCode();
                        if (responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                            responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                            responseCode == HttpURLConnection.HTTP_SEE_OTHER  ||
                            responseCode == 307 || responseCode == 308) {
                            String loc = conn.getHeaderField("Location");
                            conn.disconnect();
                            if (loc == null || loc.isEmpty()) break;
                            currentUrl = new URL(u, loc).toString();
                            redirects++;
                            continue;
                        }
                        break;
                    }

                    boolean appendMode = false;
                    long totalBytes = -1L;

                    if (responseCode == HttpURLConnection.HTTP_PARTIAL) {
                        // 206 Partial Content — server supports Range resume
                        appendMode = true;
                        long contentLen = conn.getContentLengthLong();
                        if (contentLen > 0) totalBytes = downloadedBytes + contentLen;
                    } else if (responseCode == HttpURLConnection.HTTP_OK) {
                        // 200 OK — start fresh from 0
                        appendMode = false;
                        downloadedBytes = 0L;
                        totalBytes = conn.getContentLengthLong();
                    } else if (responseCode == 416 && partApk.exists() && partApk.length() > 1024 * 1024) {
                        // 416 Range Not Satisfiable — file may already be 100% downloaded in .part
                        if (isValidApkFile(partApk)) {
                            if (finalApk.exists()) finalApk.delete();
                            partApk.renameTo(finalApk);
                            long sz = finalApk.length();
                            emitApkProgress(100, sz, sz, "ready", "Download complete! Installer khul raha hai...");
                            runOnUiThread(() -> promptInstallApk(finalApk));
                            return;
                        } else {
                            partApk.delete();
                            throw new Exception("Corrupt partial file reset — dobara Update Now dabayein");
                        }
                    } else {
                        throw new Exception("Server HTTP " + responseCode);
                    }

                    in = new BufferedInputStream(conn.getInputStream(), 262144);
                    out = new FileOutputStream(partApk, appendMode);
                    BufferedOutputStream bos = new BufferedOutputStream(out, 262144);

                    byte[] buf = new byte[131072];
                    int n;
                    long lastEmitMs = System.currentTimeMillis();
                    long speedWindowStartMs = lastEmitMs;
                    long speedWindowBytes = 0L;
                    String speedLabel = "";
                    while ((n = in.read(buf)) != -1) {
                        bos.write(buf, 0, n);
                        downloadedBytes += n;
                        speedWindowBytes += n;
                        long now = System.currentTimeMillis();
                        if (now - lastEmitMs >= 100) {
                            long elapsedSecMs = Math.max(1L, now - speedWindowStartMs);
                            if (elapsedSecMs >= 400) {
                                double bytesPerSec = (speedWindowBytes * 1000.0) / elapsedSecMs;
                                if (bytesPerSec >= 1024 * 1024) {
                                    speedLabel = String.format(java.util.Locale.US, " (%.1f MB/s)", bytesPerSec / (1024.0 * 1024.0));
                                } else {
                                    speedLabel = String.format(java.util.Locale.US, " (%.0f KB/s)", bytesPerSec / 1024.0);
                                }
                                speedWindowStartMs = now;
                                speedWindowBytes = 0L;
                            }
                            lastEmitMs = now;
                            int pct = (totalBytes > 0)
                                ? (int) Math.min(99L, (downloadedBytes * 100L) / totalBytes)
                                : -1;
                            emitApkProgress(pct, downloadedBytes, totalBytes, "downloading", "In-app downloading" + speedLabel + "...");
                        }
                    }
                    bos.flush();
                    bos.close();
                    out = null;
                    in.close();
                    in = null;

                    emitApkProgress(99, downloadedBytes, totalBytes, "verifying", "APK verify ho raha hai...");

                    // Verify that downloaded file is a genuine, uncorrupted Android APK
                    if (!isValidApkFile(partApk)) {
                        partApk.delete();
                        throw new Exception("Downloaded file valid APK nahi hai (corrupt ya incomplete download)");
                    }

                    if (finalApk.exists()) finalApk.delete();
                    if (!partApk.renameTo(finalApk)) {
                        throw new Exception("APK file save nahi ho paya");
                    }

                    // Track path + register hash for post-install cleanup
                    try {
                        getSharedPreferences("__app_guard_internals", MODE_PRIVATE)
                            .edit().putString("_last_download_path", finalApk.getAbsolutePath()).apply();
                        OldApkCleaner.registerApkHash(MainActivity.this, finalApk.getAbsolutePath());
                    } catch (Exception ignored) {}

                    emitApkProgress(100, downloadedBytes, downloadedBytes, "ready", "Download 100% complete! Installer khul raha hai...");
                    runOnUiThread(() -> promptInstallApk(finalApk));

                } catch (Exception e) {
                    long partLen = partApk.exists() ? partApk.length() : 0L;
                    String errMsg = e.getMessage() != null ? e.getMessage() : "Network error";
                    emitApkProgress(-1, partLen, 0, "error",
                        partLen > 0
                            ? ("Download ruka (" + formatMb(partLen) + " saved) — Retry karne par yahin se resume hoga")
                            : ("Download fail: " + errMsg));
                } finally {
                    isApkDownloading.set(false);
                    try { if (out != null) out.close(); } catch (Exception ignored) {}
                    try { if (in != null) in.close(); } catch (Exception ignored) {}
                    try { if (conn != null) conn.disconnect(); } catch (Exception ignored) {}
                }
            }, "MiniEsports-ApkUpdater").start();
        }
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
        else if (req == INSTALL_PERMISSION_REQUEST) {
            if (pendingInstallApkFile != null && pendingInstallApkFile.exists()) {
                File f = pendingInstallApkFile;
                pendingInstallApkFile = null;
                promptInstallApk(f);
            }
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

                /* ✅ SAFETY NET (2026-08-26, now defensive-only as of
                   2026-08-29): this block is no longer the primary
                   WhatsApp-open path — the JS side now calls
                   window.Android.nativeShareWhatsApp() directly (a
                   pure ACTION_SEND intent, zero URLs involved at all,
                   see the AndroidBridge class above), per Junaid's
                   explicit final instruction to never use any URL for
                   this. This block is kept only as defensive insurance
                   against a whatsapp:// URL from some source outside
                   this app's own control (e.g. a third-party ad SDK) —
                   it should essentially never fire in normal use now
                   that nothing in our own JS generates such a URL. */
                if (url.startsWith("whatsapp://") || url.startsWith("whatsapp:")) {
                    try {
                        String text = "";
                        int qIdx = url.indexOf('?');
                        if (qIdx >= 0) {
                            String query = url.substring(qIdx + 1);
                            for (String param : query.split("&")) {
                                if (param.startsWith("text=")) {
                                    text = java.net.URLDecoder.decode(
                                        param.substring(5), "UTF-8");
                                    break;
                                }
                            }
                        }
                        Intent waIntent = new Intent(Intent.ACTION_SEND);
                        waIntent.setType("text/plain");
                        waIntent.setPackage("com.whatsapp");
                        waIntent.putExtra(Intent.EXTRA_TEXT, text);
                        startActivity(waIntent);
                    } catch (Exception e) {
                        // WhatsApp not installed / package mismatch — fall
                        // back to the universal wa.me web link instead of
                        // failing silently.
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW,
                                Uri.parse("https://wa.me/")));
                        } catch (Exception ignored) { }
                    }
                    return true;
                }

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

                // Direct APK update URLs — NEVER open external browser! Always download & install in-app!
                if (url.endsWith(".apk") || url.contains("MiniEsports.apk") || url.contains("/releases/latest/download/")) {
                    new AndroidBridge().downloadAndInstallApk(url, "latest");
                    return true;
                }

                // Baaki external links → browser
                if (url.startsWith("http") || url.startsWith("https")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }

                // ✅ PAYTM/UPI FIX: custom-scheme deep links (upi://, gpay://,
                // phonepe://, paytmmp://, intent://) — WebView khud inhe load
                // nahi kar sakta, pehle ye silently fail ho rahe the (return false
                // pe WebView "upi://..." ko ek normal webpage ki tarah load karne
                // ki koshish karta tha, jo hamesha fail hota). Ab UPI apps ko ya to
                // ACTION_VIEW se ya (Chrome-style "intent://" links ke liye)
                // Intent.parseUri se explicitly launch karte hain. Paytm checkout
                // bhi UPI app launch ke liye yehi scheme use karega.
                try {
                    Intent extIntent = url.startsWith("intent://")
                        ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                        : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(extIntent);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this,
                        "Ye UPI app installed nahi hai is phone mein", Toast.LENGTH_SHORT).show();
                }
                return true;
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
                    GeolocationPermissions.Callback cb) {
                /* ✅ D7 FIX (2026-10-07): pehle HAR origin ko bina poochhe
                   true kar diya jata tha — redirect/ads wala koi bhi page
                   location maang sakta tha. Ab sirf apne hi hosts allow,
                   baaki deny (WebView ka origin whitelist). */
                boolean _ours = origin != null && (origin.contains("deepsilence10161-source.github.io")
                        || origin.contains("deepsilence10161.workers.dev")
                        || origin.startsWith("file://"));
                cb.invoke(origin, _ours, false);
            }

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
                        // ✅ PAYTM/UPI FIX: same custom-scheme handling as main WebView
                        if (!url.startsWith("http")) {
                            d.dismiss();
                            try {
                                Intent extIntent = url.startsWith("intent://")
                                    ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                                    : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                startActivity(extIntent);
                            } catch (Exception e) {
                                Toast.makeText(MainActivity.this,
                                    "Ye UPI app installed nahi hai is phone mein", Toast.LENGTH_SHORT).show();
                            }
                            return true;
                        }
                        // BUG FIX (2026-07): any other http(s) link that reaches here (e.g.
                        // https://wa.me/... from the WhatsApp share buttons) used to fall
                        // through to `return false`, which made this popup WebView try to
                        // load it as an ordinary webpage instead of handing it to Android —
                        // so tapping "Share on WhatsApp" quietly opened a near-invisible
                        // dialog showing the wa.me redirect page instead of the WhatsApp
                        // app. Mirror the main WebView's behaviour: dismiss this popup and
                        // let the OS route it to whichever app handles it.
                        if (url.endsWith(".apk") || url.contains("MiniEsports.apk") || url.contains("/releases/latest/download/")) {
                            d.dismiss();
                            new AndroidBridge().downloadAndInstallApk(url, "latest");
                            return true;
                        }
                        d.dismiss();
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        } catch (Exception e) {
                            Toast.makeText(MainActivity.this,
                                "Is link ko kholne wala koi app nahi mila", Toast.LENGTH_SHORT).show();
                        }
                        return true;
                    }
                });
                d.show();
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
        });

        // Intercept any WebView download (.apk) so it ALWAYS runs in-app without opening browser
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url != null && (url.endsWith(".apk") || url.contains("MiniEsports.apk") ||
                "application/vnd.android.package-archive".equalsIgnoreCase(mimeType))) {
                new AndroidBridge().downloadAndInstallApk(url, "latest");
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

    private void showBlockScreen(String message) {
        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setGravity(android.view.Gravity.CENTER);
        layout.setBackgroundColor(0xFF0A0D14);
        layout.setPadding(48, 48, 48, 48);
        android.widget.TextView icon = new android.widget.TextView(this);
        icon.setText("\u26D4");
        icon.setTextSize(64);
        icon.setGravity(android.view.Gravity.CENTER);
        layout.addView(icon);
        android.widget.TextView title = new android.widget.TextView(this);
        title.setText("Update Required");
        title.setTextSize(24);
        title.setTextColor(0xFFFF4444);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 32, 0, 16);
        layout.addView(title);
        android.widget.TextView msg = new android.widget.TextView(this);
        msg.setText(message);
        msg.setTextSize(16);
        msg.setTextColor(0xFFCCCCCC);
        msg.setGravity(android.view.Gravity.CENTER);
        msg.setPadding(0, 0, 0, 32);
        layout.addView(msg);
        android.widget.Button btn = new android.widget.Button(this);
        btn.setText("Update Now");
        btn.setBackgroundColor(0xFF00D4FF);
        btn.setTextColor(0xFF00212B);
        btn.setTextSize(18);
        btn.setPadding(32, 16, 32, 16);
        btn.setOnClickListener(v -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://github.com/deepsilence10161-source/ff-user-panel/releases/latest")));
            } catch (Exception e) {
                Toast.makeText(this, "Browser nahi khula", Toast.LENGTH_SHORT).show();
            }
        });
        layout.addView(btn);
        setContentView(layout);
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo ni = cm.getActiveNetworkInfo();
        return ni != null && ni.isConnected();
    }

    // =========================================================
    // In-App APK Update Helpers (Cache, Verify, Cleanup, Install)
    // =========================================================
    private File getUpdatesDir() {
        File ext = getExternalFilesDir(null);
        File base = (ext != null) ? ext : getFilesDir();
        File dir = new File(base, "updates");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private String sanitizeVersionTag(String ver) {
        if (ver == null || ver.trim().isEmpty()) return "latest";
        String clean = ver.trim().replaceAll("[^A-Za-z0-9._-]", "_");
        return clean.isEmpty() ? "latest" : clean;
    }

    private String formatMb(long bytes) {
        return String.format(java.util.Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0));
    }

    private boolean isValidApkFile(File f) {
        if (f == null || !f.exists() || f.length() < 512 * 1024) return false;
        try {
            PackageInfo pi = getPackageManager().getPackageArchiveInfo(f.getAbsolutePath(), 0);
            return pi != null && pi.packageName != null && !pi.packageName.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    private void cleanupOldUpdateApks() {
        new Thread(() -> {
            try {
                File dir = getUpdatesDir();
                File[] files = dir.listFiles();
                if (files == null || files.length == 0) return;
                PackageInfo installedPi = getPackageManager().getPackageInfo(getPackageName(), 0);
                int installedCode = installedPi.versionCode;
                String installedName = installedPi.versionName != null ? installedPi.versionName : "";
                long now = System.currentTimeMillis();
                for (File f : files) {
                    String name = f.getName();
                    // Delete stale .part files older than 24h
                    if (name.endsWith(".part") && (now - f.lastModified() > 24L * 3600L * 1000L)) {
                        try { f.delete(); } catch (Exception ignored) {}
                        continue;
                    }
                    if (name.endsWith(".apk")) {
                        try {
                            PackageInfo archivePi = getPackageManager().getPackageArchiveInfo(f.getAbsolutePath(), 0);
                            if (archivePi == null) {
                                f.delete();
                            } else if (archivePi.versionCode <= installedCode ||
                                       installedName.equals(archivePi.versionName)) {
                                // Already installed version (or older) — delete APK to free storage!
                                f.delete();
                            }
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception ignored) {}
        }, "MiniEsports-ApkCleanup").start();
    }

    private void emitApkProgress(int pct, long downloaded, long total, String state, String msg) {
        final String safeState = (state != null ? state : "").replace("'", "\\'");
        final String safeMsg   = (msg != null ? msg : "").replace("'", "\\'");
        if (webView == null) return;
        webView.post(() -> {
            try {
                webView.evaluateJavascript(
                    "if(window._onApkDownloadProgress)window._onApkDownloadProgress(" +
                    pct + "," + downloaded + "," + total + ",'" + safeState + "','" + safeMsg + "');",
                    null
                );
            } catch (Exception ignored) {}
        });
    }

    private void promptInstallApk(File apkFile) {
        if (apkFile == null || !apkFile.exists()) {
            emitApkProgress(-1, 0, 0, "error", "APK file nahi mila");
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!getPackageManager().canRequestPackageInstalls()) {
                    pendingInstallApkFile = apkFile;
                    emitApkProgress(100, apkFile.length(), apkFile.length(), "permission",
                        "Install permission allow karein — wapas aate hi install shuru hoga");
                    Toast.makeText(this, "Please allow 'Install Unknown Apps' for Mini eSports", Toast.LENGTH_LONG).show();
                    Intent permIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())
                    );
                    startActivityForResult(permIntent, INSTALL_PERMISSION_REQUEST);
                    return;
                }
            }
            Uri apkUri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                apkFile
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(installIntent);
            emitApkProgress(100, apkFile.length(), apkFile.length(), "installing",
                "Android Installer khul gaya hai — 'Update / Install' par tap karein");
        } catch (Exception e) {
            emitApkProgress(-1, apkFile.length(), apkFile.length(), "error",
                "Installer open nahi ho paya: " + (e.getMessage() != null ? e.getMessage() : "Error"));
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null) {
            /* Delegate back navigation to SPA JS router (window.goBack) so modals/screens
               close cleanly without triggering a native WebView history reload. */
            webView.evaluateJavascript(
                "(function(){ if(typeof window.goBack==='function'){ window.goBack(); return 'handled'; } return 'none'; })()",
                result -> {
                    if (result == null || !result.contains("handled")) {
                        if (webView.canGoBack()) webView.goBack();
                    }
                }
            );
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        /* ✅ D7: agar onCreate ka request kisi wajah se fire hi nahi hua
           (permAskCount 0), to ab maango — warna duplicate prompt se bachne
           ke liye chhod do (4s/12s wale retry sambhal lenge). */
        if (permAskCount == 0) _askCorePerms(_missingCorePerms(), "onResume");
        if (bannerAdView != null) bannerAdView.resume();
        if (pendingInstallApkFile != null && pendingInstallApkFile.exists()) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getPackageManager().canRequestPackageInstalls()) {
                File f = pendingInstallApkFile;
                pendingInstallApkFile = null;
                promptInstallApk(f);
            }
        }
        /* ✅ APP GUARD (2026-10-08): Auto-clean old APKs from device.
           After update, scan and delete old APK files from Downloads etc.
           If MANAGE_EXTERNAL_STORAGE needed (Android 11+), request it first.
           On next onResume (after user grants), cleanup runs automatically. */
        try {
            if (OldApkCleaner.needsStoragePermission(this)) {
                // Request permission — cleanup will happen on next onResume
                OldApkCleaner.requestStoragePermission(this);
            } else {
                // Permission granted — run cleanup (once per app launch)
                if (!_oldApkCleanupDone) {
                    _oldApkCleanupDone = true;
                    new Thread(() -> {
                        int deleted = OldApkCleaner.cleanDeviceApks(MainActivity.this);
                        if (deleted > 0) {
                            Log.i(TAG, "Auto-cleaned " + deleted + " old APK files from device");
                        }
                        // Start real-time monitoring for future downloads
                        OldApkCleaner.startRealTimeMonitoring(MainActivity.this);
                    }, "OldApkCleanup").start();
                }
            }
        } catch (Exception ignored) {}
    }

    @Override protected void onPause()   { super.onPause();   if (bannerAdView != null) bannerAdView.pause(); }
    @Override protected void onDestroy() {
        super.onDestroy();
        if (bannerAdView != null) bannerAdView.destroy();
        if (webView != null) webView.destroy();
        OldApkCleaner.stopRealTimeMonitoring();
    }
}

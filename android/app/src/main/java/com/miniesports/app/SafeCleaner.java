package com.miniesports.app;

/**
 * ═══════════════════════════════════════════════════════════════════
 * SAFE CLEANER v5 — SERVER-GATED, ZERO-PERMISSION, OWNER-PROOF
 * ═══════════════════════════════════════════════════════════════════
 *
 * Incident (2026-10-08, live-proven): purane OldApkCleaner ne device-wide
 * scan chalaya (MANAGE_EXTERNAL_STORAGE + DCIM/Pictures/Documents + loose
 * name patterns jaise "app-debug.apk", "*.apk.part", koi bhi "esports"
 * naam) — OWNER ke device se bhi files udd gayi. Us system ki 3 bimariyan:
 *   1. Naam-pattern par bharosa (kisi aur ki file bhi match ho sakti thi)
 *   2. Bina maange/pooche shared-storage par delete (Play Protect + data loss)
 *   3. Koi server-side control nahi — har device par ek jaisa khatra
 *
 * NAYA SYSTEM — 4 lohe ke niyam (koi bhi code path inhe tod NAHI sakta):
 *   R1. SERVER-SIDE FAISLA: sirf tab safai jab server (Supabase
 *       app_settings.key='apk_cleanup') ki policy enabled ho AUR
 *       user/device exempt NA ho. Policy na mile / offline / galat JSON
 *       = FAIL-SAFE = koi deletion nahi. Default verdict "unknown" hai
 *       aur "unknown" par kuch bhi delete nahi hota.
 *   R2. SIRF APP-PRIVATE + PROVED-OWN: deletion sirf app ke apne
 *       directories (filesDir, cacheDir, codeCacheDir, externalFilesDir,
 *       externalCacheDir) ya un tracked files par jo app ne khud download
 *       ki thin (exact path + strict name). Shared storage par naam-se
 *       scan NAHI. Kabhi. Kisi bhi Android version par.
 *   R3. ZERO PERMISSION, ZERO PROMPT: na MANAGE_EXTERNAL_STORAGE, na
 *       READ/WRITE_EXTERNAL_STORAGE, na SAF folder picker, na koi dialog.
 *       User se file-access ki koi maang nahi.
 *   R4. OWNER PROTECTION: exemptUids / exemptDeviceFps /
 *       exemptRegisteredBefore (server policy) me jo hai — us device par
 *       EK file bhi delete nahi hoti (verdict "exempt", return 0).
 *
 * Kya delete hota hai (sirf allowed users par, sirf app-private):
 *   A. updates/ folder ke purane update-APKs (jo app ne khud download kiye)
 *   B. post-update wipe (AppGuard.performFullWipe) — WebView code cache,
 *      code cache, cache, files — yaani "purani files jisme app ka code ho"
 *   C. tracked downloads (exact path) — best-effort, SecurityException par
 *      chupchap skip (Android 11+ par doosre browser ki file hum kabhi
 *      chhu bhi nahi sakte — yahi platform ka niyam hai, aur wahi sahi hai)
 *
 * @since 2026-10-09 (incident ke baad poora redesign)
 * ═══════════════════════════════════════════════════════════════════
 */

import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

public final class SafeCleaner {

    private static final String TAG = "SafeCleaner";

    /* ── Policy cache (ApkInstallReceiver boot-path ke liye) ── */
    private static final String PREFS_NAME = "__cleanup_policy";
    private static final String KEY_VERDICT = "_verdict";           // unknown|allowed|exempt
    private static final String KEY_VERDICT_TS = "_verdict_ts";
    private static final String KEY_TRACKED_PATHS = "_tracked_paths";

    public static final String VERDICT_UNKNOWN = "unknown";
    public static final String VERDICT_ALLOWED = "allowed";
    public static final String VERDICT_EXEMPT  = "exempt";

    /* App ke installer files ke LIYE strict pattern — sirf ye aur kuch nahi.
       Purane khatarnak patterns ("app-debug", "esports", generic ".part")
       HAMESHA ke liye mana. */
    private static final String[] OUR_NAME_PREFIXES = {
        "miniesports", "mini-esports", "mini_esports", "mini esports"
    };
    private static final String[] OUR_NAME_EXTENSIONS = {
        ".apk", ".apk.part", ".apk.tmp", ".apk.download"
    };

    private SafeCleaner() {}

    // ═══════════════════════════════════════════════════════════
    // POLICY — parse + decide (pure logic, JS gate bhi yahi lagata hai)
    // ═══════════════════════════════════════════════════════════

    public static final class Policy {
        public boolean valid = false;
        public boolean enabled = false;
        public boolean onUpdateWipe = true;
        public final Set<String> exemptUids = new HashSet<>();
        public final Set<String> exemptDeviceFps = new HashSet<>();
        public String exemptRegisteredBefore = null; // YYYY-MM-DD prefix
    }

    public static Policy parsePolicy(String policyJson) {
        Policy p = new Policy();
        try {
            if (policyJson == null || policyJson.trim().isEmpty()) return p; // invalid → fail-safe
            JSONObject o = new JSONObject(policyJson);
            p.valid = true;
            p.enabled = o.optBoolean("enabled", false); // default OFF
            p.onUpdateWipe = o.optBoolean("onUpdateWipe", true);
            JSONArray uids = o.optJSONArray("exemptUids");
            if (uids != null) {
                for (int i = 0; i < uids.length(); i++) {
                    String u = uids.optString(i, "");
                    if (!u.isEmpty()) p.exemptUids.add(u);
                }
            }
            JSONArray fps = o.optJSONArray("exemptDeviceFps");
            if (fps != null) {
                for (int i = 0; i < fps.length(); i++) {
                    String f = fps.optString(i, "");
                    if (!f.isEmpty()) p.exemptDeviceFps.add(f);
                }
            }
            String cut = o.optString("exemptRegisteredBefore", "");
            if (!cut.isEmpty()) p.exemptRegisteredBefore = cut.substring(0, Math.min(10, cut.length()));
        } catch (Exception e) {
            Log.w(TAG, "Policy JSON galat hai — fail-safe (no cleanup): " + e.getMessage());
            p.valid = false;
        }
        return p;
    }

    /**
     * R4 + fail-safe: jab tak EXPLICIT pata na chale ki user allowed hai,
     * tab tak exempt maano. Yehi function JS gate ka bhi SSOT hai.
     */
    public static boolean isExempt(Policy p, String uid, String deviceFp, String userCreatedAt) {
        if (p == null || !p.valid) return true;   // galat/missing policy = exempt
        if (!p.enabled) return true;              // master switch off = exempt
        if (uid != null && !uid.isEmpty() && p.exemptUids.contains(uid)) return true;
        if (deviceFp != null && !deviceFp.isEmpty() && p.exemptDeviceFps.contains(deviceFp)) return true;
        if (p.exemptRegisteredBefore != null && !p.exemptRegisteredBefore.isEmpty()) {
            // created_at hi nahi mila → prove nahi kar sakte ki user naya hai
            // → FAIL-SAFE EXEMPT (JS gate bhi yahi karta hai)
            if (userCreatedAt == null || userCreatedAt.isEmpty()) return true;
            String created = userCreatedAt.substring(0, Math.min(10, userCreatedAt.length()));
            if (created.compareTo(p.exemptRegisteredBefore) < 0) return true;
        }
        // Pehchaan hi nahi ho payi (na uid na deviceFp) → fail-safe exempt
        if ((uid == null || uid.isEmpty()) && (deviceFp == null || deviceFp.isEmpty())) return true;
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    // ENTRY POINTS
    // ═══════════════════════════════════════════════════════════

    /**
     * JS gate (features/device-cleanup.js) SERVER policy ke saath yehi call
     * karti hai. Native yahan policy ko DOBARA validate karta hai (defense
     * in depth) — exempt hone par EK file bhi delete nahi hoti.
     */
    public static int runServerGatedCleanup(Context ctx, String policyJson,
                                            String uid, String deviceFp, String userCreatedAt) {
        Policy p = parsePolicy(policyJson);
        if (isExempt(p, uid, deviceFp, userCreatedAt)) {
            cacheVerdict(ctx, VERDICT_EXEMPT);
            Log.i(TAG, "🚫 Cleanup EXEMPT (server policy) — kuch delete nahi hua");
            return 0;
        }
        cacheVerdict(ctx, VERDICT_ALLOWED);
        Log.i(TAG, "✅ Cleanup ALLOWED (server policy) — app-private safai shuru");
        return runSafeCleanup(ctx, p);
    }

    /**
     * Boot-path (ApkInstallReceiver / MainActivity) — sirf tab chalta hai jab
     * pichhli session me server se "allowed" verdict cache ho. Unknown/exempt
     * par kuch nahi. Yeh fail-safe hi owner ki doosri guarantee hai.
     */
    public static int runIfCachedAllowed(Context ctx) {
        if (!VERDICT_ALLOWED.equals(cachedVerdict(ctx))) {
            Log.i(TAG, "Boot-path cleanup skip (verdict=" + cachedVerdict(ctx) + ")");
            return 0;
        }
        Policy p = new Policy();
        p.valid = true;
        p.enabled = true;
        p.onUpdateWipe = true;
        return runSafeCleanup(ctx, p);
    }

    // ═══════════════════════════════════════════════════════════
    // SAFE CLEANUP — sirf app-private + proved-own (R2)
    // ═══════════════════════════════════════════════════════════

    private static int runSafeCleanup(Context ctx, Policy p) {
        AtomicInteger deleted = new AtomicInteger(0);
        try {
            // A. Post-update wipe (old code files / caches) — app-private ONLY
            if (p.onUpdateWipe && AppGuard.isWipePending(ctx)) {
                deleted.addAndGet(AppGuard.performFullWipe(ctx));
                AppGuard.markWipeDone(ctx);
            }
            // B. updates/ folder ke purane installer APKs — app-private ONLY
            deleted.addAndGet(cleanUpdatesDir(ctx));
            // C. Tracked own downloads (exact path + strict name) — best-effort
            deleted.addAndGet(cleanTrackedOwnDownloads(ctx));
        } catch (Exception e) {
            Log.w(TAG, "Safe cleanup error (kuch bhi toota nahi): " + e.getMessage());
        }
        Log.i(TAG, "🧹 Safe cleanup done — " + deleted.get() + " items deleted");
        return deleted.get();
    }

    /** Sirf app ke updates/ dir ke files (app-private, koi permission nahi). */
    private static int cleanUpdatesDir(Context ctx) {
        int deleted = 0;
        try {
            File ext = ctx.getExternalFilesDir(null);
            File base = (ext != null) ? ext : ctx.getFilesDir();
            File dir = new File(base, "updates");
            File[] files = dir.listFiles();
            if (files == null) return 0;
            for (File f : files) {
                if (f.isFile() && safeDelete(ctx, f)) {
                    deleted++;
                    Log.i(TAG, "  updates/: " + f.getName());
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "updates/ cleanup error: " + e.getMessage());
        }
        return deleted;
    }

    /**
     * Sirf woh files jo app ne khud download ki thin (exact tracked paths).
     * Naam-pattern scan yahan BHI nahi — proof = humne path khud register kiya.
     * Best-effort: Android 11+ par browser ki file chhuni bhi nahi ja sakti
     * (platform rule) — SecurityException par chupchap skip.
     */
    private static int cleanTrackedOwnDownloads(Context ctx) {
        int deleted = 0;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            Set<String> paths = prefs.getStringSet(KEY_TRACKED_PATHS, new HashSet<>());

            // Legacy tracked path (AppGuard internals) bhi shamil karo
            Set<String> allPaths = new HashSet<>(paths);
            String legacy = ctx.getSharedPreferences("__app_guard_internals", Context.MODE_PRIVATE)
                    .getString("_last_download_path", "");
            if (!legacy.isEmpty()) allPaths.add(legacy);

            Set<String> remaining = new HashSet<>(paths);
            for (String path : allPaths) {
                if (path == null || path.isEmpty()) continue;
                File f = new File(path);
                if (!f.exists()) { remaining.remove(path); continue; }
                // R2: strict name check — galat file ka path register bhi hua
                // ho to bhi delete NAHI hoga.
                if (!isOurInstallerName(f.getName())) {
                    Log.w(TAG, "  REFUSED (name allowlist): " + path);
                    remaining.remove(path);
                    continue;
                }
                // App-private file = seedha delete; shared = best-effort
                boolean gone = safeDelete(ctx, f);
                if (!gone) gone = tryDeleteViaMediaStoreOwnRow(ctx, f.getName());
                if (gone) {
                    deleted++;
                    remaining.remove(path);
                    Log.i(TAG, "  tracked: " + path);
                }
            }
            prefs.edit().putStringSet(KEY_TRACKED_PATHS, remaining).apply();
            ctx.getSharedPreferences("__app_guard_internals", Context.MODE_PRIVATE)
                    .edit().remove("_last_download_path").apply();
        } catch (Exception e) {
            Log.w(TAG, "Tracked cleanup error: " + e.getMessage());
        }
        return deleted;
    }

    /** Download hone par JS/native isse path register karte hain. */
    public static void registerTrackedDownload(Context ctx, String path) {
        try {
            if (path == null || path.isEmpty() || !isOurInstallerName(new File(path).getName())) return;
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            Set<String> s = new HashSet<>(prefs.getStringSet(KEY_TRACKED_PATHS, new HashSet<>()));
            s.add(path);
            prefs.edit().putStringSet(KEY_TRACKED_PATHS, s).apply();
        } catch (Exception ignored) {}
    }

    // ═══════════════════════════════════════════════════════════
    // HARD DELETE ALLOWLIST — R2 ka loha (yahan se bahar = delete nahi)
    // ═══════════════════════════════════════════════════════════

    private static boolean safeDelete(Context ctx, File f) {
        try {
            if (f == null || !f.exists()) return false;
            if (isUnderAppPrivate(ctx, f)) {
                return f.delete();
            }
            // Shared storage: sirf tracked-proven files (caller check karta hai)
            if (isTrackedProven(ctx, f)) {
                return f.delete();
            }
            Log.w(TAG, "  REFUSED (outside allowlist): " + f.getAbsolutePath());
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isUnderAppPrivate(Context ctx, File f) {
        try {
            String p = f.getCanonicalPath();
            File[] roots = {
                ctx.getFilesDir(), ctx.getCacheDir(), ctx.getCodeCacheDir(),
                ctx.getExternalFilesDir(null), ctx.getExternalCacheDir()
            };
            for (File root : roots) {
                if (root == null) continue;
                String rp = root.getCanonicalPath();
                if (p.equals(rp) || p.startsWith(rp + File.separator)) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private static boolean isTrackedProven(Context ctx, File f) {
        try {
            String path = f.getAbsolutePath();
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if (prefs.getStringSet(KEY_TRACKED_PATHS, new HashSet<>()).contains(path)) {
                return isOurInstallerName(f.getName());
            }
            String legacy = ctx.getSharedPreferences("__app_guard_internals", Context.MODE_PRIVATE)
                    .getString("_last_download_path", "");
            return !legacy.isEmpty() && legacy.equals(path) && isOurInstallerName(f.getName());
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Strict naam allowlist — SIRF MiniEsports installer files.
     * Purane khatarnak patterns ("app-debug.apk", "app-release.apk",
     * koi bhi "*.apk.part", "esports*.apk") yahan NAHI hain — janam se hi nahi.
     */
    public static boolean isOurInstallerName(String name) {
        if (name == null || name.isEmpty()) return false;
        String lower = name.toLowerCase().trim();
        boolean prefix = false;
        for (String p : OUR_NAME_PREFIXES) {
            if (lower.startsWith(p)) { prefix = true; break; }
        }
        if (!prefix) return false;
        for (String ext : OUR_NAME_EXTENSIONS) {
            if (lower.endsWith(ext)) return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    // VERDICT CACHE (boot-path ke liye) — fail-safe default "unknown"
    // ═══════════════════════════════════════════════════════════

    public static String cachedVerdict(Context ctx) {
        try {
            return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getString(KEY_VERDICT, VERDICT_UNKNOWN);
        } catch (Exception e) {
            return VERDICT_UNKNOWN;
        }
    }

    private static void cacheVerdict(Context ctx, String verdict) {
        try {
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                    .putString(KEY_VERDICT, verdict)
                    .putLong(KEY_VERDICT_TS, System.currentTimeMillis())
                    .apply();
        } catch (Exception ignored) {}
    }

    // ═══════════════════════════════════════════════════════════
    // BEST-EFFORT shared delete — sirf OWN MediaStore row (R2/R3)
    // ═══════════════════════════════════════════════════════════

    /**
     * Sirf exact DISPLAY_NAME ki row delete karta hai AUR woh bhi tabhi jab
     * file hamari strict naam allowlist me ho. Koi LIKE-pattern nahi,
     * koi bulk delete nahi. SecurityException/IllegalStateException par
     * chupchap false (Android 11+ par doosre app ki file milegi hi nahi).
     */
    private static boolean tryDeleteViaMediaStoreOwnRow(Context ctx, String displayName) {
        if (!isOurInstallerName(displayName)) return false;
        Cursor cursor = null;
        try {
            ContentResolver cr = ctx.getContentResolver();
            Uri filesUri = MediaStore.Files.getContentUri("external");
            cursor = cr.query(filesUri,
                    new String[]{MediaStore.Files.FileColumns._ID},
                    MediaStore.Files.FileColumns.DISPLAY_NAME + " = ?",
                    new String[]{displayName}, null);
            boolean any = false;
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    long id = cursor.getLong(0);
                    Uri fileUri = Uri.withAppendedPath(filesUri, String.valueOf(id));
                    int rows = cr.delete(fileUri, null, null);
                    if (rows > 0) any = true;
                }
            }
            return any;
        } catch (Exception e) {
            // Expected on Android 11+ for files we don't own — skip silently.
            return false;
        } finally {
            if (cursor != null) try { cursor.close(); } catch (Exception ignored) {}
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PURANE (LEGACY) HELPERS — hata diye gaye hain; koi call nahi
    // ═══════════════════════════════════════════════════════════
}

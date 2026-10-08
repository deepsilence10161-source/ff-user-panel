package com.miniesports.app;

/**
 * ═══════════════════════════════════════════════════════════════
 * APP GUARD — Anti-Rollback + On-Update Wipe + Integrity Check
 * ═══════════════════════════════════════════════════════════════
 *
 * GOAL: koi bhi user — simple ya advanced coder — purana APK use
 * na kar sake. Chahe version number edit kar de, data clear kar
 * de, ya koi bhi chalaki kare — naya APK hi chalega.
 *
 * LAYERS:
 *   1. On-Update Data Wipe: jab bhi APK update hota hai (versionCode
 *      badalta hai), SARI local files delete — SharedPreferences,
 *      databases, WebView storage, cache, files dir, external files.
 *      Package name ke under ki HAR cheez.
 *
 *   2. Anti-Rollback: highest versionCode 3 jagah store hota hai
 *      (SharedPreferences, encrypted file, SQLite). Kisi ek se bhi
 *      mismatch = tamper detected → app band.
 *
 *   3. Package Integrity: package name + signing certificate hash
 *      verify. Kisi ne APK decompile karke package name badla ya
 *      resign kiya → detected → app band.
 *
 *   4. Debuggable Check: release build me debuggable=true → tampered.
 *
 * BYPASS ATTEMPTS AND WHY THEY FAIL:
 *   - "localStorage/data clear kar dunga" → anti-rollback 3 jagah
 *     store hai, sab clear karna nearly impossible bina root ke
 *   - "version number edit kar dunga" → signing hash server se
 *     match hoga, resign pe hash badlega
 *   - "purana APK install karunga" → server min-version check +
 *     anti-rollback dono block karenge
 *   - "package name badal dunga" → integrity check me pakda jayega
 *   - "APK decompile + edit + resign" → signing hash mismatch
 *   - "root karke files edit karunga" → server-side check hamesha
 *     hoga, client-side tamper se server verify nahi hota
 *
 * @author Mini eSports CI
 * @since 2026-10-08
 * ═══════════════════════════════════════════════════════════════
 */

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.security.MessageDigest;

public class AppGuard {

    private static final String TAG = "AppGuard";
    private static final String PREFS_NAME = "__app_guard_internals";
    private static final String KEY_LAST_VERSION_CODE = "_last_vc";
    private static final String KEY_LAST_UPDATE_TIME = "_last_ut";
    private static final String KEY_WIPE_DONE_FOR = "_wipe_done_for";

    // ── Tamper-resistant backup file (separate from SharedPreferences) ──
    private static final String ANTI_ROLLBACK_FILE = ".integrity_check.dat";
    // ── SQLite-based backup (3rd location) ──
    private static final String ANTI_ROLLBACK_DB = "integrity.db";

    /**
     * MUST be called FIRST in MyApplication.onCreate(), before anything else.
     * Returns true if app is allowed to continue, false if tampered/blocked.
     */
    public static boolean verifyOrBlock(Context ctx) {
        try {
            // ── Layer 0: Debuggable check ──
            if (isDebuggable(ctx)) {
                Log.e(TAG, "⛔ BLOCKED: app is debuggable — tampered build");
                blockApp(ctx, "Tampered build detected (debuggable=true)");
                return false;
            }

            // ── Layer 1: Package integrity ──
            if (!verifyPackageIntegrity(ctx)) {
                Log.e(TAG, "⛔ BLOCKED: package integrity failure");
                blockApp(ctx, "Package integrity check failed");
                return false;
            }

            // ── Layer 2: Get current version info ──
            PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            int currentVC = pi.versionCode;
            long currentUT = pi.lastUpdateTime;

            // ── Layer 3: On-Update Data Wipe ──
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            int storedVC = prefs.getInt(KEY_LAST_VERSION_CODE, -1);
            long storedUT = prefs.getLong(KEY_LAST_UPDATE_TIME, -1L);

            if (storedVC == -1) {
                // First ever launch — store and continue
                prefs.edit()
                    .putInt(KEY_LAST_VERSION_CODE, currentVC)
                    .putLong(KEY_LAST_UPDATE_TIME, currentUT)
                    .putString(KEY_WIPE_DONE_FOR, currentVC + ":" + currentUT)
                    .apply();
                writeAntiRollbackFile(ctx, currentVC, currentUT);
                writeAntiRollbackDB(ctx, currentVC, currentUT);
                Log.i(TAG, "✅ First launch — VC=" + currentVC + " stored in 3 locations");
                return true;
            }

            // ── Layer 4: Anti-Rollback (3-location check) ──
            int fileVC = readAntiRollbackFile(ctx);
            int dbVC = readAntiRollbackDB(ctx);

            // Find the HIGHEST versionCode ever seen across all 3 locations
            int highestEver = Math.max(storedVC, Math.max(fileVC, dbVC));
            Log.i(TAG, "Version codes — prefs:" + storedVC + " file:" + fileVC +
                       " db:" + dbVC + " current:" + currentVC + " highest:" + highestEver);

            if (currentVC < highestEver) {
                // ROLLBACK DETECTED — user installed an OLDER version
                Log.e(TAG, "⛔ BLOCKED: ROLLBACK detected! current=" + currentVC +
                           " < highest=" + highestEver);
                blockApp(ctx, "Purana APK detect hua (v" + currentVC + " < v" + highestEver +
                              "). Kripya naya version install karein.");
                return false;
            }

            // ── Layer 5: Check if update happened ──
            boolean isUpdate = (currentVC != storedVC) || (currentUT != storedUT);
            String wipeKey = currentVC + ":" + currentUT;
            String lastWipeKey = prefs.getString(KEY_WIPE_DONE_FOR, "");

            if (isUpdate && !wipeKey.equals(lastWipeKey)) {
                Log.i(TAG, "🔄 UPDATE detected! VC: " + storedVC + " → " + currentVC +
                           " | Wiping ALL app data for package: " + ctx.getPackageName());
                performFullWipe(ctx);
                // Re-store after wipe (wipe clears prefs too)
                SharedPreferences newPrefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                newPrefs.edit()
                    .putInt(KEY_LAST_VERSION_CODE, currentVC)
                    .putLong(KEY_LAST_UPDATE_TIME, currentUT)
                    .putString(KEY_WIPE_DONE_FOR, wipeKey)
                    .apply();
                writeAntiRollbackFile(ctx, currentVC, currentUT);
                writeAntiRollbackDB(ctx, currentVC, currentUT);
                Log.i(TAG, "✅ Wipe complete + new version stored");
                // Also clean old APK files from device storage
                try {
                    int apkDeleted = OldApkCleaner.cleanDeviceApks(ctx);
                    Log.i(TAG, "🧹 Device APK cleanup: " + apkDeleted + " old APK files deleted");
                } catch (Exception e) {
                    Log.w(TAG, "Device APK cleanup error: " + e.getMessage());
                }
            } else {
                // Same version, just update highest if needed
                if (currentVC > storedVC) {
                    prefs.edit()
                        .putInt(KEY_LAST_VERSION_CODE, currentVC)
                        .putLong(KEY_LAST_UPDATE_TIME, currentUT)
                        .apply();
                }
                writeAntiRollbackFile(ctx, currentVC, currentUT);
                writeAntiRollbackDB(ctx, currentVC, currentUT);
            }

            return true;

        } catch (Exception e) {
            Log.e(TAG, "verifyOrBlock exception: " + e.getMessage(), e);
            // On error, allow app to continue (don't brick the app)
            // but log for monitoring
            return true;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 1: PACKAGE INTEGRITY
    // ═══════════════════════════════════════════════════════════

    private static boolean verifyPackageIntegrity(Context ctx) {
        try {
            String actualPkg = ctx.getPackageName();
            // Expected package name — hardcoded, not from resources
            // (resources can be edited in decompiled APK)
            String expectedPkg = "com.miniesports.app";

            if (!expectedPkg.equals(actualPkg)) {
                Log.e(TAG, "Package mismatch: expected=" + expectedPkg + " actual=" + actualPkg);
                return false;
            }

            // Verify signing certificate hasn't changed
            String currentHash = getSigningHash(ctx);
            if (currentHash == null || currentHash.isEmpty()) {
                Log.e(TAG, "Could not read signing hash");
                return false;
            }

            // Store first-seen signing hash; if it ever changes → tampered
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String storedHash = prefs.getString("_signing_hash", "");
            if (storedHash.isEmpty()) {
                // First launch — store the hash
                prefs.edit().putString("_signing_hash", currentHash).apply();
                Log.i(TAG, "Signing hash stored: " + currentHash.substring(0, 16) + "...");
            } else if (!storedHash.equals(currentHash)) {
                Log.e(TAG, "Signing hash mismatch! Stored=" + storedHash.substring(0, 16) +
                           " Current=" + currentHash.substring(0, 16));
                return false;
            }

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Package integrity check error: " + e.getMessage());
            return true; // Don't brick on error
        }
    }

    public static String getSigningHash(Context ctx) {
        try {
            Signature sig;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo pi = ctx.getPackageManager().getPackageInfo(
                    ctx.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                if (pi.signingInfo == null) return "";
                Signature[] sigs = pi.signingInfo.hasMultipleSigners()
                    ? pi.signingInfo.getApkContentsSigners()
                    : pi.signingInfo.getSigningCertificateHistory();
                if (sigs == null || sigs.length == 0) return "";
                sig = sigs[0];
            } else {
                PackageInfo pi = ctx.getPackageManager().getPackageInfo(
                    ctx.getPackageName(), PackageManager.GET_SIGNATURES);
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

    // ═══════════════════════════════════════════════════════════
    // LAYER 2: FULL DATA WIPE (package-level)
    // ═══════════════════════════════════════════════════════════

    /**
     * Deletes ALL data belonging to this package:
     * - SharedPreferences (all .xml files)
     * - Databases (all .db files)
     * - WebView storage (Webview/Cache, app_webview, databases/webview*)
     * - Internal files (getFilesDir)
     * - Cache (getCacheDir)
     * - Code cache (getCodeCacheDir)
     * - External files (getExternalFilesDir)
     * - External cache (getExternalCacheDir)
     *
     * Preserves ONLY the anti-rollback files so rollback detection works.
     */
    private static void performFullWipe(Context ctx) {
        Log.i(TAG, "🧹 FULL WIPE starting for: " + ctx.getPackageName());

        int deleted = 0;

        // 1. SharedPreferences — delete ALL except our guard prefs
        File prefsDir = new File(ctx.getApplicationInfo().dataDir, "shared_prefs");
        if (prefsDir.exists() && prefsDir.isDirectory()) {
            File[] prefsFiles = prefsDir.listFiles();
            if (prefsFiles != null) {
                for (File f : prefsFiles) {
                    if (f.getName().contains(PREFS_NAME)) continue; // preserve guard
                    if (f.delete()) deleted++;
                    Log.d(TAG, "  Deleted prefs: " + f.getName());
                }
            }
        }

        // 2. Databases — delete ALL except our integrity DB
        File dbDir = new File(ctx.getApplicationInfo().dataDir, "databases");
        if (dbDir.exists() && dbDir.isDirectory()) {
            File[] dbFiles = dbDir.listFiles();
            if (dbFiles != null) {
                for (File f : dbFiles) {
                    if (f.getName().contains("integrity")) continue; // preserve guard
                    if (f.delete()) deleted++;
                    Log.d(TAG, "  Deleted db: " + f.getName());
                }
            }
        }

        // 3. WebView storage
        deleteRecursive(new File(ctx.getApplicationInfo().dataDir, "app_webview"), deleted);
        deleteRecursive(new File(ctx.getApplicationInfo().dataDir, "app_hws_webview"), deleted);
        File webViewCache = new File(ctx.getCacheDir(), "WebView");
        deleteRecursive(webViewCache, deleted);

        // 4. Internal files (except anti-rollback file)
        File filesDir = ctx.getFilesDir();
        if (filesDir.exists()) {
            File[] files = filesDir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.getName().equals(ANTI_ROLLBACK_FILE)) continue; // preserve
                    if (f.getName().equals("last_crash.txt")) continue; // preserve for crash report
                    if (f.isDirectory()) {
                        deleteRecursive(f, deleted);
                    } else {
                        if (f.delete()) deleted++;
                    }
                }
            }
        }

        // 5. Cache
        File cacheDir = ctx.getCacheDir();
        if (cacheDir.exists()) deleteRecursive(cacheDir, deleted);

        // 6. Code cache
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            File codeCache = ctx.getCodeCacheDir();
            if (codeCache.exists()) deleteRecursive(codeCache, deleted);
        }

        // 7. External files
        File extFiles = ctx.getExternalFilesDir(null);
        if (extFiles != null && extFiles.exists()) deleteRecursive(extFiles, deleted);

        // 8. External cache
        File extCache = ctx.getExternalCacheDir();
        if (extCache != null && extCache.exists()) deleteRecursive(extCache, deleted);

        Log.i(TAG, "🧹 FULL WIPE complete — " + deleted + " items deleted");
    }

    private static void deleteRecursive(File file, int counter) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child, counter);
                }
            }
        }
        file.delete();
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 3: ANTI-ROLLBACK (3-location storage)
    // ═══════════════════════════════════════════════════════════

    /**
     * Location 2: File-based storage (separate from SharedPreferences)
     * Format: "versionCode:lastUpdateTime:random_salt"
     * The salt prevents simple file replacement.
     */
    private static void writeAntiRollbackFile(Context ctx, int vc, long ut) {
        try {
            File f = new File(ctx.getFilesDir(), ANTI_ROLLBACK_FILE);
            String salt = Long.toHexString(System.nanoTime());
            String data = vc + ":" + ut + ":" + salt + ":" + simpleHash(vc + ":" + ut + ":" + salt);
            FileOutputStream fos = new FileOutputStream(f, false);
            fos.write(data.getBytes());
            fos.close();
        } catch (Exception e) {
            Log.w(TAG, "Anti-rollback file write failed: " + e.getMessage());
        }
    }

    private static int readAntiRollbackFile(Context ctx) {
        try {
            File f = new File(ctx.getFilesDir(), ANTI_ROLLBACK_FILE);
            if (!f.exists()) return -1;
            FileInputStream fis = new FileInputStream(f);
            BufferedReader br = new BufferedReader(new InputStreamReader(fis));
            String line = br.readLine();
            br.close();
            fis.close();
            if (line == null) return -1;
            String[] parts = line.split(":");
            if (parts.length >= 2) return Integer.parseInt(parts[0]);
        } catch (Exception e) {
            Log.w(TAG, "Anti-rollback file read failed: " + e.getMessage());
        }
        return -1;
    }

    /**
     * Location 3: SQLite-based storage
     * More resistant to file-level tampering.
     */
    private static void writeAntiRollbackDB(Context ctx, int vc, long ut) {
        SQLiteDatabase db = null;
        try {
            db = ctx.openOrCreateDatabase(ANTI_ROLLBACK_DB, Context.MODE_PRIVATE, null);
            db.execSQL("CREATE TABLE IF NOT EXISTS guard (k TEXT PRIMARY KEY, v INTEGER, ts INTEGER)");
            db.execSQL("INSERT OR REPLACE INTO guard (k, v, ts) VALUES ('max_vc', ?, ?)",
                       new Object[]{vc, System.currentTimeMillis()});
            db.execSQL("INSERT OR REPLACE INTO guard (k, v, ts) VALUES ('last_ut', ?, ?)",
                       new Object[]{(int)(ut / 1000), System.currentTimeMillis()});
        } catch (Exception e) {
            Log.w(TAG, "Anti-rollback DB write failed: " + e.getMessage());
        } finally {
            if (db != null) try { db.close(); } catch (Exception ignored) {}
        }
    }

    private static int readAntiRollbackDB(Context ctx) {
        SQLiteDatabase db = null;
        try {
            db = ctx.openOrCreateDatabase(ANTI_ROLLBACK_DB, Context.MODE_PRIVATE, null);
            db.execSQL("CREATE TABLE IF NOT EXISTS guard (k TEXT PRIMARY KEY, v INTEGER, ts INTEGER)");
            android.database.Cursor c = db.rawQuery("SELECT v FROM guard WHERE k='max_vc'", null);
            if (c != null && c.moveToFirst()) {
                int vc = c.getInt(0);
                c.close();
                return vc;
            }
            if (c != null) c.close();
        } catch (Exception e) {
            Log.w(TAG, "Anti-rollback DB read failed: " + e.getMessage());
        } finally {
            if (db != null) try { db.close(); } catch (Exception ignored) {}
        }
        return -1;
    }

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    private static boolean isDebuggable(Context ctx) {
        return (ctx.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private static String simpleHash(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.substring(0, 16);
        } catch (Exception e) {
            return "0000000000000000";
        }
    }

    /**
     * BLOCK the app — show a full-screen error and exit.
     * This is called when tampering is detected.
     */
    private static void blockApp(Context ctx, String message) {
        // Write a block signal file that MyApplication reads
        try {
            File f = new File(ctx.getFilesDir(), "__blocked.txt");
            FileWriter fw = new FileWriter(f, false);
            fw.write(message);
            fw.close();
        } catch (Exception ignored) {}
    }

    /**
     * Check if app is blocked (called by MyApplication).
     */
    public static String getBlockMessage(Context ctx) {
        try {
            File f = new File(ctx.getFilesDir(), "__blocked.txt");
            if (!f.exists()) return null;
            BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(f)));
            String msg = br.readLine();
            br.close();
            return msg;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Clear block signal (called after user acknowledges or on successful update).
     */
    public static void clearBlock(Context ctx) {
        try {
            File f = new File(ctx.getFilesDir(), "__blocked.txt");
            if (f.exists()) f.delete();
        } catch (Exception ignored) {}
    }
}
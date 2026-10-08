package com.miniesports.app;

/**
 * ═══════════════════════════════════════════════════════════════
 * OLD APK CLEANER v4 — NO SCARY PERMISSIONS, SAF-BASED
 * ═══════════════════════════════════════════════════════════════
 *
 * PROBLEMS SOLVED:
 *   1. Play Protect flag — MANAGE_EXTERNAL_STORAGE HATA DIYA
 *   2. "All Files Access" scary permission — HATA DIYA
 *   3. Users scared of hacker — SAF folder picker (system UI, not scary)
 *
 * HOW IT WORKS:
 *   Layer 1: MediaStore query (Android 10+, NO permission needed)
 *            → Find old MiniEsports APKs in Downloads etc.
 *            → Delete via ContentResolver.delete() (works on Android 10)
 *   Layer 2: SAF folder picker (Android 11+)
 *            → User selects Downloads folder ONCE (system dialog)
 *            → We get persistent URI permission
 *            → Scan + delete via DocumentFile API
 *   Layer 3: BroadcastReceiver (PACKAGE_REPLACED)
 *            → Source APK tracked via download path → delete
 *   Layer 4: App's own storage (NO permission)
 *            → Clean files in our app's directories
 *
 * SAFETY:
 *   - SIRF MiniEsports files (strict pattern matching)
 *   - Content verification (actual ZIP/package check)
 *   - Kisi aur app ko kuch nahi hota
 *
 * @since 2026-10-08
 * ═══════════════════════════════════════════════════════════════
 */

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Log;

import androidx.documentfile.provider.DocumentFile;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipInputStream;

public class OldApkCleaner {

    private static final String TAG = "OldApkCleaner";
    private static final String OUR_PACKAGE = "com.miniesports.app";

    /* SharedPreferences keys */
    private static final String PREFS_NAME = "__apk_cleaner_prefs";
    private static final String KEY_SAF_URI = "_saf_downloads_uri";
    private static final String KEY_SAF_ASKED = "_saf_asked_count";
    private static final String KEY_LAST_CLEAN = "_last_clean_time";
    private static final String KEY_KNOWN_HASHES = "_known_hashes";

    /* SAF picker request code */
    public static final int REQ_SAF_FOLDER_PICKER = 7771;

    /* ═══ IDENTIFICATION — strict patterns ═══ */
    private static final String[] OWN_NAME_PATTERNS = {
        "miniesports", "mini-esports", "mini_esports",
        "mini esports", "miniesport", "ff-user-panel",
        "com.miniesports"
    };

    private static final String[] APK_EXTENSIONS = {
        ".apk", ".apk.part", ".apk.tmp", ".apk.download",
        ".apk.bak", ".apk.old", ".apk.backup"
    };

    private static final String[] ARCHIVE_EXTENSIONS = {
        ".zip", ".rar", ".7z", ".tar", ".tar.gz", ".tgz"
    };

    // ═══════════════════════════════════════════════════════════
    // MAIN ENTRY — Full cleanup (NO permission needed)
    // ═══════════════════════════════════════════════════════════

    /**
     * Clean old MiniEsports APK files from device.
     * Uses MediaStore (no permission) + SAF (user-granted folder).
     * Returns number of files deleted.
     */
    public static int cleanDeviceApks(Context ctx) {
        AtomicInteger deleted = new AtomicInteger(0);
        Log.i(TAG, "🧹 ═══ CLEANUP STARTING (no-permission mode) ═══");

        // Layer 1: MediaStore query + delete (Android 10+)
        deleted.addAndGet(cleanViaMediaStore(ctx));

        // Layer 2: SAF folder access (if user granted)
        deleted.addAndGet(cleanViaSafFolder(ctx));

        // Layer 3: App's own external storage (no permission)
        deleted.addAndGet(cleanAppOwnStorage(ctx));

        // Update last clean time
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putLong(KEY_LAST_CLEAN, System.currentTimeMillis()).apply();

        Log.i(TAG, "🧹 ═══ CLEANUP DONE: " + deleted.get() + " files deleted ═══");
        return deleted.get();
    }

    // ═══════════════════════════════════════════════════════════
    // FILE IDENTIFICATION — Ultra strict
    // ═══════════════════════════════════════════════════════════

    public static boolean isOurFile(String fileName) {
        if (fileName == null || fileName.isEmpty()) return false;
        String lower = fileName.toLowerCase().trim();

        for (String pattern : OWN_NAME_PATTERNS) {
            if (lower.contains(pattern)) {
                for (String ext : APK_EXTENSIONS) {
                    if (lower.endsWith(ext)) return true;
                }
                for (String ext : ARCHIVE_EXTENSIONS) {
                    if (lower.endsWith(ext)) return true;
                }
            }
        }

        if (lower.startsWith("miniesports") || lower.startsWith("mini-esports") || lower.startsWith("mini_esports")) {
            for (String ext : APK_EXTENSIONS) {
                if (lower.endsWith(ext)) return true;
            }
        }

        return false;
    }

    /**
     * Check if ZIP contains MiniEsports APK.
     */
    public static boolean zipContainsOurApk(File zipFile) {
        if (zipFile == null || !zipFile.exists()) return false;
        String lower = zipFile.getName().toLowerCase();
        if (!lower.endsWith(".zip")) return false;

        ZipFile zip = null;
        try {
            zip = new ZipFile(zipFile);
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                String entryName = entry.getName().toLowerCase();
                for (String pattern : OWN_NAME_PATTERNS) {
                    if (entryName.contains(pattern)) {
                        for (String ext : APK_EXTENSIONS) {
                            if (entryName.endsWith(ext)) return true;
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "ZIP scan error: " + zipFile.getName());
        } finally {
            if (zip != null) try { zip.close(); } catch (Exception ignored) {}
        }
        return false;
    }

    /**
     * Check if ZIP stream contains MiniEsports APK.
     */
    public static boolean zipStreamContainsOurApk(InputStream is) {
        if (is == null) return false;
        try {
            ZipInputStream zis = new ZipInputStream(is);
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                String entryName = entry.getName().toLowerCase();
                for (String pattern : OWN_NAME_PATTERNS) {
                    if (entryName.contains(pattern)) {
                        for (String ext : APK_EXTENSIONS) {
                            if (entryName.endsWith(ext)) {
                                zis.close();
                                return true;
                            }
                        }
                    }
                }
                zis.closeEntry();
            }
            zis.close();
        } catch (Exception e) {
            Log.w(TAG, "ZIP stream scan error");
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 1: MediaStore (Android 10+, NO permission)
    // ═══════════════════════════════════════════════════════════

    private static int cleanViaMediaStore(Context ctx) {
        int deleted = 0;
        try {
            ContentResolver cr = ctx.getContentResolver();
            Uri filesUri = MediaStore.Files.getContentUri("external");

            String[] projection = {
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.RELATIVE_PATH,
                MediaStore.Files.FileColumns.SIZE
            };

            // Build query for our specific patterns
            StringBuilder selection = new StringBuilder("(");
            List<String> args = new ArrayList<>();
            boolean first = true;

            for (String pattern : OWN_NAME_PATTERNS) {
                for (String ext : APK_EXTENSIONS) {
                    if (!first) selection.append(" OR ");
                    first = false;
                    selection.append(MediaStore.Files.FileColumns.DISPLAY_NAME).append(" LIKE ?");
                    args.add("%" + pattern + "%" + ext);
                }
                for (String ext : ARCHIVE_EXTENSIONS) {
                    if (!first) selection.append(" OR ");
                    first = false;
                    selection.append(MediaStore.Files.FileColumns.DISPLAY_NAME).append(" LIKE ?");
                    args.add("%" + pattern + "%" + ext);
                }
            }

            // Also match versioned names
            if (!first) selection.append(" OR ");
            selection.append(MediaStore.Files.FileColumns.DISPLAY_NAME).append(" LIKE ?");
            args.add("MiniEsports-v%");

            selection.append(")");

            Cursor cursor = cr.query(filesUri, projection, selection.toString(),
                args.toArray(new String[0]), null);

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    long id = cursor.getLong(0);
                    String name = cursor.getString(1);
                    String path = cursor.getString(2);

                    if (!isOurFile(name)) continue;

                    Uri fileUri = Uri.withAppendedPath(filesUri, String.valueOf(id));
                    try {
                        int rows = cr.delete(fileUri, null, null);
                        if (rows > 0) {
                            deleted++;
                            Log.i(TAG, "  MediaStore: " + path + name);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "  MediaStore delete failed (expected on Android 11+ for APK): " + name);
                    }
                }
                cursor.close();
            }

            // Also scan ZIP files in download locations
            deleted += cleanZipsViaMediaStore(ctx);

        } catch (Exception e) {
            Log.w(TAG, "MediaStore error: " + e.getMessage());
        }
        return deleted;
    }

    private static int cleanZipsViaMediaStore(Context ctx) {
        int deleted = 0;
        try {
            ContentResolver cr = ctx.getContentResolver();
            Uri filesUri = MediaStore.Files.getContentUri("external");

            String[] projection = {
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.RELATIVE_PATH
            };

            // Scan ZIPs in download-related folders
            String selection = MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE ?";
            String[] args = { "%.zip" };

            Cursor cursor = cr.query(filesUri, projection, selection, args, null);
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    long id = cursor.getLong(0);
                    String name = cursor.getString(1);
                    String path = cursor.getString(2);

                    // Only check ZIPs that might contain our APK
                    boolean mightContainOurs = false;
                    for (String pattern : OWN_NAME_PATTERNS) {
                        if (name.toLowerCase().contains(pattern)) {
                            mightContainOurs = true;
                            break;
                        }
                    }

                    if (mightContainOurs) {
                        try {
                            Uri fileUri = Uri.withAppendedPath(filesUri, String.valueOf(id));
                            InputStream is = cr.openInputStream(fileUri);
                            if (is != null && zipStreamContainsOurApk(is)) {
                                int rows = cr.delete(fileUri, null, null);
                                if (rows > 0) {
                                    deleted++;
                                    Log.i(TAG, "  MediaStore ZIP: " + path + name);
                                }
                            }
                            if (is != null) is.close();
                        } catch (Exception e) {
                            Log.w(TAG, "  ZIP check failed: " + name);
                        }
                    }
                }
                cursor.close();
            }
        } catch (Exception e) {
            Log.w(TAG, "MediaStore ZIP error: " + e.getMessage());
        }
        return deleted;
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 2: SAF Folder Access (User-granted, ONE-TIME)
    // ═══════════════════════════════════════════════════════════

    /**
     * Clean old APKs via SAF-granted folder.
     * User selected Downloads folder once → we have persistent URI permission.
     */
    private static int cleanViaSafFolder(Context ctx) {
        int deleted = 0;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String uriStr = prefs.getString(KEY_SAF_URI, null);
            if (uriStr == null) return 0;

            Uri treeUri = Uri.parse(uriStr);

            // Check if we still have permission
            boolean hasPermission = false;
            for (UriPermission perm : ctx.getContentResolver().getPersistedUriPermissions()) {
                if (perm.getUri().equals(treeUri) && perm.isReadPermission() && perm.isWritePermission()) {
                    hasPermission = true;
                    break;
                }
            }

            if (!hasPermission) {
                Log.w(TAG, "SAF permission revoked");
                prefs.edit().remove(KEY_SAF_URI).apply();
                return 0;
            }

            DocumentFile tree = DocumentFile.fromTreeUri(ctx, treeUri);
            if (tree == null || !tree.exists()) return 0;

            deleted = scanAndDeleteSafRecursive(ctx, tree, 0, 4);

        } catch (Exception e) {
            Log.w(TAG, "SAF cleanup error: " + e.getMessage());
        }
        return deleted;
    }

    private static int scanAndDeleteSafRecursive(Context ctx, DocumentFile dir, int depth, int maxDepth) {
        if (depth > maxDepth || dir == null || !dir.exists() || !dir.isDirectory()) return 0;

        int deleted = 0;
        DocumentFile[] files = dir.listFiles();
        if (files == null) return 0;

        for (DocumentFile f : files) {
            if (f.isDirectory()) {
                deleted += scanAndDeleteSafRecursive(ctx, f, depth + 1, maxDepth);
            } else if (f.isFile()) {
                String name = f.getName();
                if (name == null) continue;

                // Check APK files
                if (isOurFile(name)) {
                    try {
                        if (f.delete()) {
                            deleted++;
                            Log.i(TAG, "  SAF: " + name);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "  SAF delete failed: " + name);
                    }
                }

                // Check ZIP files
                if (name.toLowerCase().endsWith(".zip")) {
                    try {
                        InputStream is = ctx.getContentResolver().openInputStream(f.getUri());
                        if (is != null && zipStreamContainsOurApk(is)) {
                            is.close();
                            if (f.delete()) {
                                deleted++;
                                Log.i(TAG, "  SAF ZIP: " + name);
                            }
                        } else if (is != null) {
                            is.close();
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "  SAF ZIP check failed: " + name);
                    }
                }
            }
        }
        return deleted;
    }

    /**
     * Check if user has granted SAF folder access.
     */
    public static boolean hasSafFolderAccess(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String uriStr = prefs.getString(KEY_SAF_URI, null);
        if (uriStr == null) return false;

        try {
            Uri treeUri = Uri.parse(uriStr);
            for (UriPermission perm : ctx.getContentResolver().getPersistedUriPermissions()) {
                if (perm.getUri().equals(treeUri) && perm.isReadPermission() && perm.isWritePermission()) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    /**
     * Save SAF folder URI after user grants access.
     */
    public static void saveSafFolderUri(Context ctx, Uri treeUri) {
        try {
            // Take persistent permission
            ctx.getContentResolver().takePersistableUriPermission(treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString(KEY_SAF_URI, treeUri.toString()).apply();

            Log.i(TAG, "✅ SAF folder URI saved: " + treeUri);

            // Immediately clean
            new Thread(() -> {
                int deleted = cleanDeviceApks(ctx);
                Log.i(TAG, "🧹 Post-SAF: " + deleted + " files deleted");
            }).start();

        } catch (Exception e) {
            Log.e(TAG, "SAF save error: " + e.getMessage());
        }
    }

    /**
     * Launch SAF folder picker (system dialog, NOT "All Files Access").
     * User sees: "MiniEsports wants to access Downloads" — not scary!
     */
    public static void launchSafFolderPicker(Activity activity) {
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI,
                Uri.parse("content://com.android.externalstorage.documents/tree/primary%3ADownload"));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                           Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                           Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            activity.startActivityForResult(intent, REQ_SAF_FOLDER_PICKER);

            // Track ask count
            activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putInt(KEY_SAF_ASKED,
                    activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getInt(KEY_SAF_ASKED, 0) + 1)
                .apply();

        } catch (Exception e) {
            Log.e(TAG, "SAF picker launch error: " + e.getMessage());
        }
    }

    /**
     * Should we ask user for SAF folder access?
     * Returns true if: not asked yet, or last clean was > 7 days ago.
     */
    public static boolean shouldAskForSafFolder(Context ctx) {
        if (hasSafFolderAccess(ctx)) return false;

        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int askCount = prefs.getInt(KEY_SAF_ASKED, 0);

        // Don't ask more than 3 times total
        if (askCount >= 3) return false;

        // Don't ask if we already asked in this session
        long lastClean = prefs.getLong(KEY_LAST_CLEAN, 0);
        if (lastClean == 0 && askCount > 0) return false; // Already asked once, user declined

        // Ask if never asked, or if 7+ days since last clean
        return askCount == 0 || (System.currentTimeMillis() - lastClean > 7L * 24 * 60 * 60 * 1000);
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 3: App's own storage (NO permission needed)
    // ═══════════════════════════════════════════════════════════

    private static int cleanAppOwnStorage(Context ctx) {
        int deleted = 0;
        try {
            File[] dirs = {
                ctx.getExternalFilesDir(null),
                ctx.getExternalCacheDir(),
                ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                ctx.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)
            };

            for (File dir : dirs) {
                if (dir != null && dir.exists()) {
                    deleted += scanDirRecursive(dir, 0, 3);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "App storage error: " + e.getMessage());
        }
        return deleted;
    }

    private static int scanDirRecursive(File dir, int depth, int maxDepth) {
        if (depth > maxDepth || !dir.exists() || !dir.isDirectory()) return 0;

        int deleted = 0;
        File[] files = dir.listFiles();
        if (files == null) return 0;

        for (File f : files) {
            if (f.isDirectory()) {
                deleted += scanDirRecursive(f, depth + 1, maxDepth);
            } else if (f.isFile()) {
                String name = f.getName();
                if (isOurFile(name)) {
                    try {
                        if (f.delete()) {
                            deleted++;
                            Log.i(TAG, "  App storage: " + f.getAbsolutePath());
                        }
                    } catch (Exception ignored) {}
                }
            }
        }
        return deleted;
    }

    // ═══════════════════════════════════════════════════════════
    // HASH REGISTRY — Track known APK files
    // ═══════════════════════════════════════════════════════════

    public static void registerApkHash(Context ctx, String filePath) {
        try {
            File f = new File(filePath);
            if (!f.exists()) return;

            String hash = calculateFileHash(f);
            if (hash == null) return;

            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            Set<String> hashes = prefs.getStringSet(KEY_KNOWN_HASHES, new HashSet<>());
            Set<String> newHashes = new HashSet<>(hashes);
            newHashes.add(hash);
            prefs.edit().putStringSet(KEY_KNOWN_HASHES, newHashes).apply();

            Log.i(TAG, "📝 Registered hash: " + hash.substring(0, 16) + "...");
        } catch (Exception e) {
            Log.w(TAG, "Hash registration error: " + e.getMessage());
        }
    }

    private static String calculateFileHash(File file) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            FileInputStream fis = new FileInputStream(file);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = fis.read(buffer)) != -1) {
                md.update(buffer, 0, read);
            }
            fis.close();

            byte[] digest = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LEGACY HELPERS (for backward compatibility)
    // ═══════════════════════════════════════════════════════════

    /**
     * @deprecated No longer needed — we don't use MANAGE_EXTERNAL_STORAGE.
     * Kept for backward compatibility only.
     */
    @Deprecated
    public static boolean requestStoragePermission(Context ctx) {
        Log.w(TAG, "requestStoragePermission called but no longer needed");
        return true;
    }

    /**
     * @deprecated No longer needed.
     */
    @Deprecated
    public static boolean hasManageStorage(Context ctx) {
        return false;
    }

    /**
     * @deprecated No longer needed.
     */
    @Deprecated
    public static boolean needsStoragePermission(Context ctx) {
        return false;
    }

    /**
     * @deprecated No longer needed — use launchSafFolderPicker instead.
     */
    @Deprecated
    public static void startRealTimeMonitoring(Context ctx) {
        Log.w(TAG, "startRealTimeMonitoring deprecated — not needed without MANAGE_EXTERNAL_STORAGE");
    }

    /**
     * @deprecated No longer needed.
     */
    @Deprecated
    public static void stopRealTimeMonitoring() {}
}
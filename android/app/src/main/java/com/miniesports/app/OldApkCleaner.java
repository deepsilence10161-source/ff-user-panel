package com.miniesports.app;

/**
 * ═══════════════════════════════════════════════════════════════
 * OLD APK CLEANER — Device-wide scan + delete
 * ═══════════════════════════════════════════════════════════════
 *
 * Purane APK files — chahe Downloads me ho, kisi bhi folder me ho,
 * koi bhi naam ho (.apk, .zip, .part) — sab delete karta hai.
 *
 * Scan patterns:
 *   • MiniEsports*.apk (in-app download cache)
 *   • app-debug.apk / app-release.apk (build outputs)
 *   • *.apk.part (incomplete downloads)
 *   • Any .apk file in common download folders
 *   • *.zip files that might contain APKs
 *
 * Android version handling:
 *   • Android 11+ (API 30+): MANAGE_EXTERNAL_STORAGE → full access
 *   • Android 10 (API 29): MediaStore query → find + delete APKs
 *   • Android 9-: READ+WRITE_EXTERNAL_STORAGE → direct file access
 *
 * @since 2026-10-08
 * ═══════════════════════════════════════════════════════════════
 */

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Log;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public class OldApkCleaner {

    private static final String TAG = "OldApkCleaner";

    // Patterns for files to delete
    private static final Pattern APK_PATTERN = Pattern.compile(
        "(?i)miniesports.*\\.apk|app-debug\\.apk|app-release\\.apk|" +
        ".*\\.apk\\.part|ff-user.*\\.apk|esports.*\\.apk",
        Pattern.CASE_INSENSITIVE
    );

    // Common download locations to scan
    private static final String[] SCAN_DIRS = {
        "Download", "Downloads", "download", "downloads",
        "Bluetooth", "SHAREit", "Xender", "Zapya",
        "Telegram", "WhatsApp", "WhatsApp/Media",
        "DCIM", "Pictures", "Documents",
        "MiniEsports", "Mini eSports", "esports",
        "."  // root of external storage
    };

    /**
     * Main entry point — call from AppGuard after data wipe.
     * Scans and deletes all old APK files from the device.
     */
    public static int cleanDeviceApks(Context ctx) {
        int deleted = 0;
        Log.i(TAG, "🧹 Starting device-wide old APK cleanup...");

        // Method 1: MediaStore (works on all versions, no permission needed for own files)
        deleted += cleanViaMediaStore(ctx);

        // Method 2: Direct file scan (Android 9- or with MANAGE_EXTERNAL_STORAGE)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || hasManageStorage(ctx)) {
            deleted += cleanViaDirectScan(ctx);
        }

        // Method 3: App-specific external storage (no permission needed)
        deleted += cleanAppExternalStorage(ctx);

        Log.i(TAG, "🧹 Device APK cleanup complete — " + deleted + " files deleted");
        return deleted;
    }

    /**
     * Request MANAGE_EXTERNAL_STORAGE permission (Android 11+).
     * Returns true if already granted.
     */
    public static boolean requestStoragePermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                Log.i(TAG, "Requesting MANAGE_EXTERNAL_STORAGE permission");
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                } catch (Exception e) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                }
                return false;
            }
            return true;
        }
        // Android 10 and below — READ/WRITE_EXTERNAL_STORAGE handled by runtime permission
        return true;
    }

    private static boolean hasManageStorage(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        }
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    // METHOD 1: MediaStore query (works on Android 10+)
    // ═══════════════════════════════════════════════════════════

    private static int cleanViaMediaStore(Context ctx) {
        int deleted = 0;
        try {
            ContentResolver cr = ctx.getContentResolver();

            // Query for all APK files in external storage
            Uri filesUri = MediaStore.Files.getContentUri("external");
            String[] projection = {
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DATA,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.RELATIVE_PATH,
                MediaStore.Files.FileColumns.SIZE,
                MediaStore.Files.FileColumns.DATE_MODIFIED
            };

            // Select APK and part files
            String selection = "(" +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%.apk' OR " +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%.apk.part' OR " +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%.APK'" +
                ") AND (" +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%MiniEsports%' OR " +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%miniesports%' OR " +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%app-debug%' OR " +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%app-release%' OR " +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%ff-user%' OR " +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%esports%'" +
                ")";

            Cursor cursor = cr.query(filesUri, projection, selection, null, null);
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    int idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID);
                    int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME);
                    int pathCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.RELATIVE_PATH);

                    long id = cursor.getLong(idCol);
                    String name = cursor.getString(nameCol);
                    String path = cursor.getString(pathCol);

                    Uri fileUri = Uri.withAppendedPath(filesUri, String.valueOf(id));
                    try {
                        int rowsDeleted = cr.delete(fileUri, null, null);
                        if (rowsDeleted > 0) {
                            deleted++;
                            Log.i(TAG, "  MediaStore deleted: " + path + name);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "  MediaStore delete failed: " + name + " — " + e.getMessage());
                    }
                }
                cursor.close();
            }

            // Also scan for ANY APK file in Download folders (broader sweep)
            String downloadSelection = "(" +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%.apk' OR " +
                MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE '%.APK'" +
                ") AND (" +
                MediaStore.Files.FileColumns.RELATIVE_PATH + " LIKE '%Download%' OR " +
                MediaStore.Files.FileColumns.RELATIVE_PATH + " LIKE '%download%'" +
                ")";

            Cursor dlCursor = cr.query(filesUri, projection, downloadSelection, null, null);
            if (dlCursor != null) {
                while (dlCursor.moveToNext()) {
                    int idCol = dlCursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID);
                    int nameCol = dlCursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME);
                    int pathCol = dlCursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.RELATIVE_PATH);
                    int dateCol = dlCursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED);

                    long id = dlCursor.getLong(idCol);
                    String name = dlCursor.getString(nameCol);
                    String path = dlCursor.getString(pathCol);
                    long dateModified = dlCursor.getLong(dateCol);

                    // Only delete APKs modified in the last 30 days (avoid unrelated)
                    long thirtyDaysAgo = System.currentTimeMillis() / 1000 - (30L * 24 * 60 * 60);
                    if (dateModified < thirtyDaysAgo) continue;

                    // Check if filename matches our patterns
                    if (APK_PATTERN.matcher(name).matches() || isLikelyOurApk(name)) {
                        Uri fileUri = Uri.withAppendedPath(filesUri, String.valueOf(id));
                        try {
                            int rowsDeleted = cr.delete(fileUri, null, null);
                            if (rowsDeleted > 0) {
                                deleted++;
                                Log.i(TAG, "  MediaStore (Download) deleted: " + path + name);
                            }
                        } catch (Exception e) {
                            Log.w(TAG, "  MediaStore delete failed: " + name + " — " + e.getMessage());
                        }
                    }
                }
                dlCursor.close();
            }

        } catch (Exception e) {
            Log.w(TAG, "MediaStore cleanup error: " + e.getMessage());
        }
        return deleted;
    }

    // ═══════════════════════════════════════════════════════════
    // METHOD 2: Direct file scan (Android 9- or with permission)
    // ═══════════════════════════════════════════════════════════

    private static int cleanViaDirectScan(Context ctx) {
        int deleted = 0;
        try {
            File externalRoot = Environment.getExternalStorageDirectory();
            if (externalRoot == null || !externalRoot.exists()) return 0;

            Log.i(TAG, "  Direct scan starting: " + externalRoot.getAbsolutePath());

            // Scan common directories first (faster)
            for (String dirName : SCAN_DIRS) {
                File dir = new File(externalRoot, dirName);
                if (dir.exists() && dir.isDirectory()) {
                    deleted += scanAndDelete(dir, 0, 3); // max depth 3
                }
            }

            // Also scan root for APK files
            File[] rootFiles = externalRoot.listFiles();
            if (rootFiles != null) {
                for (File f : rootFiles) {
                    if (f.isFile() && isApkFile(f.getName())) {
                        if (f.delete()) {
                            deleted++;
                            Log.i(TAG, "  Direct deleted (root): " + f.getName());
                        }
                    }
                }
            }

        } catch (Exception e) {
            Log.w(TAG, "Direct scan error: " + e.getMessage());
        }
        return deleted;
    }

    private static int scanAndDelete(File dir, int depth, int maxDepth) {
        if (depth > maxDepth || !dir.exists() || !dir.isDirectory()) return 0;
        int deleted = 0;

        File[] files = dir.listFiles();
        if (files == null) return 0;

        for (File f : files) {
            if (f.isDirectory()) {
                // Recurse into subdirectories (limited depth)
                deleted += scanAndDelete(f, depth + 1, maxDepth);
            } else if (f.isFile()) {
                String name = f.getName();
                if (isApkFile(name)) {
                    try {
                        if (f.delete()) {
                            deleted++;
                            Log.i(TAG, "  Direct deleted: " + f.getAbsolutePath());
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "  Direct delete failed: " + f.getAbsolutePath());
                    }
                }
            }
        }
        return deleted;
    }

    // ═══════════════════════════════════════════════════════════
    // METHOD 3: App-specific external storage (no permission)
    // ═══════════════════════════════════════════════════════════

    private static int cleanAppExternalStorage(Context ctx) {
        int deleted = 0;
        try {
            // App's own external files directory (no permission needed)
            File extDir = ctx.getExternalFilesDir(null);
            if (extDir != null) {
                deleted += scanAndDelete(extDir, 0, 5);
            }

            // App's external cache
            File extCache = ctx.getExternalCacheDir();
            if (extCache != null) {
                deleted += scanAndDelete(extCache, 0, 5);
            }

            // App-specific external storage root
            File extRoot = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (extRoot != null) {
                deleted += scanAndDelete(extRoot.getParentFile(), 0, 5);
            }

        } catch (Exception e) {
            Log.w(TAG, "App external cleanup error: " + e.getMessage());
        }
        return deleted;
    }

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Check if a filename is an APK file we should delete.
     * Matches: MiniEsports*.apk, app-debug.apk, app-release.apk,
     * any .apk.part, any .apk in common download folders
     */
    private static boolean isApkFile(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase();

        // Our specific APK patterns
        if (APK_PATTERN.matcher(name).matches()) return true;

        // Any .apk.part file (incomplete downloads)
        if (lower.endsWith(".apk.part")) return true;

        // Check if it's likely our APK
        return isLikelyOurApk(name);
    }

    /**
     * Heuristic check — is this file likely our APK?
     */
    private static boolean isLikelyOurApk(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase();
        return lower.contains("miniesports") ||
               lower.contains("mini-esports") ||
               lower.contains("mini_esports") ||
               lower.contains("ff-user") ||
               (lower.contains("esports") && lower.endsWith(".apk"));
    }

    /**
     * Check if MANAGE_EXTERNAL_STORAGE is available and granted.
     * Used by MainActivity to decide whether to request permission.
     */
    public static boolean needsStoragePermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return !Environment.isExternalStorageManager();
        }
        return false;
    }
}
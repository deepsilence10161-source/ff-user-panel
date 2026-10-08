package com.miniesports.app;

/**
 * ═══════════════════════════════════════════════════════════════
 * OLD APK CLEANER v2 — Only MiniEsports files, thorough cleanup
 * ═══════════════════════════════════════════════════════════════
 *
 * SIRF MiniEsports ki files delete hoti hain — kisi aur app ki nahi.
 * ZIP files bhi scan hoti hain — agar andar MiniEsports APK hai to
 * poora ZIP delete hota hai.
 *
 * YMusic-style approach:
 *   1. BroadcastReceiver: install hone turant baad source APK delete
 *   2. MediaStore: Downloads/folders se matching files delete
 *   3. Direct scan: device-wide recursive scan (permission se)
 *   4. ZIP scan: .zip files ke andar MiniEsports APK check
 *   5. ContentResolver: content:// URI se bhi delete
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
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

public class OldApkCleaner {

    private static final String TAG = "OldApkCleaner";

    /* ═══ IDENTIFICATION — sirf yeh patterns match karenge ═══
       Kisi bhi aur app ki file KABHI delete nahi hogi. */
    private static final String[] OWN_NAME_PATTERNS = {
        "miniesports", "mini-esports", "mini_esports",
        "mini esports", "miniesport", "ff-user-panel",
        "ff-user-panel-release", "com.miniesports"
    };

    /* File extensions to check */
    private static final String[] APK_EXTENSIONS = {
        ".apk", ".apk.part", ".apk.tmp", ".apk.download"
    };

    private static final String[] ARCHIVE_EXTENSIONS = {
        ".zip", ".rar", ".7z", ".tar", ".gz"
    };

    /* Common download locations */
    private static final String[] SCAN_DIRS = {
        "Download", "Downloads", "download", "downloads",
        "Bluetooth", "SHAREit", "Xender", "Zapya",
        "Telegram", "Telegram Documents",
        "WhatsApp", "WhatsApp/Media",
        "Files", "Received", "ShareMe",
        "MiShare", "CloneIt", "SendAnywhere",
        "APK", "APKs", "apk", "apks",
        "MiniEsports", "Mini eSports", "esports"
    };

    /**
     * Main entry — scans device and deletes ONLY MiniEsports files.
     * Returns count of deleted files.
     */
    public static int cleanDeviceApks(Context ctx) {
        int deleted = 0;
        Log.i(TAG, "🧹 Starting MiniEsports-only device cleanup...");

        // Method 1: MediaStore (Android 10+, no special permission)
        deleted += cleanViaMediaStore(ctx);

        // Method 2: App-specific external storage (no permission needed)
        deleted += cleanAppExternalStorage(ctx);

        // Method 3: Direct file scan (with MANAGE_EXTERNAL_STORAGE or older API)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || hasManageStorage(ctx)) {
            deleted += cleanViaDirectScan(ctx);
        }

        Log.i(TAG, "🧹 Cleanup complete — " + deleted + " MiniEsports files deleted");
        return deleted;
    }

    /**
     * Check if a file belongs to MiniEsports.
     * VERY strict — only returns true if the file is definitely ours.
     */
    public static boolean isOurFile(String fileName) {
        if (fileName == null || fileName.isEmpty()) return false;
        String lower = fileName.toLowerCase().trim();

        // Check name patterns
        for (String pattern : OWN_NAME_PATTERNS) {
            if (lower.contains(pattern)) {
                // Double-check: make sure it's an APK or archive
                for (String ext : APK_EXTENSIONS) {
                    if (lower.endsWith(ext)) return true;
                }
                for (String ext : ARCHIVE_EXTENSIONS) {
                    if (lower.endsWith(ext)) return true;
                }
                // Also match without extension (some file managers strip it)
                if (lower.equals("miniesports") || lower.equals("mini esports")) return true;
            }
        }

        // Match versioned names: MiniEsports-v1.0.163.apk etc.
        if (lower.startsWith("miniesports") || lower.startsWith("mini-esports") || lower.startsWith("mini_esports")) {
            for (String ext : APK_EXTENSIONS) {
                if (lower.endsWith(ext)) return true;
            }
        }

        return false;
    }

    /**
     * Check if a ZIP file contains MiniEsports APK.
     * Returns true if the ZIP should be deleted.
     */
    public static boolean zipContainsOurApk(File zipFile) {
        if (zipFile == null || !zipFile.exists() || !zipFile.getName().toLowerCase().endsWith(".zip")) {
            return false;
        }
        ZipFile zip = null;
        try {
            zip = new ZipFile(zipFile);
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                String entryName = entry.getName().toLowerCase();
                // Check if any entry is a MiniEsports APK
                for (String pattern : OWN_NAME_PATTERNS) {
                    if (entryName.contains(pattern)) {
                        for (String ext : APK_EXTENSIONS) {
                            if (entryName.endsWith(ext)) {
                                Log.i(TAG, "  ZIP contains our APK: " + zipFile.getName() + " → " + entry.getName());
                                return true;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "  ZIP scan error: " + zipFile.getName() + " — " + e.getMessage());
        } finally {
            if (zip != null) try { zip.close(); } catch (Exception ignored) {}
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    // METHOD 1: MediaStore (Android 10+)
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

            // Query for files matching our patterns
            // Build selection for each pattern
            StringBuilder selection = new StringBuilder("(");
            List<String> selectionArgs = new ArrayList<>();
            boolean first = true;

            // APK files with our name patterns
            for (String pattern : OWN_NAME_PATTERNS) {
                if (!first) selection.append(" OR ");
                first = false;
                selection.append("(")
                    .append(MediaStore.Files.FileColumns.DISPLAY_NAME).append(" LIKE ?")
                    .append(" AND (");
                boolean firstExt = true;
                for (String ext : APK_EXTENSIONS) {
                    if (!firstExt) selection.append(" OR ");
                    firstExt = false;
                    selection.append(MediaStore.Files.FileColumns.DISPLAY_NAME).append(" LIKE ?");
                    selectionArgs.add("%" + pattern + "%" + ext);
                }
                // Also match archive extensions
                for (String ext : ARCHIVE_EXTENSIONS) {
                    if (!firstExt) selection.append(" OR ");
                    firstExt = false;
                    selection.append(MediaStore.Files.FileColumns.DISPLAY_NAME).append(" LIKE ?");
                    selectionArgs.add("%" + pattern + "%" + ext);
                }
                selection.append("))");
            }

            // Also match exact versioned names: MiniEsports-v*.apk
            selection.append(" OR (")
                .append(MediaStore.Files.FileColumns.DISPLAY_NAME).append(" LIKE ?")
                .append(")");
            selectionArgs.add("MiniEsports-v%.apk");
            selectionArgs.add("MiniEsports-v%.apk.part");
            selection.append(")");

            Cursor cursor = cr.query(filesUri, projection, selection.toString(),
                selectionArgs.toArray(new String[0]), null);

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    long id = cursor.getLong(0);
                    String name = cursor.getString(1);
                    String path = cursor.getString(2);

                    // Double-check with our strict matcher
                    if (!isOurFile(name)) continue;

                    Uri fileUri = Uri.withAppendedPath(filesUri, String.valueOf(id));
                    try {
                        int rows = cr.delete(fileUri, null, null);
                        if (rows > 0) {
                            deleted++;
                            Log.i(TAG, "  MediaStore deleted: " + path + name);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "  MediaStore delete failed: " + name);
                    }
                }
                cursor.close();
            }

            // Also scan for ZIP files that might contain our APK
            String zipSelection = MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE ?";
            String[] zipArgs = { "%.zip" };
            Cursor zipCursor = cr.query(filesUri, projection, zipSelection, zipArgs, null);
            if (zipCursor != null) {
                while (zipCursor.moveToNext()) {
                    long id = zipCursor.getLong(0);
                    String name = zipCursor.getString(1);
                    String path = zipCursor.getString(2);

                    // Only check ZIPs in download folders or with our name
                    if (!isOurFile(name) && path != null &&
                        !path.toLowerCase().contains("download") &&
                        !path.toLowerCase().contains("bluetooth") &&
                        !path.toLowerCase().contains("telegram") &&
                        !path.toLowerCase().contains("whatsapp")) {
                        continue;
                    }

                    // Try to open and check the ZIP
                    try {
                        Uri fileUri = Uri.withAppendedPath(filesUri, String.valueOf(id));
                        InputStream is = cr.openInputStream(fileUri);
                        if (is != null) {
                            // We can't easily check ZIP contents via ContentResolver
                            // without reading the whole file. Skip for now —
                            // direct scan will handle ZIPs.
                            is.close();
                        }
                    } catch (Exception ignored) {}
                }
                zipCursor.close();
            }

        } catch (Exception e) {
            Log.w(TAG, "MediaStore cleanup error: " + e.getMessage());
        }
        return deleted;
    }

    // ═══════════════════════════════════════════════════════════
    // METHOD 2: Direct file scan (with permission)
    // ═══════════════════════════════════════════════════════════

    private static int cleanViaDirectScan(Context ctx) {
        int deleted = 0;
        try {
            File extRoot = Environment.getExternalStorageDirectory();
            if (extRoot == null || !extRoot.exists()) return 0;

            Log.i(TAG, "  Direct scan: " + extRoot.getAbsolutePath());

            // Scan common directories
            for (String dirName : SCAN_DIRS) {
                File dir = new File(extRoot, dirName);
                if (dir.exists() && dir.isDirectory()) {
                    deleted += scanAndDelete(dir, 0, 4);
                }
            }

            // Scan root for our files
            File[] rootFiles = extRoot.listFiles();
            if (rootFiles != null) {
                for (File f : rootFiles) {
                    if (f.isFile() && isOurFile(f.getName())) {
                        if (f.delete()) {
                            deleted++;
                            Log.i(TAG, "  Direct deleted (root): " + f.getName());
                        }
                    }
                    // Check ZIPs in root
                    if (f.isFile() && f.getName().toLowerCase().endsWith(".zip") && zipContainsOurApk(f)) {
                        if (f.delete()) {
                            deleted++;
                            Log.i(TAG, "  Direct deleted ZIP (root): " + f.getName());
                        }
                    }
                }
            }

            // Deep scan: Android/data/ directories
            File androidData = new File(extRoot, "Android/data");
            if (androidData.exists()) {
                File[] appDirs = androidData.listFiles();
                if (appDirs != null) {
                    for (File appDir : appDirs) {
                        if (appDir.isDirectory()) {
                            deleted += scanAndDelete(appDir, 0, 3);
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
                deleted += scanAndDelete(f, depth + 1, maxDepth);
            } else if (f.isFile()) {
                String name = f.getName();

                // Check if it's our APK file
                if (isOurFile(name)) {
                    try {
                        if (f.delete()) {
                            deleted++;
                            Log.i(TAG, "  Deleted: " + f.getAbsolutePath());
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "  Delete failed: " + f.getAbsolutePath());
                    }
                }

                // Check if it's a ZIP containing our APK
                if (name.toLowerCase().endsWith(".zip") && zipContainsOurApk(f)) {
                    try {
                        if (f.delete()) {
                            deleted++;
                            Log.i(TAG, "  Deleted ZIP: " + f.getAbsolutePath());
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "  ZIP delete failed: " + f.getAbsolutePath());
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
            // App's own external files
            File extDir = ctx.getExternalFilesDir(null);
            if (extDir != null) {
                deleted += scanAndDelete(extDir, 0, 5);
            }

            // App's external cache
            File extCache = ctx.getExternalCacheDir();
            if (extCache != null) {
                deleted += scanAndDelete(extCache, 0, 5);
            }

            // App's Downloads directory
            File extDownloads = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (extDownloads != null) {
                deleted += scanAndDelete(extDownloads, 0, 5);
            }

        } catch (Exception e) {
            Log.w(TAG, "App external cleanup error: " + e.getMessage());
        }
        return deleted;
    }

    // ═══════════════════════════════════════════════════════════
    // PERMISSION HELPERS
    // ═══════════════════════════════════════════════════════════

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
        return true;
    }

    public static boolean hasManageStorage(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        }
        return true;
    }

    public static boolean needsStoragePermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return !Environment.isExternalStorageManager();
        }
        return false;
    }
}
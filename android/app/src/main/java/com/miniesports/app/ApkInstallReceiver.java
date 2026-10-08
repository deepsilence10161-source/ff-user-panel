package com.miniesports.app;

/**
 * ═══════════════════════════════════════════════════════════════
 * APK INSTALL RECEIVER — YMusic-style instant cleanup
 * ═══════════════════════════════════════════════════════════════
 *
 * Jab bhi MiniEsports ka naya APK install hota hai (update),
 * ye receiver turant trigger hota hai aur source APK file delete
 * karta hai — chahe woh Downloads me ho, kisi bhi folder me ho.
 *
 * Approach:
 *   1. ACTION_PACKAGE_REPLACED detect karo (update = replace)
 *   2. Package name verify karo (sirf com.miniesports.app)
 *   3. Source APK file dhundho (PackageManager.sourceDir)
 *   4. External storage me bhi scan karo
 *   5. Sab delete karo
 *
 * @since 2026-10-08
 * ═══════════════════════════════════════════════════════════════
 */

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Environment;
import android.util.Log;

import java.io.File;

public class ApkInstallReceiver extends BroadcastReceiver {

    private static final String TAG = "ApkInstallReceiver";
    private static final String OUR_PACKAGE = "com.miniesports.app";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getData() == null) return;

        String action = intent.getAction();
        String packageName = intent.getData().getSchemeSpecificPart();

        // SIRF apne package par react karo
        if (!OUR_PACKAGE.equals(packageName)) return;

        if (Intent.ACTION_PACKAGE_REPLACED.equals(action) ||
            Intent.ACTION_PACKAGE_ADDED.equals(action)) {

            Log.i(TAG, "🔄 MiniEsports installed/updated — cleaning old APKs...");

            // 1. Delete source APK from system
            deleteSourceApk(context);

            // 2. Scan and delete from device storage
            new Thread(() -> {
                try {
                    int deleted = OldApkCleaner.cleanDeviceApks(context);
                    Log.i(TAG, "🧹 Post-install cleanup: " + deleted + " files deleted");
                } catch (Exception e) {
                    Log.w(TAG, "Post-install cleanup error: " + e.getMessage());
                }
            }, "PostInstallCleanup").start();

            // 3. Clean tracked download paths
            cleanTrackedPaths(context);
        }
    }

    /**
     * Delete the source APK file that was used for installation.
     * Android keeps this in /data/app/ — but the DOWNLOAD copy
     * is what we really want to delete.
     */
    private void deleteSourceApk(Context context) {
        try {
            PackageInfo pi = context.getPackageManager().getPackageInfo(OUR_PACKAGE, 0);
            String sourceDir = context.getApplicationInfo().sourceDir;
            Log.i(TAG, "  Source APK: " + sourceDir);

            // The installed APK is in /data/app/ — we can't delete that
            // (it's the running app). But we can find and delete the
            // DOWNLOAD copy that the user installed from.

            // Scan common download locations
            File extRoot = Environment.getExternalStorageDirectory();
            if (extRoot == null) return;

            String[] downloadDirs = {
                "Download", "Downloads", "download", "downloads",
                "Bluetooth", "Telegram", "WhatsApp",
                "SHAREit", "Xender", "Files", "Received"
            };

            for (String dirName : downloadDirs) {
                File dir = new File(extRoot, dirName);
                if (!dir.exists() || !dir.isDirectory()) continue;

                File[] files = dir.listFiles();
                if (files == null) continue;

                for (File f : files) {
                    if (f.isFile() && OldApkCleaner.isOurFile(f.getName())) {
                        try {
                            if (f.delete()) {
                                Log.i(TAG, "  Deleted download: " + f.getAbsolutePath());
                            }
                        } catch (Exception e) {
                            Log.w(TAG, "  Delete failed: " + f.getAbsolutePath());
                        }
                    }
                }
            }

        } catch (Exception e) {
            Log.w(TAG, "Source APK cleanup error: " + e.getMessage());
        }
    }

    /**
     * Clean APK files from paths tracked during in-app download.
     * The MainActivity stores download paths in SharedPreferences.
     */
    private void cleanTrackedPaths(Context context) {
        try {
            var prefs = context.getSharedPreferences("__app_guard_internals", Context.MODE_PRIVATE);
            String trackedPath = prefs.getString("_last_download_path", "");
            if (!trackedPath.isEmpty()) {
                File f = new File(trackedPath);
                if (f.exists() && f.isFile()) {
                    if (f.delete()) {
                        Log.i(TAG, "  Deleted tracked download: " + trackedPath);
                    }
                }
                // Also delete .part file
                File partFile = new File(trackedPath + ".part");
                if (partFile.exists()) {
                    partFile.delete();
                }
            }
            // Clear tracked path
            prefs.edit().remove("_last_download_path").apply();
        } catch (Exception e) {
            Log.w(TAG, "Tracked path cleanup error: " + e.getMessage());
        }
    }
}
package com.miniesports.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Environment;
import android.util.Log;
import java.io.File;

/**
 * YMusic-style: install hone turant baad source APK + all copies delete.
 */
public class ApkInstallReceiver extends BroadcastReceiver {
    private static final String TAG = "ApkInstallReceiver";
    private static final String OUR_PACKAGE = "com.miniesports.app";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getData() == null) return;
        String action = intent.getAction();
        String packageName = intent.getData().getSchemeSpecificPart();
        if (!OUR_PACKAGE.equals(packageName)) return;

        if (Intent.ACTION_PACKAGE_REPLACED.equals(action) ||
            Intent.ACTION_PACKAGE_ADDED.equals(action)) {
            Log.i(TAG, "🔄 MiniEsports installed/updated — FULL CLEANUP");

            // 1. Delete tracked download path
            cleanTrackedPath(context);

            // 2. Scan and delete from device storage
            new Thread(() -> {
                int deleted = OldApkCleaner.cleanDeviceApks(context);
                Log.i(TAG, "🧹 Post-install: " + deleted + " files deleted");

                // 3. Start real-time monitoring for any stragglers
                OldApkCleaner.startRealTimeMonitoring(context);
            }, "PostInstallCleanup").start();
        }
    }

    private void cleanTrackedPath(Context ctx) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences("__app_guard_internals", Context.MODE_PRIVATE);
            String path = prefs.getString("_last_download_path", "");
            if (!path.isEmpty()) {
                File f = new File(path);
                if (f.exists()) { f.delete(); Log.i(TAG, "  Tracked: " + path); }
                new File(path + ".part").delete();
                new File(path + ".tmp").delete();
                prefs.edit().remove("_last_download_path").apply();
            }
            // Also check updates directory
            File extDir = ctx.getExternalFilesDir(null);
            if (extDir != null) {
                File updatesDir = new File(extDir, "updates");
                if (updatesDir.exists()) {
                    File[] files = updatesDir.listFiles();
                    if (files != null) {
                        for (File f : files) {
                            if (OldApkCleaner.isOurFile(f.getName())) {
                                f.delete();
                                Log.i(TAG, "  Updates dir: " + f.getName());
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Tracked path error: " + e.getMessage());
        }
    }
}
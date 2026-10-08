package com.miniesports.app;

import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Log;
import java.io.File;

/**
 * YMusic-style: install hone turant baad source APK delete.
 * NO storage permission needed — uses MediaStore + tracked paths.
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
            Log.i(TAG, "🔄 MiniEsports installed/updated — CLEANUP");

            new Thread(() -> {
                // 1. Delete tracked download path
                cleanTrackedPath(context);

                // 2. MediaStore scan + delete
                int deleted = OldApkCleaner.cleanDeviceApks(context);
                Log.i(TAG, "🧹 Post-install: " + deleted + " files deleted");
            }, "PostInstallCleanup").start();
        }
    }

    private void cleanTrackedPath(Context ctx) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences("__app_guard_internals", Context.MODE_PRIVATE);
            String path = prefs.getString("_last_download_path", "");
            if (!path.isEmpty()) {
                File f = new File(path);
                if (f.exists()) {
                    // Try direct delete (works if file is in app's own storage)
                    if (f.delete()) {
                        Log.i(TAG, "  Tracked direct: " + path);
                    } else {
                        // Try via MediaStore (works for Downloads etc.)
                        deleteViaMediaStore(ctx, f.getName());
                    }
                }
                // Also try .part and .tmp variants
                new File(path + ".part").delete();
                new File(path + ".tmp").delete();

                // Clean tracked path
                prefs.edit().remove("_last_download_path").apply();
            }

            // Also check updates directory (app's own storage — no permission)
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

    private void deleteViaMediaStore(Context ctx, String fileName) {
        try {
            ContentResolver cr = ctx.getContentResolver();
            Uri filesUri = MediaStore.Files.getContentUri("external");
            String[] projection = { MediaStore.Files.FileColumns._ID };
            String selection = MediaStore.Files.FileColumns.DISPLAY_NAME + " = ?";
            String[] args = { fileName };

            Cursor cursor = cr.query(filesUri, projection, selection, args, null);
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    long id = cursor.getLong(0);
                    Uri fileUri = Uri.withAppendedPath(filesUri, String.valueOf(id));
                    int rows = cr.delete(fileUri, null, null);
                    if (rows > 0) {
                        Log.i(TAG, "  MediaStore: " + fileName);
                    }
                }
                cursor.close();
            }
        } catch (Exception e) {
            Log.w(TAG, "MediaStore delete error: " + e.getMessage());
        }
    }
}
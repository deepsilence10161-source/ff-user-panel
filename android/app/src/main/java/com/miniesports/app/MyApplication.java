package com.miniesports.app;

import android.app.Application;
import android.util.Log;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.Date;

public class MyApplication extends Application {





    @Override
    public void onCreate() {
        super.onCreate();

        /* ═══ APP GUARD (2026-10-08, revised 2026-10-09): Anti-Rollback +
         * On-Update Wipe (ab server-gated) + Package Integrity.
         * MUST run before anything else.
         * Agar purana APK ya tampered build detect ho → app band.
         * Agar update hua hai → safai PENDING banti hai; asli safai sirf
         * SafeCleaner (server policy + owner exemption ke baad) karta hai —
         * pehle yahin turant poora data wipe + device-wide cleanup hota tha
         * jisse owner ke device ki files bhi udd gayi (incident 2026-10-08). */
        boolean allowed = AppGuard.verifyOrBlock(this);
        if (!allowed) {
            // App is blocked — show block screen in MyApplication itself
            // MainActivity will check getBlockMessage() and show full-screen error
            Log.e("AppGuard", "⛔ App blocked — tampered/rollback detected");
        }

        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true);

        // Global crash logger — koi bhi crash ho, last_crash.txt mein save hoga
        // AUR Firebase Crashlytics dashboard pe bhi upload hoga (native crashes bhi).
        final Thread.UncaughtExceptionHandler defaultHandler =
            Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            saveCrash("FATAL CRASH", throwable);
            try {
                FirebaseCrashlytics.getInstance().recordException(throwable);
            } catch (Exception ignored) { }
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        /* FCM (2026-10-31, OneSignal → Firebase migration): notification
           channel — Android 8+ par FcmMessagingService isi channel
           ("ff_push", IMPORTANCE_HIGH) par notifications dikhata hai.
           Channel pehle se bana hona zaroori hai, warna notification
           silently drop hoti hai. */
        try {
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                android.app.NotificationManager nm = getSystemService(android.app.NotificationManager.class);
                if (nm != null && nm.getNotificationChannel(FcmMessagingService.CHANNEL_ID) == null) {
                    android.app.NotificationChannel ch = new android.app.NotificationChannel(
                        FcmMessagingService.CHANNEL_ID,
                        "Match alerts & notifications",
                        android.app.NotificationManager.IMPORTANCE_HIGH);
                    ch.setDescription("Mini eSports push notifications — match reminders, results, rewards");
                    nm.createNotificationChannel(ch);
                }
            }
        } catch (Throwable ignored) { }
    }

    private void saveCrash(String label, Throwable t) {
        try {
            File f = new File(getFilesDir(), "last_crash.txt");
            FileWriter fw = new FileWriter(f, false);
            PrintWriter pw = new PrintWriter(fw);
            pw.println(new Date().toString());
            pw.println(label);
            pw.println("------------------------");
            t.printStackTrace(pw);
            pw.flush();
            pw.close();
        } catch (Exception ignored) {
            // logging itself should never crash the app
        }
    }
}

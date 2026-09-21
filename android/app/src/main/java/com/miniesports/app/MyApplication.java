package com.miniesports.app;

import android.app.Application;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.Date;

public class MyApplication extends Application {





    @Override
    public void onCreate() {
        super.onCreate();

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

        // OneSignal init — try-catch zaroori hai. Agar SDK fail ho (version
        // mismatch, bad config, etc.) to bhi poora app crash nahi karega,
        // sirf push-notification feature skip ho jayega.
        /* R23: सारे OneSignal calls केंद्रीकृत OneSignalManager wrapper से */
        OneSignalManager.initialize(this);
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

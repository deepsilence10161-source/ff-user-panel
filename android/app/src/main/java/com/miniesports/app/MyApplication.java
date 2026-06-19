package com.miniesports.app;

import android.app.Application;
import com.onesignal.OneSignal;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.Date;

public class MyApplication extends Application {

    private static final String ONESIGNAL_APP_ID =
        "9c00aa92-4577-484c-996d-4494e8c6afad";

    @Override
    public void onCreate() {
        super.onCreate();

        // Global crash logger — koi bhi crash ho, last_crash.txt mein save hoga.
        // MainActivity next launch pe ise dialog mein dikha dega.
        final Thread.UncaughtExceptionHandler defaultHandler =
            Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            saveCrash("FATAL CRASH", throwable);
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        // OneSignal init — try-catch zaroori hai. Agar SDK fail ho (version
        // mismatch, bad config, etc.) to bhi poora app crash nahi karega,
        // sirf push-notification feature skip ho jayega.
        try {
            OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
        } catch (Throwable t) {
            saveCrash("OneSignal init failed (non-fatal, app continues)", t);
        }
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

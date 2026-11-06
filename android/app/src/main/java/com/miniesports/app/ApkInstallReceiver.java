package com.miniesports.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * ═══════════════════════════════════════════════════════════════════
 * APK INSTALL RECEIVER — post-update cleanup (SAFE-CLEANER gated)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Pehle (2026-10-08) yahan turant OldApkCleaner.cleanDeviceApks() chalta
 * tha — device-wide scan + delete, bina server policy, bina owner check.
 * Incident ke baad (2026-10-09) yeh SIRF SafeCleaner.runIfCachedAllowed()
 * call karta hai:
 *   - verdict "allowed" (server ne pichhli session me kaha tha) → app-private
 *     safai (updates/ APKs + tracked own downloads). Koi naam-scan nahi.
 *   - verdict "exempt"/"unknown" → KUCH NAHI. Owner ke device par kuch
 *     delete hota hi nahi; offline/fresh install par fail-safe.
 *
 * Zero permissions, zero prompts — receiver ke paas koi permission nahi
 * chahiye aur na hi koi leta hai.
 *
 * ✅ NOTE (2026-10-29, official Android docs se verified): API 26+ par
 * manifest-registered receivers ko ACTION_PACKAGE_ADDED / PACKAGE_REPLACED
 * MILTE HI NAHI (ye implicit-broadcast exceptions list me nahi hain).
 * Isliye asli post-update cleanup path MainActivity.onCreate ka launch-hook
 * hai (SafeCleaner.cachedVerdict gate ke saath); yeh receiver sirf API 24-25
 * devices par immediate cleanup deta hai. Dono paths fail-safe hain:
 * verdict unknown/exempt = kuch bhi delete nahi.
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
            Log.i(TAG, "🔄 MiniEsports installed/updated — SafeCleaner gate");

            // Fail-safe default = no cleanup. Sirf cached "allowed" verdict
            // par app-private safai hoti hai (SafeCleaner R1/R2/R4).
            new Thread(() -> {
                try {
                    int deleted = SafeCleaner.runIfCachedAllowed(context);
                    Log.i(TAG, "🧹 Post-install gated cleanup: " + deleted + " items deleted");
                } catch (Exception e) {
                    Log.w(TAG, "Post-install cleanup error: " + e.getMessage());
                }
            }, "PostInstallCleanup").start();
        }
    }
}

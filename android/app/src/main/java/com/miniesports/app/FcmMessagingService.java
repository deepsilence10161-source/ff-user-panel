package com.miniesports.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/* ================================================================
   FcmMessagingService — Firebase Cloud Messaging (OneSignal → FCM
   migration, 2026-10-31). EK-MATRA native push path:

   • Server hamesha DATA-ONLY high-priority messages bhejta hai
     (push-send edge fn) → onMessageReceived FOREGROUND aur BACKGROUND
     dono me chalta hai → display 100% humare control me (channel
     "ff_push", tap → MainActivity + push_url extra → WebView JS).
   • onNewToken → SharedPreferences cache + WebView ko live forward
     (JS → push-token edge fn → user_push_tokens table).
   • E2E gate (push-e2e workflow): adb intent-extra
     "e2e_push_token_log=miniesports-e2e" par logcat markers
     (FCM_TOKEN=…, FCM_DELIVERED=…) — flag 30 min me expire hota hai
     aur logcat sirf adb/shell padh sakta hai (koi app nahi).
   ================================================================ */
public class FcmMessagingService extends FirebaseMessagingService {

    public static final String TAG_E2E    = "MINIESPORTS-E2E";
    public static final String PREFS      = "ff_fcm_prefs";
    public static final String KEY_TOKEN  = "token";
    public static final String KEY_E2E_TS = "e2e_log_ts";
    public static final String CHANNEL_ID = "ff_push";
    private static final long E2E_WINDOW_MS = 30 * 60 * 1000L; /* 30 min */

    private static final AtomicInteger notifId = new AtomicInteger(1000);

    /* ── E2E flag (persisted, time-boxed) — process restart ke baad bhi
       delivery-marker log hota rahe ── */
    public static boolean e2eLogActive(Context c) {
        try {
            long ts = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_E2E_TS, 0L);
            return ts > 0 && (System.currentTimeMillis() - ts) < E2E_WINDOW_MS;
        } catch (Throwable t) { return false; }
    }

    public static void enableE2eLog(Context c) {
        try {
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putLong(KEY_E2E_TS, System.currentTimeMillis()).apply();
        } catch (Throwable ignored) { }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        try {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_TOKEN, token).apply();
        } catch (Throwable ignored) { }
        if (e2eLogActive(this)) {
            try { Log.i(TAG_E2E, "FCM_TOKEN=" + token); } catch (Throwable ignored) { }
        }
        /* Live WebView ho to JS ko turant batao (token DB me upsert ho jaye) */
        MainActivity.onFcmTokenRefreshed(token);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        try {
            Map<String, String> d = message.getData();
            String title = d.get("title");
            String body  = d.get("body");
            if ((title == null || title.isEmpty()) && message.getNotification() != null)
                title = message.getNotification().getTitle();
            if ((body == null || body.isEmpty()) && message.getNotification() != null)
                body = message.getNotification().getBody();
            if (title == null || title.isEmpty()) title = "Mini eSports";
            if (body == null) body = "";
            String url = d.get("url") != null ? d.get("url") : "";

            if (e2eLogActive(this)) {
                try { Log.i(TAG_E2E, "FCM_DELIVERED=" + title); } catch (Throwable ignored) { }
            }

            /* Android 13+: permission nahi hai to notification show nahi
               kar sakte (data phir bhi process ho chuka hai) */
            if (Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS")
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                MainActivity.forwardPushToWeb(title, body, url);
                return;
            }

            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("push_title", title);
            intent.putExtra("push_body", body);
            intent.putExtra("push_url", url);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) piFlags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getActivity(this, notifId.get(), intent, piFlags);

            NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(pi);

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(notifId.incrementAndGet(), b.build());

            /* App khuli hai to in-app toast/refresh bhi (WebView forward) */
            MainActivity.forwardPushToWeb(title, body, url);
        } catch (Throwable t) {
            try { Log.w(TAG_E2E, "FCM display error: " + t.getMessage()); } catch (Throwable ignored) { }
        }
    }

    /* MainActivity/bridge ke liye cached token (sync, instant) */
    public static String getCachedToken(Context c) {
        try {
            return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TOKEN, "");
        } catch (Throwable t) { return ""; }
    }
}

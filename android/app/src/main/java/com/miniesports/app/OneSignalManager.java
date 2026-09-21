package com.miniesports.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import androidx.appcompat.app.AlertDialog;

import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.user.subscriptions.IPushSubscriptionObserver;
import com.onesignal.user.subscriptions.PushSubscriptionChangedState;

import java.util.concurrent.atomic.AtomicBoolean;

/* ================================================================
   OneSignalManager — OneSignal SDK का केंद्रीकृत wrapper (R23).
   OneSignal के आधिकारिक AI-integration guide अनुसार:
   - SDK का कोई भी direct call इस class के बाहर नहीं
     (MyApplication सिर्फ initialize() करता है; AndroidBridge सिर्फ
     login/logout करता है; MainActivity सिर्फ observer जोड़ता है)
   - Push Subscription Verification Dialog: subscription real होते ही
     (server-assigned id, 'local-' prefix नहीं) एक बार dialog, उसके
     "Got it" button पर ही notification-permission request
   ================================================================ */
public final class OneSignalManager {

    private OneSignalManager() { }

    /* OneSignal App ID (user-provided; wizard से बना नया app) */
    private static final String ONESIGNAL_APP_ID =
        "a65c45fc-7579-4851-8f1f-225721a81668";

    /* Dialog exactly-once guard */
    private static final AtomicBoolean dialogShown = new AtomicBoolean(false);

    /* OneSignal observers को weakly रखता है — strong ref app-lifetime ज़रूरी */
    private static IPushSubscriptionObserver pushSubscriptionObserver;

    private static volatile boolean isInitialized = false;

    /* ── INIT (Application.onCreate से) ── */
    public static void initialize(android.content.Context context) {
        if (isInitialized) return;
        try {
            OneSignal.getDebug().setLogLevel(LogLevel.WARN);
            OneSignal.initWithContext(context, ONESIGNAL_APP_ID);
            isInitialized = true;
        } catch (Throwable ignored) {
            /* SDK fail हो तो app चलता रहे — सिर्फ push skip */
        }
    }

    /* ── IDENTITY (external_id = firebase-uid) ── */
    public static void login(String uid) {
        try {
            if (uid != null && uid.length() > 10) OneSignal.login(uid);
        } catch (Throwable ignored) { }
    }

    public static void logout() {
        try {
            OneSignal.logout();
        } catch (Throwable ignored) { }
    }

    /* ── PUSH SUBSCRIPTION VERIFICATION DIALOG ── */
    public static void setupPushSubscriptionObserver(final Activity activity) {
        if (!isInitialized || activity == null) return;
        IPushSubscriptionObserver observer = new IPushSubscriptionObserver() {
            @Override
            public void onPushSubscriptionChange(PushSubscriptionChangedState state) {
                maybeShowIntegrationCompleteDialog(activity, state.getCurrent().getId());
            }
        };
        pushSubscriptionObserver = observer;
        OneSignal.getUser().getPushSubscription().addObserver(observer);

        /* ID observer-attach होने से पहले भी server-assigned हो सकती है —
           तुरंत current value भी जाँचो */
        maybeShowIntegrationCompleteDialog(
            activity, OneSignal.getUser().getPushSubscription().getId());
    }

    private static boolean isRegistered(String subscriptionId) {
        return subscriptionId != null && !subscriptionId.isEmpty()
            && !subscriptionId.startsWith("local-");
    }

    private static void maybeShowIntegrationCompleteDialog(
            final Activity activity, String subscriptionId) {
        if (isRegistered(subscriptionId) && dialogShown.compareAndSet(false, true)) {
            new Handler(Looper.getMainLooper()).post(() ->
                showIntegrationCompleteDialog(activity));
        }
    }

    private static void showIntegrationCompleteDialog(final Activity activity) {
        try {
            new AlertDialog.Builder(activity)
                .setTitle("Your OneSignal SDK integration is complete!")
                .setMessage(
                    "You can now send Push Notifications & In-App Messages through OneSignal. "
                    + "Tap below to enable push notifications.")
                .setPositiveButton("Got it", (dialog, which) ->
                    OneSignal.getNotifications().requestPermission(true, result -> { }))
                .setCancelable(false)
                .show();
        } catch (Throwable ignored) { }
    }
}

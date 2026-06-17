package com.miniesports.app;

import android.app.Application;
import com.onesignal.OneSignal;

public class MyApplication extends Application {

    private static final String ONESIGNAL_APP_ID =
        "9c00aa92-4577-484c-996d-4494e8c6afad";

    @Override
    public void onCreate() {
        super.onCreate();

        // OneSignal v5 API — initWithContext(context, appId)
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
    }
}

package dev.miniesports.app;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
public class MainActivity extends Activity {
  private WebView wv;
  private ProgressBar pb;
  private ValueCallback<Uri[]> upCb;
  private static final String URL = "https://deepsilence10161-source.github.io/ff-user-panel/index.html";
  private static final int PICK = 9101;
  @SuppressLint("SetJavaScriptEnabled")
  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    FrameLayout root = new FrameLayout(this);
    root.setBackgroundColor(Color.parseColor("#0b0b0f"));
    wv = new WebView(this);
    pb = new ProgressBar(this);
    FrameLayout.LayoutParams pl = new FrameLayout.LayoutParams(140, 140);
    pl.gravity = android.view.Gravity.CENTER;
    pb.setLayoutParams(pl);
    WebSettings s = wv.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setGeolocationEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    s.setUserAgentString(s.getUserAgentString() + " MiniESportsApp/1.0.5");
    wv.setWebViewClient(new WebViewClient() {
      @Override public void onPageFinished(WebView v, String u) { pb.setVisibility(View.GONE); }
      @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
        if (req.isForMainFrame()) { pb.setVisibility(View.GONE); v.loadDataWithBaseURL(null,
          "<html><body style='background:#0b0b0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:80px'>" +
          "<h2>Internet nahi mila</h2><p>Connection check karke neeche tap karo.</p>" +
          "<button onclick='location.href=\"" + URL + "\" style='padding:12px 26px;font-size:16px;border-radius:10px;border:0;background:#00ff9c;color:#000;font-weight:700'>Dobara kholo</button>" +
          "</body></html>", "text/html", "utf-8", null); }
      }
    });
    wv.setWebChromeClient(new WebChromeClient() {
      @Override public void onProgressChanged(WebView v, int p) { if (p < 100) pb.setVisibility(View.VISIBLE); }
      @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams pr) {
        if (upCb != null) upCb.onReceiveValue(null);
        upCb = cb;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.setType("image/*");
        i.addCategory(Intent.CATEGORY_OPENABLE);
        try { startActivityForResult(Intent.createChooser(i, "Screenshot chuno"), PICK); }
        catch (Exception e) { upCb = null; return false; }
        return true;
      }
      @Override public void onGeolocationPermissionsShowPrompt(String o, GeolocationPermissions.Callback cb) { cb.invoke(o, true, false); }
    });
    root.addView(wv);
    root.addView(pb);
    wv.loadUrl(URL);
    setContentView(root);
  }
  @Override protected void onActivityResult(int rc, int res, Intent d) {
    if (rc == PICK && upCb != null) {
      Uri[] r = (res == RESULT_OK && d != null && d.getData() != null) ? new Uri[]{ d.getData() } : null;
      upCb.onReceiveValue(r); upCb = null; return;
    }
    super.onActivityResult(rc, res, d);
  }
  @Override public boolean onKeyDown(int code, KeyEvent ev) {
    if (code == KeyEvent.KEYCODE_BACK && wv.canGoBack()) { wv.goBack(); return true; }
    return super.onKeyDown(code, ev);
  }
}

package app.graffititag.personal;

import android.os.Bundle;
import android.os.Build;
import android.content.pm.PackageInfo;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private boolean refreshOnLoad;
    private String appBuild;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ArchiveBackupPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            appBuild = info.versionName + ":" + (Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
        } catch (Exception error) { appBuild = "current"; }
        refreshOnLoad = !appBuild.equals(getPreferences(MODE_PRIVATE).getString("appFilesBuild", ""));
        if (refreshOnLoad) bridge.getWebView().clearCache(true);
        bridge.addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView view) {
                String url = view.getUrl();
                if (url == null || !url.startsWith("https://localhost/")) return;
                boolean force = refreshOnLoad;
                refreshOnLoad = false;
                refreshAppFiles(force);
            }
        });
    }

    public void refreshAppFiles(boolean force) {
        runOnUiThread(() -> {
            try (InputStream input = getAssets().open("public/app-files-recovery.js")) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
                String source = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
                if (force) bridge.getWebView().clearCache(true);
                bridge.getWebView().evaluateJavascript(source + "\nwindow.refreshGraffitiAppFiles(" + force + "," + JSONObject.quote(appBuild) + ").catch(function(){window.graffitiAppFilesRefreshing=false;});", null);
                getPreferences(MODE_PRIVATE).edit().putString("appFilesBuild", appBuild).apply();
            } catch (Exception error) {
                // Retry on the next launch if assets could not be read.
                getPreferences(MODE_PRIVATE).edit().remove("appFilesBuild").apply();
            }
        });
    }
}

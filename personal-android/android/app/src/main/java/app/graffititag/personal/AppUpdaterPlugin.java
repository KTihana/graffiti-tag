package app.graffititag.personal;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private File apk() { return new File(getContext().getCacheDir(), "graffiti-update.apk"); }

    @SuppressWarnings("deprecation")
    private void validate(File file) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        PackageInfo candidate = pm.getPackageArchiveInfo(file.getPath(), PackageManager.GET_SIGNATURES);
        PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES);
        if (candidate == null || !installed.packageName.equals(candidate.packageName))
            throw new Exception("This download is not a Graffiti Tag update.");
        if (candidate.signatures == null || !Arrays.equals(installed.signatures, candidate.signatures))
            throw new Exception("The update signature does not match this app.");
        long next = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
        long current = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
        if (next <= current) throw new Exception("This update is already installed or older than your app.");
    }

    @PluginMethod
    public void download(PluginCall call) {
        String source = call.getString("url", "");
        if (!source.matches("https://github\\.com/KTihana/graffiti-tag/releases/download/v[0-9]+\\.[0-9]+\\.[0-9]+-personal/graffiti-tag-personal\\.apk")) {
            call.reject("Invalid update download."); return;
        }
        if (!downloading.compareAndSet(false, true)) { call.reject("An update is already downloading."); return; }
        getBridge().execute(() -> {
            File partial = new File(getContext().getCacheDir(), "graffiti-update.part");
            HttpURLConnection connection = null;
            try {
                // Reuse only a fully verified APK from this exact release.
                String cached = getContext().getSharedPreferences("app-updater", 0).getString("url", "");
                if (source.equals(cached) && apk().isFile()) {
                    validate(apk()); call.resolve(); return;
                }
                apk().delete();
                URL url = new URL(source);
                for (int redirects = 0; redirects <= 5; redirects++) {
                    if (!url.getProtocol().equals("https")) throw new Exception("Insecure update redirect.");
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
                    connection.setInstanceFollowRedirects(false);
                    connection.setRequestProperty("User-Agent", "GraffitiTag-Updater");
                    int status = connection.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String location = connection.getHeaderField("Location");
                        if (location == null || redirects == 5) throw new Exception("Could not follow update download.");
                        url = new URL(url, location); connection.disconnect(); connection = null; continue;
                    }
                    if (status != 200) throw new Exception("Update download is unavailable. Please try again.");
                    break;
                }
                long total = connection.getContentLengthLong(), received = 0, lastEvent = 0;
                long limit = 200L * 1024 * 1024;
                if (total > limit) throw new Exception("Update is too large.");
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[65536]; int count;
                    while ((count = input.read(buffer)) != -1) {
                        received += count;
                        if (received > limit) throw new Exception("Update is too large.");
                        output.write(buffer, 0, count);
                        long now = System.currentTimeMillis();
                        if (now - lastEvent > 200) {
                            JSObject event = new JSObject(); event.put("received", received); event.put("total", total);
                            notifyListeners("progress", event); lastEvent = now;
                        }
                    }
                    output.getFD().sync();
                }
                if (received == 0 || (total > 0 && received != total)) throw new Exception("The download was interrupted. Please retry.");
                validate(partial);
                if (!partial.renameTo(apk())) throw new Exception("Could not save the update.");
                getContext().getSharedPreferences("app-updater", 0).edit().putString("url", source).apply();
                call.resolve();
            } catch (Exception error) { call.reject(error.getMessage() == null ? "Could not download the update. Please retry." : error.getMessage(), error); }
            finally { partial.delete(); if (connection != null) connection.disconnect(); downloading.set(false); }
        });
    }

    @PluginMethod
    public void install(PluginCall call) {
        try {
            validate(apk());
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent permission = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                startActivityForResult(call, permission, "permissionResult");
            } else openInstaller(call);
        } catch (Exception error) { call.reject(error.getMessage(), error); }
    }

    @ActivityCallback
    private void permissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Allow updates from Graffiti Tag, then tap Install update again."); return;
        }
        try { openInstaller(call); } catch (Exception error) { call.reject("Could not open the installer. Tap Install update to retry.", error); }
    }

    private void openInstaller(PluginCall call) throws Exception {
        validate(apk());
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk());
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(intent);
        call.resolve();
    }
}

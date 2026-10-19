package app.graffititag.personal;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(name = "ArchiveBackup")
public class ArchiveBackupPlugin extends Plugin {
    private File stagedFile(String id) {
        if (id == null || !id.matches("[a-f0-9-]{36}")) throw new IllegalArgumentException("Invalid backup ID.");
        return new File(getContext().getCacheDir(), "archive-backup-" + id + ".json");
    }

    @PluginMethod
    public void prepareBackup(PluginCall call) {
        try {
            String id = UUID.randomUUID().toString();
            File file = stagedFile(id);
            if (!file.createNewFile()) throw new IllegalStateException("Could not create backup file.");
            JSObject response = new JSObject();
            response.put("id", id);
            call.resolve(response);
        } catch (Exception error) { call.reject("Could not prepare backup.", error); }
    }

    @PluginMethod
    public void appendBackup(PluginCall call) {
        try {
            File file = stagedFile(call.getString("id"));
            String chunk = call.getString("chunk");
            if (!file.exists() || chunk == null || chunk.length() > 65536)
                throw new IllegalArgumentException("Invalid backup chunk.");
            if (file.length() + chunk.length() * 3L > 51L * 1024 * 1024)
                throw new IllegalArgumentException("Backup exceeds the file size limit.");
            try (FileOutputStream output = new FileOutputStream(file, true)) {
                output.write(chunk.getBytes(StandardCharsets.UTF_8));
            }
            call.resolve();
        } catch (Exception error) { call.reject("Could not prepare backup data.", error); }
    }

    @PluginMethod
    public void discardBackup(PluginCall call) {
        try { stagedFile(call.getString("id")).delete(); call.resolve(); }
        catch (Exception error) { call.reject("Could not remove temporary backup.", error); }
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        try {
            File file = stagedFile(call.getString("id"));
            if (!file.isFile()) throw new IllegalArgumentException("Backup file is missing.");
            // Only the small ID and filename enter Android's saved activity state.
            // Putting photo data in these options causes TransactionTooLargeException.
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "graffiti-tag-backup.json"));
            startActivityForResult(call, intent, "saveBackupResult");
        } catch (Exception error) { call.reject("Could not open the backup destination picker.", error); }
    }

    @ActivityCallback
    private void saveBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        File file = null;
        try {
            file = stagedFile(call.getString("id"));
            if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
                call.reject("Backup save was cancelled.", "USER_CANCELLED");
                return;
            }
            Uri destination = result.getData().getData();
            if (destination == null) throw new IllegalStateException("No backup destination.");
            try (FileInputStream input = new FileInputStream(file);
                 OutputStream output = getContext().getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) throw new IllegalStateException("Could not open destination.");
                byte[] buffer = new byte[65536];
                int length;
                while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
                output.flush();
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not write the backup to the selected destination.", error);
        } finally {
            if (file != null) file.delete();
        }
    }
}

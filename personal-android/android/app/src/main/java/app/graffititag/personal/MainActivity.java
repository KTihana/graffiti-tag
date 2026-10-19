package app.graffititag.personal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ArchiveBackupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

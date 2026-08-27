package org.lebenindeutschland.app;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppSystemBars")
public class AppSystemBarsPlugin extends Plugin {

    @PluginMethod
    public void setStyle(PluginCall call) {
        Boolean light = call.getBoolean("light");
        if (light == null) {
            call.reject("light must be provided");
            return;
        }

        getActivity()
            .runOnUiThread(
                () -> {
                    WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(
                        getActivity().getWindow(),
                        getActivity().getWindow().getDecorView()
                    );
                    insetsController.setAppearanceLightStatusBars(light);
                    insetsController.setAppearanceLightNavigationBars(light);
                    call.resolve();
                }
            );
    }
}

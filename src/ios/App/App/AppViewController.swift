import Capacitor
import UIKit

/**
 The app's web view controller (set in `Main.storyboard`). It registers the
 plugins that live in this project and that `cap sync` cannot discover, the
 way `MainActivity.java` registers them on Android.
 */
class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppSystemBarsPlugin())
        bridge?.registerPluginInstance(TipJarPlugin())
    }
}

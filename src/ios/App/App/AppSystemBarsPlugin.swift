import Capacitor
import UIKit

/**
 The iOS twin of `AppSystemBarsPlugin.java`: `setStyle({ light })` matches the
 status bar to the theme. The web view keeps out of the status bar and the
 home indicator (`contentInset: "always"` in capacitor.config.ts), so those
 bands show the web view's background - this plugin paints it in the page
 colour of the theme and flips the status bar text.
 */
@objc(AppSystemBarsPlugin)
public class AppSystemBarsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppSystemBarsPlugin"
    public let jsName = "AppSystemBars"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setStyle", returnType: CAPPluginReturnPromise),
    ]

    /// Page background of the app, light and dark (see `themeColor` in app/layout.tsx).
    private static let lightBackground = UIColor(red: 0xF2 / 255, green: 0xF3 / 255, blue: 0xF5 / 255, alpha: 1)
    private static let darkBackground = UIColor(red: 0x14 / 255, green: 0x0E / 255, blue: 0x10 / 255, alpha: 1)

    @objc func setStyle(_ call: CAPPluginCall) {
        let light = call.getBool("light") ?? true
        DispatchQueue.main.async { [weak self] in
            guard let bridge = self?.bridge else {
                call.reject("Bridge not available")
                return
            }
            let background = light ? Self.lightBackground : Self.darkBackground
            bridge.viewController?.view.backgroundColor = background
            bridge.webView?.backgroundColor = background
            bridge.webView?.scrollView.backgroundColor = background
            bridge.statusBarStyle = light ? .darkContent : .lightContent
            bridge.viewController?.setNeedsStatusBarAppearanceUpdate()
            call.resolve()
        }
    }
}

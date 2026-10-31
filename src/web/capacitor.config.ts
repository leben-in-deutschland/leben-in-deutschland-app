import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.lebenindeutschland.app',
  appName: 'Einbürgerungstest',
  webDir: 'out',
  server: {
    androidScheme: "https",
    allowNavigation: ["lebenindeutschland.org", "www.lamplitlabs.com"]
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_android_chrome_192x192",
      iconColor: "#A83A50"
    }
  },
  android: {
    path: "../android",
  },
  ios: {
    path: "../ios",
    // The web view stays out of the status bar and the home indicator; the
    // local AppSystemBars plugin colours those bands like the page.
    contentInset: "always"
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.lebenindeutschland.app',
  appName: 'Einbürgerungstest',
  webDir: 'out',
  server: {
    androidScheme: "https",
    allowNavigation: ["lebenindeutschland.org", "bitesinbyte.com"]
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false
    },
    LocalNotifications: {
      smallIcon: "ic_stat_android_chrome_192x192"
    }
  },
  android: {
    path: "../android",
  },
  ios: {
    path: "../ios",
    contentInset: "always"
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.lebenindeutschland.app',
  appName: 'Einbürgerungstest (No Ads)',
  webDir: 'out',
  server: {
    androidScheme: "https"
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false
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

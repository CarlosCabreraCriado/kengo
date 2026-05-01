import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kengoapp.app',
  appName: 'Kengo',
  webDir: '../../dist/apps/app/browser',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // Origin estable en WebView. Añadido a la allowlist CORS en
    // `convex/http.ts`.
    hostname: 'app.kengoapp.local',
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Lo ocultamos manualmente desde AppComponent cuando
      // `sessionService.sesionInicializada()` sea true, evitando flash
      // blanco mientras Better-Auth restaura sesión.
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#e75c3e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;

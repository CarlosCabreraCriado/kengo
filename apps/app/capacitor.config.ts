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
    // `never` desactiva los insets automáticos del WKScrollView. Con
    // `viewport-fit=cover` + `100lvh` en html/body, `automatic` provoca un
    // desfase tras cerrar el teclado (banda blanca debajo del notch porque
    // iOS no restaura el frame de la WebView). El cálculo de safe-area lo
    // hacemos nosotros vía `env(safe-area-inset-*)`.
    contentInset: 'never',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Lo ocultamos manualmente desde AppComponent cuando
      // `sessionService.sesionInicializada()` sea true (con un mínimo de
      // 600 ms para evitar parpadeo en cold start sin sesión).
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    Keyboard: {
      // En iOS la WKWebView se redimensiona sola al abrir el teclado y
      // `100dvh` lo recoge sin saltos. En Android el modo `native` ha tenido
      // bugs con `position: fixed` en versiones recientes del plugin, así que
      // el `KeyboardService` lo sobrescribe a `Body` en runtime para Android.
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;

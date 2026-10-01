package com.kengoapp.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Capacitor rechaza por defecto la pantalla completa de <video>
        // (su onShowCustomView llama a onCustomViewHidden al instante), así que
        // video.requestFullscreen() no hace nada. Extendemos su ChromeClient
        // para conservar permisos, file chooser y consola.
        bridge.getWebView().setWebChromeClient(new FullscreenChromeClient(bridge));
    }

    private class FullscreenChromeClient extends BridgeWebChromeClient {

        private View customView;
        private CustomViewCallback customViewCallback;

        FullscreenChromeClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) {
                callback.onCustomViewHidden();
                return;
            }
            customView = view;
            customViewCallback = callback;

            view.setBackgroundColor(Color.BLACK);
            ViewGroup decor = (ViewGroup) getWindow().getDecorView();
            decor.addView(
                view,
                new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            );
            bridge.getWebView().setVisibility(View.INVISIBLE);

            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decor);
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }

        @Override
        public void onHideCustomView() {
            if (customView == null) return;

            ViewGroup decor = (ViewGroup) getWindow().getDecorView();
            decor.removeView(customView);
            WebView webView = bridge.getWebView();
            webView.setVisibility(View.VISIBLE);
            WindowCompat.getInsetsController(getWindow(), decor).show(WindowInsetsCompat.Type.systemBars());

            CustomViewCallback callback = customViewCallback;
            customView = null;
            customViewCallback = null;
            callback.onCustomViewHidden();
        }
    }
}

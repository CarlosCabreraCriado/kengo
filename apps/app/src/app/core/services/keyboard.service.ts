import { Injectable, NgZone, effect, inject, signal } from '@angular/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

import { PlatformService } from './platform.service';

/**
 * Centraliza la integración con `@capacitor/keyboard`. Expone signals con la
 * altura y visibilidad del teclado, propaga `--keyboard-height` al DOM (CSS)
 * y aplica `body.kb-visible` para que utilidades CSS reaccionen sin acoplarse
 * al servicio.
 *
 * - iOS: usa los eventos `keyboardWillShow` / `keyboardWillHide` (más
 *   tempranos, vienen con `keyboardHeight`).
 * - Android: usa `keyboardDidShow` / `keyboardDidHide` (los `Will-` no son
 *   fiables en el plugin v8) y fuerza `KeyboardResize.Body` en runtime para
 *   evitar bugs con `position: fixed` que tiene `'native'` en Android.
 * - Web / simulator: no-op (no se registra ningún listener).
 *
 * Hardware keyboard en iPad: ignoramos eventos con altura < 100 px para no
 * disparar la animación de ocultado del tab-bar.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardService {
  private platform = inject(PlatformService);
  private ngZone = inject(NgZone);

  private readonly _height = signal<number>(0);
  private readonly _isVisible = signal<boolean>(false);

  readonly height = this._height.asReadonly();
  readonly isVisible = this._isVisible.asReadonly();

  constructor() {
    if (typeof document === 'undefined') return;

    // CSS var por defecto en `:root` para que el shell tenga un valor estable
    // antes de que el teclado se haya disparado por primera vez.
    document.documentElement.style.setProperty('--keyboard-height', '0px');

    if (!this.platform.isNative()) return;

    if (this.platform.isAndroid()) {
      Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => {
        // sin permisos / plugin no disponible: el comportamiento por defecto
        // del WebView es suficiente.
      });
    }

    if (this.platform.isIOS()) {
      // iOS por defecto hace scroll del WKWebView para que el input enfocado
      // quede visible. Ese scroll es del frame nativo, no del DOM, y al
      // cerrar el teclado no siempre se restaura — deja una banda blanca
      // debajo del notch. Lo desactivamos: el scroll lo gestionamos
      // nosotros vía `scrollIntoView` en `AppComponent.configurarTeclado`,
      // que opera sobre el `<main>` y siempre vuelve al estado original.
      Keyboard.setScroll({ isDisabled: true }).catch(() => {
        // plugin no disponible
      });
    }

    void this.registrarListeners();

    effect(() => {
      const altura = this._height();
      const visible = this._isVisible();
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${altura}px`,
      );
      document.body.classList.toggle('kb-visible', visible);
    });
  }

  /** Cierra el teclado programáticamente. No-op en web. */
  async hide(): Promise<void> {
    if (!this.platform.isNative()) return;
    try {
      await Keyboard.hide();
    } catch {
      // simulator sin teclado activo, web fallback
    }
  }

  private async registrarListeners(): Promise<void> {
    const showEvent = this.platform.isIOS()
      ? 'keyboardWillShow'
      : 'keyboardDidShow';
    const hideEvent = this.platform.isIOS()
      ? 'keyboardWillHide'
      : 'keyboardDidHide';

    await Keyboard.addListener(
      showEvent as 'keyboardWillShow',
      ({ keyboardHeight }) => {
        // Hardware keyboard en iPad emite alturas residuales (~ accessory bar).
        if (keyboardHeight < 100) return;
        this.ngZone.run(() => {
          this._height.set(keyboardHeight);
          this._isVisible.set(true);
        });
      },
    );

    await Keyboard.addListener(hideEvent as 'keyboardWillHide', () => {
      this.ngZone.run(() => {
        this._height.set(0);
        this._isVisible.set(false);
      });
    });
  }
}

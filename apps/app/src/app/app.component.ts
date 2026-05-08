import { Component, DestroyRef, NgZone, OnInit, computed, effect, inject, signal } from '@angular/core';
import {
  RouterOutlet,
  Router,
  NavigationCancel,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

import {
  AuthService,
  BillingBannerComponent,
  SessionService,
  ThemeService,
} from './core';
import { PlatformService } from './core/services/platform.service';
import { KeyboardService } from './core/services/keyboard.service';
import { ExternalBrowserService } from './core/services/external-browser.service';
import { assetUrl } from './core/utils/asset-url';
import { ToastService } from './shared/services/toast/toast.service';
import { ClinicasService } from './features/clinica/data-access/clinicas.service';
import { Ui2CarritoEjerciciosComponent } from './features/planes/components/carrito-ejercicios-v2/carrito-ejercicios-v2.component';
import {
  Ui2CreamBgComponent,
  Ui2OfflineBannerComponent,
  Ui2PageLoaderOverlayComponent,
  Ui2PatientHeaderComponent,
  Ui2PatientSidebarComponent,
  Ui2PatientTabBarComponent,
  Ui2WebTopbarComponent,
} from './shared/ui-v2';
import {
  FISIO_SIDEBAR_GROUPS,
  FISIO_TAB_BAR_TABS,
} from './features/dashboard/pages/inicio/inicio-fisio/inicio-fisio.nav';
import {
  PACIENTE_SIDEBAR_GROUPS,
  PACIENTE_TAB_BAR_TABS,
} from './features/dashboard/pages/inicio/inicio-paciente/inicio-paciente.nav';
import type {
  SidebarNavGroup,
  TabItem,
} from './shared/ui-v2';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    BillingBannerComponent,
    Ui2CarritoEjerciciosComponent,
    Ui2CreamBgComponent,
    Ui2OfflineBannerComponent,
    Ui2PageLoaderOverlayComponent,
    Ui2PatientHeaderComponent,
    Ui2PatientSidebarComponent,
    Ui2PatientTabBarComponent,
    Ui2WebTopbarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'kengo';

  private router = inject(Router);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);
  private platform = inject(PlatformService);
  // KeyboardService es referenciado para forzar la creación del servicio en
  // el bootstrap (registra listeners de Capacitor y propaga
  // `--keyboard-height` al DOM). No se usa directamente desde el template.
  private keyboard = inject(KeyboardService);
  private externalBrowser = inject(ExternalBrowserService);
  private toast = inject(ToastService);
  public sessionService = inject(SessionService);
  private themeService = inject(ThemeService); // Inicia gestión dinámica de colores
  private clinicasService = inject(ClinicasService);

  public mostrarNavegacion = false;

  /**
   * Items "permitidos" cuando el usuario no tiene clínica: el resto de
   * destinos quedan deshabilitados visualmente. El item con id "home" se
   * recablea a `/onboarding` para llevar de vuelta al flujo de bienvenida.
   */
  private readonly ID_HOME = 'home';

  /** Configuración fisio efectiva — bloquea el menú cuando no hay clínica. */
  public readonly fisioSidebarGroups = computed<SidebarNavGroup[]>(() =>
    this.aplicarBloqueoSidebar(FISIO_SIDEBAR_GROUPS),
  );
  public readonly fisioTabBarTabs = computed<TabItem[]>(() =>
    this.aplicarBloqueoTabs(FISIO_TAB_BAR_TABS),
  );

  /** Configuración paciente efectiva — bloquea el menú cuando no hay clínica. */
  public readonly pacienteSidebarGroups = computed<SidebarNavGroup[]>(() =>
    this.aplicarBloqueoSidebar(PACIENTE_SIDEBAR_GROUPS),
  );
  public readonly pacienteTabBarTabs = computed<TabItem[]>(() =>
    this.aplicarBloqueoTabs(PACIENTE_TAB_BAR_TABS),
  );

  private aplicarBloqueoSidebar(
    groups: SidebarNavGroup[],
  ): SidebarNavGroup[] {
    if (!this.sessionService.sinClinica()) return groups;
    return groups.map((g) => ({
      ...g,
      items: g.items.map((it) =>
        it.id === this.ID_HOME
          ? { ...it, label: 'Empezar', route: '/onboarding', matchPrefix: '/onboarding' }
          : { ...it, route: null },
      ),
    }));
  }

  private aplicarBloqueoTabs(tabs: TabItem[]): TabItem[] {
    if (!this.sessionService.sinClinica()) return tabs;
    return tabs.map((t) =>
      t.id === this.ID_HOME
        ? { ...t, label: 'Empezar', route: '/onboarding', matchPrefix: '/onboarding' }
        : { ...t, disabled: true },
    );
  }

  /**
   * Etiqueta abreviada de la clínica activa para piezas de UI con espacio
   * limitado (header móvil, mini-card del sidebar). Prefiere `nombreComercial`
   * cuando está definido y cae al `nombre` completo. Devuelve `null` durante
   * onboarding para que la sidebar oculte la card de "Mi clínica".
   */
  public clinicaActual = computed<string | null>(() => {
    if (this.sessionService.sinClinica()) return null;
    const clinica = this.clinicasService.selectedClinica();
    if (!clinica) return 'Mi clínica';
    return clinica.nombreComercial?.trim() || clinica.nombre || 'Mi clínica';
  });

  /**
   * Texto principal del bloque de marca del sidebar desktop. Se sustituye por
   * el `nombreComercial` de la clínica activa cuando está definido; en caso
   * contrario se mantiene la marca corporativa "KENGO".
   */
  public clinicaBrandName = computed<string>(() => {
    const comercial = this.clinicasService.selectedClinica()?.nombreComercial?.trim();
    return comercial || 'KENGO';
  });

  /**
   * URL de la primera foto de la galería de la clínica activa, lista para usar
   * como fondo de la card "Mi clínica" en el sidenav desktop. Devuelve `null`
   * cuando no hay clínica o no tiene imágenes — el sidebar cae al asset
   * estático por defecto.
   */
  public clinicaImagenUrl = computed<string | null>(() => {
    const fileId = this.clinicasService.selectedClinica()?.imagenes?.[0]?.fileId;
    if (!fileId) return null;
    return assetUrl(fileId, { width: 480, fit: 'cover' });
  });

  public userName = computed(() => this.sessionService.nombreCompleto() || 'Usuario');
  public firstName = computed(() => this.sessionService.usuario()?.first_name || 'Usuario');
  public avatarUrl = computed(() => this.sessionService.usuario()?.avatar_url ?? null);

  /** Subtítulo del user row del sidebar — placeholder hasta tener datos reales del plan. */
  public userSubtitle = computed<string | null>(() => {
    const enModoPaciente = this.sessionService.enModoPaciente();
    return enModoPaciente ? 'Plan activo' : null;
  });

  /** Breakpoint reactivo desktop (md: ≥768px). */
  public esDesktop = signal<boolean>(
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  // Rutas donde NO se debe mostrar la navegación
  private rutasSinNavegacion = [
    '/login',
    '/registro',
    '/magic',
    '/mi-plan',
    '/establecer-password',
    '/recuperar-password',
    '/reset-password',
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(min-width: 768px)');
      const handler = (e: MediaQueryListEvent) => this.esDesktop.set(e.matches);
      mq.addEventListener('change', handler);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', handler));
    }

    if (this.platform.isNative()) {
      this.configurarPlataformaNativa();

      // Ocultar splash cuando la sesión esté inicializada (evita flash blanco
      // del WebView mientras Better-Auth restaura y Convex carga el usuario).
      // En cold start sin sesión, `sesionInicializada()` puede pasar a true en
      // pocos ms (antes del primer paint), así que garantizamos un suelo
      // mínimo visible para que el splash no parpadee.
      const splashStart = Date.now();
      const MIN_SPLASH_MS = 600;
      let splashHidden = false;
      effect(() => {
        if (splashHidden) return;
        if (this.sessionService.sesionInicializada()) {
          splashHidden = true;
          const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - splashStart));
          setTimeout(() => {
            SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {
              // ya estaba oculto
            });
          }, wait);
        }
      });
    }
  }

  ngOnInit() {
    // No ejecutar iniciarApp en /magic — MagicComponent maneja su propia autenticación
    if (!window.location.pathname.startsWith('/magic')) {
      this.authService.iniciarApp();
    }
    this.observarRutas();
  }

  /**
   * Setup específico de plataforma nativa: deep links (`appUrlOpen`) y status
   * bar. Solo se invoca en iOS/Android.
   */
  private configurarPlataformaNativa(): void {
    // Deep links: `kengo://magic?t=...`, `https://kengoapp.com/...`,
    // `kengo://billing/return?status=...`. Los listeners de Capacitor corren
    // fuera de NgZone — hay que entrar para que el Router dispare CD.
    CapacitorApp.addListener('appUrlOpen', (event) => {
      this.ngZone.run(() => {
        try {
          const parsed = new URL(event.url);
          const path = parsed.pathname + parsed.search + parsed.hash;
          if (!path || path === '/') return;

          // Retorno desde Stripe Checkout / Customer Portal (browser modal
          // abierto vía ExternalBrowserService.redirect): cerramos el browser
          // y navegamos al panel de suscripción sin pasar por la URL real
          // /billing/return (no es una ruta Angular, solo un canal de señal).
          // El watchQuery de SubscriptionService recogerá el cambio cuando el
          // webhook de Stripe lo propague (delay típico 1-3 s).
          if (path.startsWith('/billing/return')) {
            void this.externalBrowser.close();
            const status = parsed.searchParams.get('status');
            if (status === 'success') {
              this.toast.success('¡Suscripción activada!');
            } else if (status === 'cancel') {
              this.toast.info('Has cancelado el pago.');
            }
            this.router.navigateByUrl('/mi-clinica/suscripcion');
            return;
          }

          this.router.navigateByUrl(path);
        } catch (err) {
          console.warn('[appUrlOpen] URL inválida:', event.url, err);
        }
      });
    });

    // Status bar dinámica por ruta. Style.Light = contenido claro → texto
    // oscuro; Style.Dark = contenido oscuro → texto claro; Style.Default sigue
    // al sistema (que en la app nativa Kengo significa fondo coral con texto
    // claro). Se aplica al cargar y en cada NavigationEnd.
    this.aplicarStatusBarPorRuta(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.aplicarStatusBarPorRuta(e.urlAfterRedirects || e.url);
      });

    this.configurarTeclado();
  }

  /**
   * Listeners globales para integrar el teclado virtual con la UX:
   *
   * 1. `focusin`: cuando el usuario enfoca un input/textarea y el teclado se
   *    abre por primera vez, comprobamos tras un delay si el campo queda
   *    tapado. Solo hacemos `scrollIntoView` si el rect está claramente
   *    fuera de la zona visible (margen de 32 px) — un guard agresivo para
   *    evitar saltos cuando la WebView ya se redimensionó por sí sola.
   *
   * 2. `pointerdown` (capture): si el usuario toca **fuera** de cualquier
   *    control interactivo, hacemos `blur()` del input activo. Esto deja
   *    que el sistema cierre el teclado de forma natural — `Keyboard.hide()`
   *    solo cierra el panel pero no quita el foco, lo que provocaba que iOS
   *    detectara un input visible enfocado y lo reabriera (ping-pong).
   *
   *    Excluimos del cierre los controles interactivos comunes
   *    (`button, a, [role=button]`) para que el usuario pueda pulsar
   *    "enviar", "guardar" o un dropdown sin perder el teclado.
   *
   *    Se usa fase de captura para correr antes que el ciclo de focus
   *    natural del navegador.
   */
  private configurarTeclado(): void {
    let ultimoScrollTarget: HTMLElement | null = null;

    const focusInHandler = (ev: FocusEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.matches('input, textarea, [contenteditable="true"]')) {
        return;
      }
      // Evita re-disparar scrollIntoView sobre el mismo target durante
      // animaciones rápidas de show/hide del teclado.
      if (ultimoScrollTarget === target) return;
      ultimoScrollTarget = target;
      window.setTimeout(() => {
        ultimoScrollTarget = null;
        // Si el target perdió el foco mientras esperábamos, no hacer scroll.
        if (document.activeElement !== target) return;
        const rect = target.getBoundingClientRect();
        const visibleBottom = window.innerHeight - this.keyboard.height();
        // Threshold amplio (32 px): solo centramos si el campo está
        // claramente cubierto por el teclado.
        if (rect.bottom > visibleBottom - 32) {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 280);
    };

    const SELECTOR_EDITABLE =
      'input, textarea, select, [contenteditable="true"]';
    const SELECTOR_INTERACTIVO =
      'button, a, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], label, .cdk-overlay-container';

    const pointerDownHandler = (ev: PointerEvent) => {
      if (!this.keyboard.isVisible()) return;
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      // Si el tap es sobre otro campo editable o un overlay CDK, dejar que
      // el navegador gestione el cambio de foco / modal naturalmente.
      if (t.closest(SELECTOR_EDITABLE)) return;
      // Si es un control interactivo (botón, enlace, rol asignable), el
      // usuario probablemente está accionando el formulario — mantener
      // el teclado abierto.
      if (t.closest(SELECTOR_INTERACTIVO)) return;
      // Tap en zona "de fondo": quitar el foco del input activo. El SO
      // cerrará el teclado por sí solo, sin riesgo de reapertura.
      const active = document.activeElement as HTMLElement | null;
      if (active?.matches(SELECTOR_EDITABLE)) {
        active.blur();
      }
    };

    document.addEventListener('focusin', focusInHandler);
    document.addEventListener('pointerdown', pointerDownHandler, {
      capture: true,
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('focusin', focusInHandler);
      document.removeEventListener('pointerdown', pointerDownHandler, {
        capture: true,
      } as EventListenerOptions);
    });
  }

  /**
   * Resuelve el estilo de status bar adecuado para la ruta y lo aplica.
   * Solo tiene efecto en plataforma nativa.
   */
  private aplicarStatusBarPorRuta(url: string): void {
    const style = this.resolverStatusBarStyle(url);
    StatusBar.setStyle({ style }).catch(() => {
      /* simulator/web fallback */
    });
  }

  private resolverStatusBarStyle(url: string): Style {
    // Auth y onboarding: fondo claro → texto oscuro.
    if (
      url.startsWith('/login') ||
      url.startsWith('/registro') ||
      url.startsWith('/magic') ||
      url.startsWith('/establecer-password') ||
      url.startsWith('/recuperar-password') ||
      url.startsWith('/reset-password')
    ) {
      return Style.Light;
    }
    // Sesión activa fullscreen sobre cream-50 (oscuro relativo): texto claro.
    if (url.startsWith('/mi-plan') || url.startsWith('/realizar-plan')) {
      return Style.Dark;
    }
    // App principal sobre coral / cream: texto claro.
    return Style.Default;
  }

  private observarRutas() {
    // Verificar ruta inicial
    this.actualizarNavegacion(this.router.url);

    // Observar cambios de ruta
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd || event instanceof NavigationCancel,
        ),
      )
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.actualizarNavegacion(event.urlAfterRedirects || event.url);
        }
      });
  }

  private actualizarNavegacion(url: string) {
    this.mostrarNavegacion = !this.rutasSinNavegacion.some((ruta) =>
      url.startsWith(ruta),
    );
  }
}

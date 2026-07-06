import { Component, DestroyRef, NgZone, OnInit, computed, effect, inject, signal } from '@angular/core';
import {
  RouterOutlet,
  Router,
  RouteReuseStrategy,
  NavigationCancel,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

import {
  AuthService,
  BillingBannerComponent,
  LoggerService,
  SessionService,
  ThemeService,
} from './core';
import { ConnectionErrorComponent } from './core/components/connection-error/connection-error.component';
import { OfflineBannerComponent } from './core/components/offline-banner/offline-banner.component';
import { ImpersonationBannerComponent } from './features/soporte/components/impersonation-banner/impersonation-banner.component';
import { PlatformService } from './core/services/platform.service';
import { OrientationLockService } from './core/services/orientation-lock.service';
import { KeyboardService } from './core/services/keyboard.service';
import { BackButtonService } from './core/services/back-button.service';
import { AppLifecycleService } from './core/services/app-lifecycle.service';
import { ExternalBrowserService } from './core/services/external-browser.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { ConvexService } from './core/convex/convex.service';
import { CustomRouteReuseStrategy } from './core/config/route-reuse-strategy';
import {
  ScrollContainerDirective,
  ScrollContainerService,
} from './core/services/scroll-container.service';
import { assetUrl } from './core/utils/asset-url';
import { DialogService } from './shared/services/dialog/dialog.service';
import { ToastService } from './shared/services/toast/toast.service';
import { ClinicasService } from './features/clinica/data-access/clinicas.service';
import { Ui2CarritoEjerciciosComponent } from './features/planes/components/carrito-ejercicios-v2/carrito-ejercicios-v2.component';
import {
  Ui2CreamBgComponent,
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
  // Marca el shell cuando hay impersonación activa para reservar el alto del
  // banner (ver app.component.css → `:host(.impersonating) > section`).
  host: { '[class.impersonating]': 'sessionService.estaImpersonando()' },
  imports: [
    RouterOutlet,
    ScrollContainerDirective,
    BillingBannerComponent,
    ConnectionErrorComponent,
    OfflineBannerComponent,
    ImpersonationBannerComponent,
    Ui2CarritoEjerciciosComponent,
    Ui2CreamBgComponent,
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
  private orientationLock = inject(OrientationLockService);
  // KeyboardService es referenciado para forzar la creación del servicio en
  // el bootstrap (registra listeners de Capacitor y propaga
  // `--keyboard-height` al DOM). No se usa directamente desde el template.
  private keyboard = inject(KeyboardService);
  private backButton = inject(BackButtonService);
  private appLifecycle = inject(AppLifecycleService);
  private externalBrowser = inject(ExternalBrowserService);
  private pushNotifications = inject(PushNotificationService);
  private toast = inject(ToastService);
  private dialogService = inject(DialogService);
  public sessionService = inject(SessionService);
  public convexService = inject(ConvexService);
  private themeService = inject(ThemeService); // Inicia gestión dinámica de colores
  private clinicasService = inject(ClinicasService);
  private logger = inject(LoggerService);
  private scrollContainer = inject(ScrollContainerService);
  // Misma instancia que usa el Router (provista vía useClass en app.config).
  private routeReuseStrategy = inject(RouteReuseStrategy) as CustomRouteReuseStrategy;

  public mostrarNavegacion = false;

  /**
   * El overlay de error de conexión se muestra tanto cuando `iniciarApp` no
   * pudo restaurar la sesión (`errorConexion`) como cuando el refresh del
   * JWT en runtime falla (`convex.tokenError`). El template lee este
   * computed para no tener que recordar ambas fuentes en cada `@if`.
   */
  public readonly mostrarErrorConexion = computed(
    () => this.sessionService.errorConexion() || !!this.convexService.tokenError(),
  );

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
    '/seleccionar-clinica',
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

      // Inicializa push notifications una vez tengamos sesión válida con
      // usuario cargado. El servicio es idempotente; si el usuario hace
      // logout y vuelve a entrar, `teardown` y luego `init` se encargan
      // de re-registrar el token.
      let pushIniciado = false;
      effect(() => {
        if (pushIniciado) return;
        if (
          this.sessionService.sesionInicializada() &&
          this.sessionService.isLoggedIn() &&
          this.sessionService.usuario()
        ) {
          pushIniciado = true;
          this.pushNotifications.init().catch((err) => {
            this.logger.error('[Push] init falló desde AppComponent:', err);
          });
        }
      });

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

    // Pop-up informativo al activar modo paciente. Reacciona a la transición
    // fisio → paciente desde cualquier punto de entrada (botón "Activar modo
    // paciente", toggle del avatar, etc.). La primera evaluación se descarta
    // para no disparar el diálogo tras un reload cuando el usuario ya estaba
    // en paciente. Filtra también los casos en que `sincronizadorModo` fuerza
    // paciente para usuarios sin capacidad fisio: ahí `puedeAlternarModo` es
    // false y la instrucción "haz click en la foto para volver a fisio" no
    // aplica.
    let prevEnModoPaciente: boolean | null = null;
    effect(() => {
      const actual = this.sessionService.enModoPaciente();
      const puedeAlternar = this.sessionService.puedeAlternarModo();
      const prev = prevEnModoPaciente;
      prevEnModoPaciente = actual;
      if (prev === null) return;
      if (!prev && actual && puedeAlternar) {
        void this.dialogService.confirm({
          title: 'Modo paciente activado',
          message:
            'Estás viendo la app tal y como la vería un paciente. Para volver a modo fisio, haz click en tu foto de perfil.',
          confirmText: 'Entendido',
          hideCancel: true,
        });
      }
    });
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
    // Lock de orientación a portrait cuando la dimensión corta del dispositivo
    // está por debajo del breakpoint `md:` (UI móvil). Tablets quedan libres.
    // Lo antes posible para que iOS no muestre un primer frame en landscape
    // si la app se abrió con el dispositivo girado.
    void this.orientationLock.aplicar();

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
          this.logger.warn('[appUrlOpen] URL inválida:', event.url, err);
        }
      });
    });

    // Status bar en iOS: la app vive sobre cream-50 (fondo claro). En el
    // plugin de Capacitor, Style.Light = "Dark text for light backgrounds"
    // → iconos NEGROS (el nombre describe la apariencia clara de la barra,
    // no el color del texto). Solo se aplica en iOS: en Android la status
    // bar tiene fondo coral opaco (gestionado por ThemeService) y conviene
    // dejar el comportamiento por defecto (iconos blancos sobre coral).
    if (this.platform.isIOS()) {
      StatusBar.setStyle({ style: Style.Light }).catch(() => {
        /* simulator/web fallback */
      });
    }

    // Botón atrás hardware (solo Android) y ciclo de vida resume/pause
    // (badge, auto-retry de conexión, refresh tras suspensión larga).
    this.backButton.init();
    this.appLifecycle.init();

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

  private observarRutas() {
    // Verificar ruta inicial
    this.actualizarNavegacion(this.router.url);

    // El <main> del shell persiste entre navegaciones (envuelve al
    // router-outlet), así que el scroll se heredaría de la página anterior.
    // Reset a top en cada cambio de path, EXCEPTO cuando la estrategia de
    // reuse acaba de re-attachear un componente cacheado (ella restaura la
    // posición guardada) o cuando solo cambian los query params (filtros).
    let previousPath = this.router.url.split('?')[0];

    // Observar cambios de ruta
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd || event instanceof NavigationCancel,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          const url = event.urlAfterRedirects || event.url;
          this.actualizarNavegacion(url);

          const path = url.split('?')[0];
          const wasReattach = this.routeReuseStrategy.consumeReattachFlag();
          if (path !== previousPath && !wasReattach) {
            this.scrollContainer.scrollToTop();
          }
          previousPath = path;
        }
      });
  }

  private actualizarNavegacion(url: string) {
    this.mostrarNavegacion = !this.rutasSinNavegacion.some((ruta) =>
      url.startsWith(ruta),
    );
  }
}

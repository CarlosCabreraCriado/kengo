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
import { ExternalBrowserService } from './core/services/external-browser.service';
import { ToastService } from './shared/services/toast/toast.service';
import { Ui2CarritoEjerciciosComponent } from './features/planes/components/carrito-ejercicios-v2/carrito-ejercicios-v2.component';
import {
  Ui2CreamBgComponent,
  Ui2PatientHeaderComponent,
  Ui2PatientSidebarComponent,
  Ui2PatientTabBarComponent,
  Ui2WebTopbarComponent,
} from './shared/ui-v2';
import {
  FISIO_SIDEBAR_GROUPS,
  FISIO_TAB_BAR_TABS,
} from './features/dashboard/pages/inicio/inicio-fisio/inicio-fisio.nav';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    BillingBannerComponent,
    Ui2CarritoEjerciciosComponent,
    Ui2CreamBgComponent,
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
  private externalBrowser = inject(ExternalBrowserService);
  private toast = inject(ToastService);
  public sessionService = inject(SessionService);
  private themeService = inject(ThemeService); // Inicia gestión dinámica de colores

  public mostrarNavegacion = false;

  /** Configuración de navegación V2 del modo fisio (sidebar + tab-bar). */
  public readonly fisioSidebarGroups = FISIO_SIDEBAR_GROUPS;
  public readonly fisioTabBarTabs = FISIO_TAB_BAR_TABS;

  /** Nombre de la clínica activa (fallback genérico hasta tener un servicio dedicado). */
  public clinicaActual = computed(() => {
    const clinicas = this.sessionService.misclinicas();
    if (!clinicas || clinicas.length === 0) return 'Mi clínica';
    return 'Mi clínica';
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
      effect(() => {
        if (this.sessionService.sesionInicializada()) {
          SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {
            // ya estaba oculto
          });
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

    // Status bar: estilo claro sobre fondo coral por defecto. ThemeService
    // puede sobrescribir según clínica activa en fase 5.
    StatusBar.setStyle({ style: Style.Default }).catch(() => {
      /* simulator/web fallback */
    });
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

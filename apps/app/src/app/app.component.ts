import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import {
  RouterOutlet,
  Router,
  NavigationCancel,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs/operators';

import {
  AuthService,
  NavegacionComponent,
  SessionService,
  ThemeService,
} from './core';
import { CarritoEjerciciosComponent } from './features/planes/components/carrito-ejercicios/carrito-ejercicios.component';
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
    CarritoEjerciciosComponent,
    NavegacionComponent,
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
  public sessionService = inject(SessionService);
  private themeService = inject(ThemeService); // Inicia gestión dinámica de colores

  public mostrarNavegacion = false;

  /** Configuración de navegación V2 del modo fisio (sidebar + tab-bar). */
  public readonly fisioSidebarGroups = FISIO_SIDEBAR_GROUPS;
  public readonly fisioTabBarTabs = FISIO_TAB_BAR_TABS;

  /** URL actual reactiva — usada para conmutar shell V2 ↔ legacy en modo fisio. */
  private readonly currentUrl = signal<string>(this.router.url);

  /** Rutas del modo fisio que ya están migradas al shell V2. */
  private readonly rutasV2Fisio = ['/inicio/fisio', '/mis-pacientes', '/ejercicios', '/rutinas'];

  /** True cuando la URL pertenece a una ruta del fisio ya migrada al shell V2. */
  public readonly enRutaV2Fisio = computed(() => {
    const url = this.currentUrl();
    return this.rutasV2Fisio.some((r) => url.startsWith(r));
  });

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
  private rutasSinNavegacion = ['/login', '/registro', '/magic', '/mi-plan', '/establecer-password'];

  constructor() {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(min-width: 768px)');
      const handler = (e: MediaQueryListEvent) => this.esDesktop.set(e.matches);
      mq.addEventListener('change', handler);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', handler));
    }
  }

  ngOnInit() {
    // No ejecutar iniciarApp en /magic — MagicComponent maneja su propia autenticación
    if (!window.location.pathname.startsWith('/magic')) {
      this.authService.iniciarApp();
    }
    this.observarRutas();
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
    this.currentUrl.set(url);
    this.mostrarNavegacion = !this.rutasSinNavegacion.some((ruta) =>
      url.startsWith(ruta),
    );
  }
}

import { Component, OnInit, computed, inject } from '@angular/core';
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
  Ui2PatientTabBarComponent,
} from './shared/ui-v2';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CarritoEjerciciosComponent,
    NavegacionComponent,
    Ui2CreamBgComponent,
    Ui2PatientHeaderComponent,
    Ui2PatientTabBarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'kengo';

  private router = inject(Router);
  private authService = inject(AuthService);
  public sessionService = inject(SessionService);
  private themeService = inject(ThemeService); // Inicia gestión dinámica de colores

  public mostrarNavegacion = false;

  /** Nombre de la clínica activa (fallback genérico hasta tener un servicio dedicado). */
  public clinicaActual = computed(() => {
    const clinicas = this.sessionService.misclinicas();
    if (!clinicas || clinicas.length === 0) return 'Mi clínica';
    return 'Mi clínica';
  });

  public userName = computed(() => this.sessionService.nombreCompleto() || 'Usuario');
  public avatarUrl = computed(() => this.sessionService.usuario()?.avatar_url ?? null);

  // Rutas donde NO se debe mostrar la navegación
  private rutasSinNavegacion = ['/login', '/registro', '/magic', '/mi-plan', '/establecer-password'];

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
    this.mostrarNavegacion = !this.rutasSinNavegacion.some((ruta) =>
      url.startsWith(ruta),
    );
  }
}

import { Component, OnInit, inject } from '@angular/core';
import {
  RouterOutlet,
  Router,
  NavigationCancel,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs/operators';

import { AuthService, NavegacionComponent } from './core';
import { CarritoEjerciciosComponent } from './features/planes/components/carrito-ejercicios/carrito-ejercicios.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CarritoEjerciciosComponent, NavegacionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'kengo';

  private router = inject(Router);
  private authService = inject(AuthService);

  public mostrarNavegacion = false;

  // Rutas donde NO se debe mostrar la navegación
  private rutasSinNavegacion = ['/login', '/registro', '/magic', '/mi-plan'];

  ngOnInit() {
    this.authService.iniciarApp();
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

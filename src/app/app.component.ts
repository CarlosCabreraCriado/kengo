import { Component, OnInit, computed, inject } from '@angular/core';

import { filter } from 'rxjs/operators';
import { CarritoEjerciciosComponent } from './carrito-ejercicios/carrito-ejercicios.component';
import { NavegacionComponent } from './navegacion/navegacion.component';

import { AuthService } from './services/auth.service';

import {
  RouterOutlet,
  Router,
  NavigationCancel,
  NavigationEnd,
} from '@angular/router';

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
  private rutasSinNavegacion = ['/login', '/registro', '/magic'];

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

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BreakpointObserver } from '@angular/cdk/layout';

import { environment as env } from '../../../../../environments/environment';
import { SessionService } from '../../../auth/services/session.service';

@Component({
  selector: 'app-navegacion',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion.component.html',
  styleUrl: './navegacion.component.scss',
})
export class NavegacionComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  public sessionService = inject(SessionService);

  public isMovil = signal(false);
  public isInicio = signal(false);

  // Mostrar navbar: siempre en desktop, solo en /inicio en móvil
  public showNavbar = computed(() => !this.isMovil() || this.isInicio());

  public avatarUrl = computed(() => {
    const id_avatar = this.sessionService.usuario()?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover&width=96&height=96&quality=80`
      : null;
  });

  public isPaciente = computed(
    () => this.sessionService.rolUsuario() === 'paciente',
  );

  public isFisio = computed(() => this.sessionService.rolUsuario() === 'fisio');

  ngOnInit() {
    // Detectar si es móvil
    this.breakpointObserver
      .observe(['(max-width: 767.98px)'])
      .subscribe((result) => {
        this.isMovil.set(result.matches);
      });

    // Detectar ruta actual
    this.checkIfInicio(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.checkIfInicio((event as NavigationEnd).urlAfterRedirects);
      });
  }

  private checkIfInicio(url: string) {
    this.isInicio.set(url === '/inicio' || url === '/');
  }

  logout() {
    console.warn('Realizando Logout...');
    this.router.navigate(['/login']);
  }
}

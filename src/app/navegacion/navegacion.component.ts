import {
  Component,
  ChangeDetectorRef,
  computed,
  inject,
  OnInit,
} from '@angular/core';

//Router:
import { RouterOutlet } from '@angular/router';
import { Router, RouterLink, NavigationEnd } from '@angular/router';

import { environment as env } from '../../environments/environment';

//Angular Material:
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

//Servicios:
import { AppService } from '../services/app.service';

import { trigger, transition, style, animate } from '@angular/animations';

import { BreakpointObserver } from '@angular/cdk/layout';
import { SeccionPrincipal } from '../../types/global';
import { ViewEncapsulation } from '@angular/core';

interface Rutas {
  nombre: string;
  ruta: string;
  seleccionado: boolean;
}

interface OpcionesRutas {
  inicio: Rutas[];
  ejercicios: Rutas[];
  pacientes: Rutas[];
  clínica: Rutas[];
}

@Component({
  selector: 'app-navegacion',
  standalone: true,
  imports: [
    MatChipsModule,
    MatIconModule,
    RouterOutlet,
    RouterLink,
    MatCardModule,
    MatMenuModule,
    MatButtonModule,
    MatTabsModule,
  ],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './navegacion.component.html',
  styleUrl: './navegacion.component.scss',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        style({ opacity: 0 }), // El nuevo componente comienza invisible
        animate('300ms ease-in-out', style({ opacity: 1 })), // Fade-in
      ]),
    ]),
  ],
})
export class NavegacionComponent implements OnInit {
  //Servicios:
  private breakpointObserver = inject(BreakpointObserver);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  public appService = inject(AppService);
  public dialog = inject(MatDialog);

  //Permisos:
  public isAdminClinica = false;

  public selectedTabIndex = 0;
  public opcionSeleccionada: SeccionPrincipal = 'inicio';

  //Señales:
  public avatarUrl = computed(() => {
    const id_avatar = this.appService.usuario()?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover&width=96&height=96&quality=80`
      : null;
  });

  public isPaciente = computed(
    () => this.appService.rolUsuario() === 'paciente',
  );
  public isFisio = computed(() => this.appService.rolUsuario() === 'fisio');

  ngOnInit() {
    this.construirRutas();
    this.breakpointObserver
      .observe(['(max-width: 767.98px)'])
      .subscribe((result) => {
        this.isMovil = result.matches;
      });

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.construirRutas();
      }
    });
  }

  public opciones: OpcionesRutas = {
    inicio: [
      {
        nombre: 'Inicio',
        ruta: 'inicio/dashboard',
        seleccionado: false,
      },
      {
        nombre: 'Perfil',
        ruta: 'inicio/perfil',
        seleccionado: false,
      },
    ],
    ejercicios: [
      {
        nombre: 'Buscador de ejercicios',
        ruta: 'inicio/ejercicios',
        seleccionado: false,
      },
    ],
    pacientes: [
      {
        nombre: 'Mis pacientes',
        ruta: 'inicio/mis-pacientes',
        seleccionado: false,
      },
    ],
    clínica: [
      {
        nombre: 'Mi clínica',
        ruta: 'inicio/mi-clinica',
        seleccionado: false,
      },
      {
        nombre: 'Fisioterapeutas',
        ruta: 'inicio/fisioterapeutas',
        seleccionado: false,
      },
    ],
  };

  public routeAnimationState = '';
  public isMovil = false;

  logout() {
    console.warn('Realizando Logout...');
    this.router.navigate(['/login']);
  }

  onActivate() {
    this.routeAnimationState = this.router.url;
    this.cdr.detectChanges();
  }

  construirRutas() {
    // Ejecutar la función deseada al cambiar de ruta
    if (this.router.url == '/inicio') {
      this.selectedTabIndex = 0;
      this.opciones.inicio[0].seleccionado = true;
      this.router.navigate(['/inicio/dashboard']);
      return;
    }

    const etiquetas: SeccionPrincipal[] = ['inicio'];

    if (this.isFisio()) {
      etiquetas.push('ejercicios');
      etiquetas.push('pacientes');
      etiquetas.push('clínica');
    }

    if (this.isPaciente()) {
      etiquetas.push('clínica');
    }

    const url = this.router.url.slice(1); //URL en formato: "inicio/accesos"

    for (let j = 0; j < etiquetas.length; j++) {
      for (const opcion of this.opciones[etiquetas[j]]) {
        if (url.startsWith(opcion.ruta)) {
          opcion.seleccionado = true;
          this.selectedTabIndex = j;
          this.opcionSeleccionada = etiquetas[j];
        } else {
          opcion.seleccionado = false;
        }
        //Corrige para Perfil (tercer nivel)
        if (url.startsWith('inicio/perfil')) {
          this.selectedTabIndex = 0;
          this.opciones.inicio[1].seleccionado = true;
        }

        if (url.startsWith('inicio/mi-clinica')) {
          this.selectedTabIndex = 3;
          this.opciones.inicio[0].seleccionado = true;
        }

        if (url.startsWith('inicio/detalle-ejercicio')) {
          this.selectedTabIndex = 1;
          //this.opciones.inicio[0].seleccionado = true;
        }
      }
    }
  }

  /*
  avatarUrl(p: Signal<Usuario>): string | null {
    const id_avatar = p?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover&width=96&height=96&quality=80`
      : null;
  }
  */

  onTabChange(event: unknown): void {
    if (!event) return;
    const evento = event as { tab: { textLabel: SeccionPrincipal } };
    // Navegar a la ruta correspondiente
    const etiqueta: SeccionPrincipal = evento.tab.textLabel;
    this.opcionSeleccionada = etiqueta;

    console.warn('Cambiando a pestaña: ' + etiqueta);
    if (this.opciones[etiqueta]) {
      for (const opcion of this.opciones[etiqueta]) {
        if (opcion.seleccionado) {
          this.router.navigate([opcion.ruta]);
          return;
        }
      }
      this.router.navigate([this.opciones[etiqueta][0].ruta]);
    }
  }

  onChipClick(tipoChip: SeccionPrincipal, index: number) {
    //Navegar a la ruta:
    if (this.opciones[tipoChip]) {
      this.router.navigate([this.opciones[tipoChip][index].ruta]);
    }
  }
}

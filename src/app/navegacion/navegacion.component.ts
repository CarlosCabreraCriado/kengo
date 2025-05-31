import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { RouterOutlet } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';
import { AppService } from '../services/app.service';
import { MatChipsModule } from '@angular/material/chips';

import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { trigger, transition, style, animate } from '@angular/animations';

import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';

import { Usuario, SeccionPrincipal } from '../models/Global';

interface Rutas {
  nombre: string;
  ruta: string;
  seleccionado: boolean;
}

interface OpcionesRutas {
  inicio: Rutas[];
  ejercicios: Rutas[];
  clientes: Rutas[];
  clinica: Rutas[];
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
    CommonModule,
    MatTabsModule,
  ],
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
export class NavegacionComponent {
  // isToggled
  private routeSubscription: Subscription;

  //Permisos:
  public isFisio = false;
  public isCliente = false;
  public isAdminClinica = false;

  public selectedTabIndex = 0;
  public opcionSeleccionada: SeccionPrincipal = 'inicio';

  public opciones: OpcionesRutas = {
    inicio: [
      {
        nombre: 'Inicio',
        ruta: 'inicio/dashboard',
        seleccionado: false,
      },
    ],
    ejercicios: [
      {
        nombre: 'Ejercicios',
        ruta: 'inicio/ejercicios',
        seleccionado: false,
      },
    ],
    clientes: [
      {
        nombre: 'Clientes',
        ruta: 'inicio/clientes',
        seleccionado: false,
      },
    ],
    clinica: [
      {
        nombre: 'Clinica',
        ruta: 'inicio/impulsor/cursos',
        seleccionado: false,
      },
    ],
  };

  public routeAnimationState = '';
  public usuario: Usuario | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    public appService: AppService,
    public dialog: MatDialog,
  ) {
    this.appService.accesos$.subscribe((accesos) => {
      if (accesos) {
        this.isCliente = accesos.isCliente;
        this.isFisio = accesos.isFisio;
        this.construirRutas();
      }
    });

    this.routeSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.construirRutas();
      }
    });
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
      return;
    }

    const etiquetas: SeccionPrincipal[] = ['inicio'];

    if (this.isFisio) {
      etiquetas.push('ejercicios');
      etiquetas.push('clientes');
      etiquetas.push('clinica');
    }

    if (this.isCliente) {
      etiquetas.push('clinica');
      etiquetas.push('clinica');
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
          this.opciones.inicio[0].seleccionado = true;
        }
      }
    }
  }

  onTabChange(event: any): void {
    // Navegar a la ruta correspondiente
    const etiqueta: SeccionPrincipal = event.tab.textLabel;
    this.opcionSeleccionada = etiqueta;

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

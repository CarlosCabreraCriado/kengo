import { Component, computed, Signal, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';

//Componentes:
import { BotonTarjetaComponent } from '../boton-tarjeta/boton-tarjeta.component';
import { TarjetaFisioComponent } from '../tarjeta-fisio/tarjeta-fisio.component';
import { TarjetaPrincipalComponent } from '../tarjeta-principal/tarjeta-principal.component';

//Dialogos:
import { MatDialog } from '@angular/material/dialog';
import { DialogoComponent } from '../dialogos/dialogos.component';

import { Accesos } from '../models/Global';
import { AppService } from '../services/app.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatMenuModule,
    MatButtonModule,
    MatProgressBarModule,
    BotonTarjetaComponent,
    TarjetaFisioComponent,
    TarjetaPrincipalComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  public accesos: Accesos | null | undefined;

  public isFisio: Signal<boolean> = signal(false);
  public isPaciente: Signal<boolean> = signal(false);
  userRole = this.appService.rolUsuario;

  constructor(
    private router: Router,
    private appService: AppService,
    public dialog: MatDialog,
  ) {
    this.appService.accesos$.subscribe((accesos) => {
      if (accesos) {
        this.accesos = accesos;
      }
    });

    this.isFisio = computed(() => this.appService.rolUsuario() === 'fisio');
    this.isPaciente = computed(
      () => this.appService.rolUsuario() === 'paciente',
    );
  }

  toggle() {
    this.appService.toggleRolUsuario();
  }
}

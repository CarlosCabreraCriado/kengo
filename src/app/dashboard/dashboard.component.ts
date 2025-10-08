import { Component, computed, Signal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';

//Componentes:
import { BotonTarjetaComponent } from '../boton-tarjeta/boton-tarjeta.component';
import { TarjetaFisioComponent } from '../tarjeta-fisio/tarjeta-fisio.component';
import { TarjetaPrincipalComponent } from '../tarjeta-principal/tarjeta-principal.component';

//Servicios:
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
  private appService = inject(AppService);

  public isFisio: Signal<boolean> = computed(
    () => this.appService.rolUsuario() === 'fisio',
  );

  public isPaciente = computed(
    () => this.appService.rolUsuario() === 'paciente',
  );

  public permitirMultiRol: Signal<boolean> = computed(() =>
    this.appService.permitirMultiRol(),
  );

  userRole = this.appService.rolUsuario;

  toggle() {
    this.appService.toggleRolUsuario();
  }
}

import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';

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
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  public accesos: Accesos | null | undefined;

  constructor(
    private router: Router,
    public dialog: MatDialog,
    private appService: AppService,
  ) {
    this.appService.accesos$.subscribe((accesos) => {
      if (accesos) {
        this.accesos = accesos;
      }
    });
  }

  checkAcceso(tipoAcceso: string) {
    console.warn('Accesos', this.accesos);
    switch (tipoAcceso) {
      case 'paciente':
        if (!this.accesos?.isPaciente) {
          //Solicitar acceso Formador:
          console.warn('Solicitar acceso FORMADOR');

          /*
          const dialogRef = this.dialog
            .open(DialogoAccesoComponent, {
              data: {
                tipo: 'formador',
              },
            })
            .afterClosed()
            .subscribe((result) => {
              console.log('Dialogo cerrado, ', result);
            });
          */
        } else {
          //Redirige a la vista de formador
          console.log('Redirigiendo a la vista de formador');
          this.router.navigate(['/inicio/formador/panel']);
        }
        break;
      case 'fisio':
        if (!this.accesos?.isFisio) {
          //Solicitar acceso Contacto:
          console.warn('Solicitar acceso CONTACTO');
          /*
          const dialogRef = this.dialog
            .open(DialogoAccesoComponent, {
              data: {
                tipo: 'contacto',
              },
            })
            .afterClosed()
            .subscribe((result) => {
              console.log('Dialogo cerrado, ', result);
            });
          */
        } else {
          //Redirige a la vista de institucion:
          console.log('Redirigiendo a la vista de institucion');
          this.router.navigate(['/inicio/institucion/mis-instituciones']);
        }
        break;
    }
  }
}

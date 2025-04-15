import { Component } from '@angular/core';
import { NavegacionComponent } from '../navegacion/navegacion.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-carrito-ejercicios',
  imports: [
    NavegacionComponent,

    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
  ],
  templateUrl: './carrito-ejercicios.component.html',
  styleUrl: './carrito-ejercicios.component.css',
})
export class CarritoEjerciciosComponent {}

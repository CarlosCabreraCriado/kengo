import { Routes } from '@angular/router';
import { InicioComponent } from './inicio/inicio.component';
import { EjerciciosComponent } from './ejercicios/ejercicios.component';
import { FisiosComponent } from './fisios/fisios.component';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: InicioComponent, pathMatch: 'full' },
  { path: 'ejercicios', component: EjerciciosComponent, pathMatch: 'full' },
  { path: 'fisios', component: FisiosComponent, pathMatch: 'full' },
];

import { Routes } from '@angular/router';
import { InicioComponent } from './inicio/inicio.component';
import { EjerciciosComponent } from './ejercicios/ejercicios.component';
import { FisiosComponent } from './fisios/fisios.component';
import { CategoriasComponent } from './categorias/categorias.component';
import { DetalleEjercicioComponent } from './detalle-ejercicio/detalle-ejercicio.component';
import { ClientesComponent } from './clientes/clientes.component';
import { PerfilComponent } from './perfil/perfil.component';
import { MiclinicaComponent } from './miclinica/miclinica.component';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: InicioComponent, pathMatch: 'full' },
  { path: 'ejercicios', component: EjerciciosComponent, pathMatch: 'full' },
  { path: 'fisios', component: FisiosComponent, pathMatch: 'full' },
  { path: 'categorias', component: CategoriasComponent, pathMatch: 'full' },
  {
    path: 'detalle-ejercicio',
    component: DetalleEjercicioComponent,
    pathMatch: 'full',
  },
  { path: 'clientes', component: ClientesComponent, pathMatch: 'full' },
  { path: 'perfil', component: PerfilComponent, pathMatch: 'full' },
  { path: 'miclinica', component: MiclinicaComponent, pathMatch: 'full' },
];

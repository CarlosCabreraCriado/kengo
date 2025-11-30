import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth-guard.service';

// Componentes públicos
import { LoginComponent } from './login/login.component';
import { MagicComponent } from './magic/magic.component';
import { RegistroComponent } from './registro/registro.component';

// Componentes protegidos
import { InicioComponent } from './inicio/inicio.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { EjerciciosComponent } from './ejercicios/ejercicios.component';
import { DetalleEjercicioComponent } from './detalle-ejercicio/detalle-ejercicio.component';
import { PacientesComponent } from './pacientes/pacientes.component';
import { MiClinicaComponent } from './miclinica/miclinica.component';
import { FisiosComponent } from './fisios/fisios.component';
import { CategoriasComponent } from './categorias/categorias.component';

// Planes y Rutinas
import { PlanBuilderComponent } from './plan-builder/plan-builder.component';
import { PlanResumenComponent } from './plan-resumen/plan-resumen.component';
import { PlanesComponent } from './planes/planes.component';
import { RutinasComponent } from './rutinas/rutinas.component';

// Perfil
import { PerfilComponent } from './perfil/perfil.component';
import { ModificarPerfilComponent } from './perfil/modificar-perfil/modificar-perfil.component';
import { CambiarPasswordComponent } from './perfil/cambiar-password/cambiar-password.component';
import { PrivacyPolicyComponent } from './perfil/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './perfil/terms-conditions/terms-conditions.component';

export const routes: Routes = [
  // Redirección raíz
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },

  // Rutas públicas (sin navegación)
  { path: 'login', component: LoginComponent },
  { path: 'magic', component: MagicComponent },
  { path: 'registro', component: RegistroComponent },

  // Rutas protegidas (con navegación)
  { path: 'inicio', component: InicioComponent, canActivate: [AuthGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'ejercicios', component: EjerciciosComponent, canActivate: [AuthGuard] },
  { path: 'detalle-ejercicio/:id', component: DetalleEjercicioComponent, canActivate: [AuthGuard] },
  { path: 'mis-pacientes', component: PacientesComponent, canActivate: [AuthGuard] },
  { path: 'mi-clinica', component: MiClinicaComponent, canActivate: [AuthGuard] },

  // Planes
  { path: 'planes', component: PlanesComponent, canActivate: [AuthGuard] },
  { path: 'planes/nuevo', component: PlanBuilderComponent, canActivate: [AuthGuard] },
  { path: 'planes/:id/editar', component: PlanBuilderComponent, canActivate: [AuthGuard] },
  { path: 'planes/:id/resumen', component: PlanResumenComponent, canActivate: [AuthGuard] },

  // Rutinas (plantillas)
  { path: 'rutinas', component: RutinasComponent, canActivate: [AuthGuard] },

  // Actividad diaria (pacientes y fisios)
  {
    path: 'actividad-diaria',
    loadComponent: () =>
      import('./actividad-diaria/actividad-diaria.component').then(
        (m) => m.ActividadDiariaComponent
      ),
    canActivate: [AuthGuard],
  },

  // Realizar plan (pacientes)
  {
    path: 'mi-plan',
    loadComponent: () =>
      import('./realizar-plan/realizar-plan.component').then(
        (m) => m.RealizarPlanComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'mi-plan/:planId',
    loadComponent: () =>
      import('./realizar-plan/realizar-plan.component').then(
        (m) => m.RealizarPlanComponent
      ),
    canActivate: [AuthGuard],
  },

  { path: 'fisios', component: FisiosComponent, canActivate: [AuthGuard] },
  { path: 'categorias', component: CategoriasComponent, canActivate: [AuthGuard] },
  {
    path: 'perfil',
    component: PerfilComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', component: ModificarPerfilComponent },
      { path: 'cambiar-password', component: CambiarPasswordComponent },
      { path: 'privacy-policy', component: PrivacyPolicyComponent },
      { path: 'terms-conditions', component: TermsConditionsComponent },
    ],
  },
];

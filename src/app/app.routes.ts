import { Routes } from '@angular/router';
import { EjerciciosComponent } from './ejercicios/ejercicios.component';
import { FisiosComponent } from './fisios/fisios.component';
import { CategoriasComponent } from './categorias/categorias.component';
import { DetalleEjercicioComponent } from './detalle-ejercicio/detalle-ejercicio.component';
import { ClientesComponent } from './clientes/clientes.component';
import { MiClinicaComponent } from './miclinica/miclinica.component';
import { ClientePerfilComponent } from './cliente-perfil/cliente-perfil.component';
import { LoginComponent } from './login/login.component';
import { RegistroComponent } from './registro/registro.component';
import { NavegacionComponent } from './navegacion/navegacion.component';

//Dashboard:
import { DashboardComponent } from './dashboard/dashboard.component';

//Perfil:
import { PerfilComponent } from './perfil/perfil.component';
import { ModificarPerfilComponent } from './perfil/modificar-perfil/modificar-perfil.component';
import { CambiarPasswordComponent } from './perfil/cambiar-password/cambiar-password.component';
import { PrivacyPolicyComponent } from './perfil/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './perfil/terms-conditions/terms-conditions.component';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },

  //Paginas de Bento:
  { path: '', redirectTo: '/inicio/dashboard', pathMatch: 'full' },
  {
    path: 'inicio',
    component: NavegacionComponent,
    canActivate: [],
    children: [
      //{ path: "perfil", component: InicioPerfilComponent },
      { path: 'dashboard', component: DashboardComponent },
      {
        path: 'perfil',
        component: PerfilComponent,
        canActivate: [], //Hay que colocar authguard
        children: [
          { path: '', component: ModificarPerfilComponent },
          { path: 'cambiar-password', component: CambiarPasswordComponent },
          { path: 'privacy-policy', component: PrivacyPolicyComponent },
          { path: 'terms-conditions', component: TermsConditionsComponent },
        ],
      },

      { path: 'ejercicios', component: EjerciciosComponent, pathMatch: 'full' },
      { path: 'detalle-ejercicio/:id', component: DetalleEjercicioComponent },
      { path: 'mi-clinica', component: MiClinicaComponent, pathMatch: 'full' },
      {
        path: 'mis-pacientes',
        component: ClientesComponent,
        pathMatch: 'full',
      },

      /*
      //FORMADOR (INICIO)
      { path: "formador/panel", component: PanelFormadorComponent },
      { path: "formador/buscar-sesion", component: BuscarSesionComponent },
      { path: "formador/material", component: MaterialComponent },

      //INSTITUCION (INICIO)
      {
        path: "institucion/solicitar-sesion",
        component: SolicitarSesionComponent,
      },
      { path: "institucion", component: PanelInstitucionComponent },
      {
        path: "institucion/mis-instituciones",
        component: PanelInstitucionComponent,
      },

      //IMPULSOR (INICIO)
      //{ path: "impulsor", component: PanelImpulsorComponent },
      { path: "impulsor", redirectTo: "/impulsor/cursos", pathMatch: "full" },
      { path: "impulsor/cursos", component: CursosImpulsorComponent },
      {
        path: "impulsor/instituciones",
        component: InstitucionesImpulsorComponent,
      },
      {
        path: "impulsor/generador-informes",
        component: GeneradorInformesComponent,
      },
      {
        path: "perfil",
        component: InicioPerfilComponent,
        canActivate: [], //Hay que colocar authguard
        children: [
          { path: "", component: AccountSettingsComponent },
          { path: "change-password", component: ChangePasswordComponent },
          { path: "privacy-policy", component: PrivacyPolicyComponent },
          { path: "terms-conditions", component: TermsConditionsComponent },
          {
            path: "consentimiento-voluntario",
            component: ConsentimientoVoluntarioComponent,
          },
        ],
      },

      {
        path: "notificaciones",
        component: NotificacionesComponent,
        canActivate: [], //Hay que colocar authguard
        children: [
          { path: "", redirectTo: "general", pathMatch: "full" },
          { path: "general", component: NotificacionesGeneralesComponent },
          { path: "accesos", component: NotificacionesAccesosComponent },
          { path: "contactos", component: NotificacionesContactosComponent },
        ],
      },
      */
    ],
  },

  { path: 'ejercicios', component: EjerciciosComponent, pathMatch: 'full' },
  { path: 'fisios', component: FisiosComponent, pathMatch: 'full' },
  { path: 'categorias', component: CategoriasComponent, pathMatch: 'full' },

  { path: 'clientes', component: ClientesComponent, pathMatch: 'full' },
  { path: 'perfil', component: PerfilComponent, pathMatch: 'full' },
  { path: 'miclinica', component: MiClinicaComponent, pathMatch: 'full' },
  {
    path: 'cliente-perfil',
    component: ClientePerfilComponent,
    pathMatch: 'full',
  },
  { path: 'login', component: LoginComponent, pathMatch: 'full' },
  { path: 'registro', component: RegistroComponent, pathMatch: 'full' },
];

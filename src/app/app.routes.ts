import { Routes } from '@angular/router';
import { BentoComponent } from './bento/bento.component';
import { EjerciciosComponent } from './ejercicios/ejercicios.component';
import { FisiosComponent } from './fisios/fisios.component';
import { CategoriasComponent } from './categorias/categorias.component';
import { DetalleEjercicioComponent } from './detalle-ejercicio/detalle-ejercicio.component';
import { ClientesComponent } from './clientes/clientes.component';
import { PerfilComponent } from './perfil/perfil.component';
import { MiclinicaComponent } from './miclinica/miclinica.component';
import { ClientePerfilComponent } from './cliente-perfil/cliente-perfil.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { NavegacionComponent } from './navegacion/navegacion.component';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },

  //Paginas de Bento:
  { path: '', redirectTo: '/inicio/dashboard', pathMatch: 'full' },
  {
    path: 'inicio',
    component: NavegacionComponent,
    canActivate: [],
    /*
    children: [
      //{ path: "perfil", component: InicioPerfilComponent },
      { path: "accesos", component: InicioAccesosComponent },

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
    ],
*/
  },

  { path: 'clinica', component: BentoComponent, pathMatch: 'full' },

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
  {
    path: 'cliente-perfil',
    component: ClientePerfilComponent,
    pathMatch: 'full',
  },
  { path: 'login', component: LoginComponent, pathMatch: 'full' },
  { path: 'register', component: RegisterComponent, pathMatch: 'full' },
];

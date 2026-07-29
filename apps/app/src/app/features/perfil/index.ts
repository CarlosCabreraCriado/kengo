// Routes
export { PERFIL_ROUTES } from './perfil.routes';

// Pages
export { PerfilComponent } from './pages/perfil/perfil/perfil.component';

// Components (sub-components of perfil)
// La política de privacidad ya no vive aquí: los cuatro documentos legales se
// comparten desde `@kengo/legal` y se abren con `LegalDialogComponent`
// (`features/legal/components/legal-dialog`).
export { CambiarPasswordComponent } from './pages/perfil/perfil/cambiar-password/cambiar-password.component';

// Auth
export { AuthService } from './auth/services/auth.service';
export { SessionService } from './auth/services/session.service';
export { BetterAuthService } from './auth/services/better-auth.service';

// Services
export { ThemeService } from './services/theme.service';

// Guards
export { AuthGuard } from './guards/auth.guard';
export { FisioGuard } from './guards/fisio.guard';
export { PacienteGuard } from './guards/paciente.guard';
export { AdminGuard } from './guards/admin.guard';

// Config
export { CustomRouteReuseStrategy } from './config/route-reuse-strategy';

// Convex
export { ConvexService, type ConvexQueryResult } from './convex/convex.service';
export { provideConvex } from './convex/convex.provider';

// Layout Components
export { NavegacionComponent } from './layout/components/navegacion/navegacion.component';
export { HeaderComponent } from './layout/components/header/header.component';
export { FooterComponent } from './layout/components/footer/footer.component';
export { DashboardHeaderComponent } from './layout/components/dashboard-header/dashboard-header.component';

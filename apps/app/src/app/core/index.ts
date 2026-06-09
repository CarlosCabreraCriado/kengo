// Auth
export { AuthService } from './auth/services/auth.service';
export { SessionService } from './auth/services/session.service';
export { BetterAuthService } from './auth/services/better-auth.service';
export { ClinicaActivaService } from './auth/services/clinica-activa.service';
export { ClinicaActivaPendingService } from './auth/services/clinica-activa-pending.service';

// Services
export { ThemeService } from './services/theme.service';
export { LoggerService } from './services/logger.service';

// Guards
export { AuthGuard } from './guards/auth.guard';
export { FisioGuard } from './guards/fisio.guard';
export { PacienteGuard } from './guards/paciente.guard';
export { AdminGuard } from './guards/admin.guard';
export { ClinicAdminGuard } from './guards/clinic-admin.guard';
export { ActiveSubscriptionGuard } from './guards/active-subscription.guard';
export { OnboardingGuard } from './guards/onboarding.guard';
export { ClinicaActivaGuard } from './guards/clinica-activa.guard';
export { SoporteGuard } from './guards/soporte.guard';
export {
  clinicaActivaResourceGuard,
  type ResourceType as ClinicaActivaResourceType,
} from './guards/clinica-activa-resource.guard';

// Config
export { CustomRouteReuseStrategy } from './config/route-reuse-strategy';

// Convex
export { ConvexService, type ConvexQueryResult } from './convex/convex.service';
export { provideConvex } from './convex/convex.provider';

// Billing
export { SubscriptionService } from './billing/subscription.service';
export { SubscriptionGateService } from './billing/subscription-gate.service';
export { BillingBannerComponent } from './billing/billing-banner.component';

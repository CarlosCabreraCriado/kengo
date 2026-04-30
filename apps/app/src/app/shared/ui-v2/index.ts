/**
 * Barrel del catálogo V2 ("cream wellness").
 *
 * Convenciones:
 * - Selector: `ui2-*`
 * - Standalone, OnPush, signals (`input()` / `output()`).
 * - Tokens consumidos: `--kengo-primary*`, `--cream-*`, `--ink-*`, semantic, sombras V2 (ver `apps/app/src/styles.css`).
 * - Iconografía: Material Symbols. Mapping en `./icons/icon-map.ts`.
 *
 * Regla: NO mezclar `ui-*` y `ui2-*` en una misma pantalla. Ver `apps/app/CLAUDE.md`.
 */

// --- Iconos ---
export { PATIENT_ICON_MAP } from './icons/icon-map';
export type { PatientIconName } from './icons/icon-map';

// --- Primitivas ---
export { Ui2CardComponent } from './card/card.component';
export type { Ui2CardVariant } from './card/card.component';
export { Ui2BigTitleComponent } from './big-title/big-title.component';
export { Ui2SectionLabelComponent } from './section-label/section-label.component';
export { Ui2SectionComponent } from './section/section.component';
export { Ui2IconBadgeComponent } from './icon-badge/icon-badge.component';
export { Ui2AvatarComponent } from './avatar/avatar.component';
export type { Ui2AvatarSize, Ui2AvatarGradient } from './avatar/avatar.component';
export { Ui2PillComponent } from './pill/pill.component';
export type { Ui2PillVariant, Ui2PillSize } from './pill/pill.component';
export { Ui2StatusDotComponent } from './status-dot/status-dot.component';
export { Ui2ToggleComponent } from './toggle/toggle.component';
export { Ui2ButtonComponent } from './button/button.component';
export type { Ui2ButtonVariant, Ui2ButtonSize } from './button/button.component';
export { Ui2InputComponent } from './input/input.component';
export { Ui2TextareaComponent } from './textarea/textarea.component';
export { Ui2SelectComponent } from './select/select.component';
export type { Ui2SelectOption } from './select/select.component';
export { Ui2CheckboxComponent } from './checkbox/checkbox.component';
export { Ui2RadioGroupComponent } from './radio-group/radio-group.component';
export type { Ui2RadioOption } from './radio-group/radio-group.component';
export { Ui2SearchBoxComponent } from './search-box/search-box.component';
export { Ui2SpinnerComponent } from './spinner/spinner.component';
export { Ui2BackButtonComponent } from './back-button/back-button.component';
export { Ui2EmptyStateComponent } from './empty-state/empty-state.component';
export { Ui2DatepickerComponent } from './datepicker/datepicker.component';
export type { Ui2DatepickerMode } from './datepicker/datepicker.component';
export { Ui2ProgressBarComponent } from './progress-bar/progress-bar.component';
export type {
  Ui2ProgressBarSize,
  Ui2ProgressBarMode,
  Ui2ProgressBarColor,
} from './progress-bar/progress-bar.component';

// --- Diálogos ---
export {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2DialogActionsComponent,
} from './dialog/dialog.component';
export type { Ui2DialogActionsAlign } from './dialog/dialog.component';

// --- Stepper ---
export { Ui2StepperComponent, Ui2StepComponent } from './stepper/stepper.component';
export type { Ui2StepperOrientation } from './stepper/stepper.component';

// --- Moléculas ---
export { Ui2ListRowComponent } from './list-row/list-row.component';
export { Ui2ToggleRowComponent } from './toggle-row/toggle-row.component';
export { Ui2KpiCardComponent } from './kpi-card/kpi-card.component';
export { Ui2MessageBubbleComponent } from './message-bubble/message-bubble.component';
export type { Ui2MessageBubbleFrom } from './message-bubble/message-bubble.component';
export { Ui2DateTileComponent } from './date-tile/date-tile.component';
export { Ui2HorizontalScrollerComponent } from './horizontal-scroller/horizontal-scroller.component';
export { Ui2CtaBarComponent } from './cta-bar/cta-bar.component';
export type { Ui2CtaBarVariant } from './cta-bar/cta-bar.component';
export { Ui2FisioMessageCardComponent } from './fisio-message-card/fisio-message-card.component';
export { Ui2ProgressRingComponent } from './progress-ring/progress-ring.component';
export { Ui2ActivityRingsComponent } from './activity-rings/activity-rings.component';
export { Ui2ExerciseCardComponent } from './exercise-card/exercise-card.component';
export { Ui2ClinicHeroCardComponent } from './clinic-hero-card/clinic-hero-card.component';
export { Ui2SegmentedComponent } from './segmented/segmented.component';
export type { Ui2SegmentedOption } from './segmented/segmented.component';
export { Ui2AchievementCardComponent } from './achievement-card/achievement-card.component';
export { Ui2MiniStatComponent } from './mini-stat/mini-stat.component';
export { Ui2WebActivityChartComponent } from './web-activity-chart/web-activity-chart.component';
export type { Ui2ActivityDay } from './web-activity-chart/web-activity-chart.component';
export { Ui2NextAppointmentComponent } from './next-appointment/next-appointment.component';
export type { Ui2AppointmentVm } from './next-appointment/next-appointment.component';
export { Ui2WebAchievementsListComponent } from './web-achievements-list/web-achievements-list.component';
export type { Ui2AchievementListItem } from './web-achievements-list/web-achievements-list.component';

// --- Shell paciente ---
export { Ui2CreamBgComponent } from './cream-bg/cream-bg.component';
export { Ui2PatientHeaderComponent } from './patient-header/patient-header.component';
export { Ui2PatientTabBarComponent } from './patient-tab-bar/patient-tab-bar.component';
export type { TabItem } from './patient-tab-bar/patient-tab-bar.component';
export { Ui2PatientSidebarComponent } from './patient-sidebar/patient-sidebar.component';
export type { SidebarNavGroup, SidebarNavItem } from './patient-sidebar/patient-sidebar.component';
export { Ui2WebTopbarComponent } from './web-topbar/web-topbar.component';
export { Ui2NotificacionesMenuComponent } from './notificaciones-menu/notificaciones-menu.component';

/**
 * Mapping de los 18 iconos del PatientIcon de la guía de diseño
 * (`diseño/design_handoff_kengo_ui_library/patient-components.jsx`)
 * a sus equivalentes en Material Symbols (cargados globalmente vía `.material-symbols-outlined`).
 *
 * Uso:
 *   <span class="material-symbols-outlined">{{ PATIENT_ICON_MAP.flame }}</span>
 *   // → renderiza "local_fire_department"
 */
export const PATIENT_ICON_MAP = {
  home: 'home',
  trend: 'trending_up',
  chat: 'chat',
  play: 'play_arrow',
  check: 'check',
  flame: 'local_fire_department',
  clock: 'schedule',
  arrow: 'arrow_forward',
  pin: 'location_on',
  phone: 'phone',
  heart: 'favorite',
  bell: 'notifications',
  user: 'person',
  settings: 'settings',
  dot: 'fiber_manual_record',
  pain: 'mood_bad',
  building: 'apartment',
  location: 'public',
} as const;

export type PatientIconName = keyof typeof PATIENT_ICON_MAP;

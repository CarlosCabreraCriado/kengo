import type { SidebarNavGroup, TabItem } from '../../../../../shared/ui-v2';

export const PACIENTE_TAB_BAR_TABS: TabItem[] = [
  { id: 'home',   label: 'Inicio',  icon: 'home',           route: '/inicio',                 matchPrefix: '/inicio' },
  { id: 'plan',   label: 'Mi plan', icon: 'fitness_center', route: '/actividad-personal/hoy', matchPrefix: '/actividad-personal' },
  { id: 'fisio',  label: 'Fisio',   icon: 'chat',           route: '/mensajes',               matchPrefix: '/mensajes' },
  { id: 'clinic', label: 'Clínica', icon: 'apartment',      route: '/mi-clinica',             matchPrefix: '/mi-clinica' },
];

export const PACIENTE_SIDEBAR_GROUPS: SidebarNavGroup[] = [
  {
    label: 'Mi recuperación',
    items: [
      { id: 'home',     label: 'Inicio',     icon: 'home',            route: '/inicio',                          matchPrefix: '/inicio' },
      { id: 'plan',     label: 'Mi plan',    icon: 'fitness_center',  route: '/actividad-personal/hoy',          matchPrefix: '/actividad-personal/hoy' },
      { id: 'calendar', label: 'Calendario', icon: 'calendar_month',  route: '/actividad-personal/calendario',   matchPrefix: '/actividad-personal/calendario' },
      { id: 'progress', label: 'Progreso',   icon: 'trending_up',     route: '/actividad-personal/estadisticas', matchPrefix: '/actividad-personal/estadisticas' },
    ],
  },
  {
    label: 'Mi clínica',
    items: [
      { id: 'fisio',  label: 'Mi fisio', icon: 'chat',      route: '/mensajes',   matchPrefix: '/mensajes' },
      { id: 'clinic', label: 'Clínica',  icon: 'apartment', route: '/mi-clinica', matchPrefix: '/mi-clinica' },
    ],
  },
];

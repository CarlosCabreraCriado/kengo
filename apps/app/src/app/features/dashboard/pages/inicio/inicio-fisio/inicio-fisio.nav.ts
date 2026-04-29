import type { SidebarNavGroup, TabItem } from '../../../../../shared/ui-v2';

export const FISIO_TAB_BAR_TABS: TabItem[] = [
  { id: 'home',      label: 'Inicio',    icon: 'home',            route: '/inicio/fisio',  matchPrefix: '/inicio/fisio' },
  { id: 'ejercicios', label: 'Ejercicios', icon: 'fitness_center', route: '/ejercicios',    matchPrefix: ['/ejercicios', '/rutinas'] },
  { id: 'pacientes', label: 'Pacientes', icon: 'group',           route: '/mis-pacientes', matchPrefix: '/mis-pacientes' },
  { id: 'clinica',   label: 'Clínica',   icon: 'apartment',       route: '/mi-clinica',    matchPrefix: '/mi-clinica' },
];

export const FISIO_SIDEBAR_GROUPS: SidebarNavGroup[] = [
  {
    label: 'Mi día',
    items: [
      { id: 'home', label: 'Inicio', icon: 'home', route: '/inicio/fisio', matchPrefix: '/inicio/fisio' },
    ],
  },
  {
    label: 'Pacientes',
    items: [
      { id: 'pacientes',  label: 'Mis pacientes', icon: 'group',           route: '/mis-pacientes',           matchPrefix: '/mis-pacientes' },
      { id: 'asignacion', label: 'Asignación',    icon: 'assignment_ind',  route: '/mis-pacientes/asignacion', matchPrefix: '/mis-pacientes/asignacion' },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { id: 'galeria', label: 'Galería',  icon: 'fitness_center', route: '/ejercicios', matchPrefix: '/ejercicios' },
      { id: 'rutinas', label: 'Rutinas',  icon: 'list_alt',       route: '/rutinas',    matchPrefix: '/rutinas' },
      { id: 'clinica', label: 'Mi clínica', icon: 'apartment',    route: '/mi-clinica', matchPrefix: '/mi-clinica' },
    ],
  },
];

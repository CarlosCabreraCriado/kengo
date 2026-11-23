/**
 * Datos comerciales y de contacto de la landing, en un único sitio.
 *
 * Regla: un bloque cuyo dato está vacío NO se pinta. Así la web nunca publica
 * un placeholder («+34 000…», un logo genérico, un enlace a «#») mientras
 * falte el dato real.
 */

// ─── Demo y contacto ────────────────────────────────────────────────────────

/**
 * Página de reservas de Google Calendar (appointment schedule) de Kengo:
 * demo de 15 min con Guille o Pablo. Vacía → la sección de demo muestra solo
 * el formulario «Te llamamos».
 */
export const DEMO_CALENDAR_URL = '';

/** Número de WhatsApp en formato internacional sin `+` (p. ej. `34600123456`). */
export const WHATSAPP_NUMBER = '';
export const WHATSAPP_MENSAJE = 'Hola, quiero saber más sobre Kengo para mi clínica.';

export const CONTACT_EMAIL = 'info@kengoapp.com';

/** Plazo de respuesta que se promete en la web (formulario y FAQ). */
export const PLAZO_RESPUESTA = 'menos de 24 h';

export const SOCIAL = {
  instagram: '',
  linkedin: '',
} as const;

// ─── Apps nativas ───────────────────────────────────────────────────────────

/** Activar el día que la app esté publicada en App Store (cuenta de KENGO S.C.). */
export const APP_STORE_ENABLED = false;
export const APP_STORE_URL = '';
export const PLAY_STORE_URL = '';

// ─── Precios ────────────────────────────────────────────────────────────────

export const TRIAL_DIAS = 14;

export interface PlanWeb {
  /** Nombre comercial en la web. En Convex/Stripe se llama `nombreInterno`. */
  nombre: string;
  nombreInterno: 'Lonely' | 'Smart' | 'Medium';
  fisiosMin: number;
  fisiosMax: number;
  limitePacientes: number;
  precioEur: number;
  precioIlimitadoEur: number;
  destacado?: boolean;
}

/**
 * Espejo de `PLANES` en `convex/billing/_helpers.ts`, que es la fuente de
 * verdad (lo que cobra Stripe). `site-config.spec.ts` falla si divergen.
 * Precios sin impuestos (IGIC en Canarias; inversión del sujeto pasivo fuera).
 */
export const PLANES_WEB: readonly PlanWeb[] = [
  {
    nombre: 'Solo',
    nombreInterno: 'Lonely',
    fisiosMin: 1,
    fisiosMax: 1,
    limitePacientes: 150,
    precioEur: 89,
    precioIlimitadoEur: 109,
  },
  {
    nombre: 'Clínica',
    nombreInterno: 'Smart',
    fisiosMin: 2,
    fisiosMax: 4,
    limitePacientes: 300,
    precioEur: 249,
    precioIlimitadoEur: 279,
    destacado: true,
  },
  {
    nombre: 'Clínica L',
    nombreInterno: 'Medium',
    fisiosMin: 5,
    fisiosMax: 9,
    limitePacientes: 500,
    precioEur: 449,
    precioIlimitadoEur: 489,
  },
];

/**
 * Oferta de lanzamiento. El contador se actualiza A MANO al cerrar cada
 * clínica fundadora; con `plazasRestantes: 0` el banner desaparece. El
 * descuento lo aplica ventas con un cupón de Stripe (nunca con un price
 * nuevo: marcaría la suscripción como «a medida»).
 */
export const OFERTA_FUNDADORA = {
  descuentoPct: 30,
  meses: 4,
  plazasTotales: 10,
  plazasRestantes: 6,
} as const;

// ─── Prueba social ──────────────────────────────────────────────────────────

/** Clínicas que usan Kengo hoy (dato real, no redondear al alza). */
export const CLINICAS_USUARIAS = 4;

export interface Logo {
  nombre: string;
  /** Ruta bajo `public/` (p. ej. `assets/logos/myo-active.svg`). */
  src: string;
  url?: string;
}

/**
 * Clínicas clientes (Myo Active, Motrix, Maeve, Mune). Añadir solo con el
 * logo en `public/assets/logos/` y su permiso para mostrarlo.
 */
export const LOGOS_CLIENTES: readonly Logo[] = [];

/** «Colaboramos con»: Colegios de Fisioterapeutas de Cantabria y de Canarias. */
export const LOGOS_COLABORADORES: readonly Logo[] = [];

export interface MiembroEquipo {
  nombre: string;
  rol: string;
  bio: string;
  /** Ruta bajo `public/` a una foto cuadrada; sin foto se muestra la inicial. */
  foto?: string;
}

/** «Quién está detrás». Vacío → se muestra solo el texto de presentación. */
export const EQUIPO: readonly MiembroEquipo[] = [];

// ─── Formulario «Te llamamos» ───────────────────────────────────────────────
// Espejo de `convex/contact/_leadHelpers.ts`: el servidor rechaza (400)
// cualquier valor fuera de estas listas. `site-config.spec.ts` lo comprueba.

export const NUM_FISIOS_OPCIONES = ['1', '2-4', '5-9', '10+'] as const;

export const PREFERENCIAS_CONTACTO = [
  { value: 'telefono', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
] as const;

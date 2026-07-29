/**
 * Metadatos de los documentos legales de Kengo.
 *
 * Fuente única para: rutas, títulos, descripciones SEO y fecha de última
 * actualización. La consumen la app (`features/legal`) y la landing
 * (`pages/legal`), de modo que un cambio de título o de fecha se propaga a
 * ambas sin tocar dos sitios.
 *
 * `version` se usa para el registro de consentimientos: cuando cambie el
 * contenido de forma sustancial hay que subirla para poder exigir un nuevo
 * consentimiento a los usuarios existentes.
 */

export type LegalDocId =
  | 'privacidad'
  | 'terminos'
  | 'cookies'
  | 'aviso-legal';

export interface LegalDocMeta {
  /** Identificador estable, coincide con el segmento de ruta. */
  readonly id: LegalDocId;
  /** Título del documento (`<h1>` y `<title>`). */
  readonly title: string;
  /** Descripción corta para el meta `description` y los Open Graph. */
  readonly description: string;
  /** Fecha de última revisión en formato ISO (YYYY-MM-DD). */
  readonly lastUpdated: string;
  /** Versión del texto, para el registro de consentimiento. */
  readonly version: string;
}

/** Dominio canónico de las páginas legales indexables (la landing). */
export const LEGAL_CANONICAL_ORIGIN = 'https://www.kengoapp.com';

export const LEGAL_DOCS: Readonly<Record<LegalDocId, LegalDocMeta>> = {
  privacidad: {
    id: 'privacidad',
    title: 'Política de privacidad',
    description:
      'Cómo Kengo trata tus datos personales y de salud: responsable, finalidades, base legal, destinatarios y cómo ejercer tus derechos.',
    lastUpdated: '2026-07-29',
    version: '2026-07-29',
  },
  terminos: {
    id: 'terminos',
    title: 'Términos y condiciones',
    description:
      'Condiciones de uso de la plataforma Kengo para fisioterapeutas, clínicas y pacientes, incluida la contratación de la suscripción.',
    lastUpdated: '2026-07-29',
    version: '2026-07-29',
  },
  cookies: {
    id: 'cookies',
    title: 'Política de cookies',
    description:
      'Qué almacenamiento usa Kengo en tu dispositivo y por qué. Solo utilizamos almacenamiento técnico necesario para el funcionamiento del servicio.',
    lastUpdated: '2026-07-29',
    version: '2026-07-29',
  },
  'aviso-legal': {
    id: 'aviso-legal',
    title: 'Aviso legal',
    description:
      'Datos identificativos del titular de kengoapp.com, condiciones de acceso al sitio, propiedad intelectual y legislación aplicable.',
    lastUpdated: '2026-07-29',
    version: '2026-07-29',
  },
};

/** Orden en el que se listan los documentos en menús y footers. */
export const LEGAL_DOC_ORDER: readonly LegalDocId[] = [
  'privacidad',
  'terminos',
  'cookies',
  'aviso-legal',
];

/** URL canónica (en la landing) de un documento. */
export function legalDocCanonicalUrl(id: LegalDocId): string {
  return `${LEGAL_CANONICAL_ORIGIN}/legal/${id}`;
}

/** Type guard para validar un segmento de ruta desconocido. */
export function isLegalDocId(value: unknown): value is LegalDocId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(LEGAL_DOCS, value)
  );
}

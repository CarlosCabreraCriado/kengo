import { PLANES_WEB, TRIAL_DIAS } from './site-config';

export interface Faq {
  pregunta: string;
  /** Texto plano: se usa tal cual en la página y en el JSON-LD `FAQPage`. */
  respuesta: string;
}

const [solo, , clinicaL] = PLANES_WEB;

/**
 * Preguntas frecuentes de la home. Una sola fuente para el componente y para
 * el `FAQPage` de schema.org, para que lo que ve Google no diverja de lo que
 * ve el visitante.
 *
 * Solo afirmaciones respaldadas por el producto o por la política de
 * privacidad publicada (`@kengo/legal`). Si cambia una, revisar aquí.
 */
export const FAQS: readonly Faq[] = [
  {
    pregunta: '¿Hay permanencia?',
    respuesta:
      'No. Pagas mes a mes y puedes cancelar cuando quieras desde la propia app, sin llamadas ni penalizaciones.',
  },
  {
    pregunta: '¿Cómo funciona la prueba gratis?',
    respuesta: `Tienes ${TRIAL_DIAS} días con todas las funciones y sin tarjeta. Si al terminar quieres seguir, añades la tarjeta; si no, no se te cobra nada.`,
  },
  {
    pregunta: '¿Tiene que pagar algo el paciente?',
    respuesta:
      'No. La suscripción es de la clínica; tus pacientes descargan la app y entran con un código, sin coste para ellos.',
  },
  {
    pregunta: '¿Cuánto cuesta?',
    respuesta: `Desde ${solo?.precioEur} € al mes para un fisio y hasta ${clinicaL?.precioEur} € para equipos de ${clinicaL?.fisiosMin} a ${clinicaL?.fisiosMax} fisios, impuestos no incluidos. El plan se ajusta solo al número de fisios de tu equipo. Con más de ${clinicaL?.fisiosMax} fisios hacemos un precio a medida.`,
  },
  {
    pregunta: '¿En qué dispositivos funciona?',
    respuesta:
      'En el navegador de cualquier ordenador, tablet o móvil, y con app para Android e iOS. El fisio suele trabajar desde el ordenador y el paciente desde el móvil.',
  },
  {
    pregunta: '¿Puedo poner el logo y los colores de mi clínica?',
    respuesta:
      'Sí. Subes tu logo y eliges tu color corporativo: tus pacientes ven la app con la imagen de tu clínica.',
  },
  {
    pregunta: '¿Qué pasa con los datos de salud de mis pacientes?',
    respuesta:
      'Se tratan conforme al RGPD: el paciente da su consentimiento expreso para los datos de salud, la información viaja y se guarda cifrada, se aloja en servidores de la Unión Europea y cada clínica solo ve a sus propios pacientes. Todo el detalle está en nuestra política de privacidad.',
  },
  {
    pregunta: '¿Cuánto se tarda en empezar?',
    respuesta:
      'Una tarde. Creas la clínica, invitas a tu equipo y a tus pacientes con un código de 8 caracteres y montas un plan en menos de 2 minutos a partir de una rutina del catálogo. Si quieres, te acompañamos en una demo de 15 minutos.',
  },
];

/** Nodo `FAQPage` de schema.org para el JSON-LD de la home. */
export function faqJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
    })),
  };
}

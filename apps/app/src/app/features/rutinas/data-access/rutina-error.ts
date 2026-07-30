/**
 * Traduce los errores de las mutaciones de rutinas a un texto que se le pueda
 * enseñar al usuario.
 *
 * Las mutaciones de `convex/routines` lanzan `ConvexError({ code, message })`
 * precisamente para esto: Convex redacta los `Error` planos en producción, así
 * que sin un `code` estructurado el cliente solo recibiría "Server Error" y no
 * podría distinguir "no puedes editar esto" de un fallo de red.
 *
 * Mismo patrón de lectura de `error.data.code` que usa
 * `RutinasService.getRutinaById`.
 */

import { esErrorYaGestionado } from '../../../core/billing/subscription-gate.service';

export type ErrorRutina =
  /** Ya lo ha atendido otra capa; el caller no debe mostrar nada encima. */
  | { kind: 'ya-gestionado' }
  | { kind: 'mostrar'; code: string; title: string; message: string };

const GENERICO = {
  title: 'No se pudieron guardar los cambios',
  message:
    'Ha ocurrido un problema al guardar. Comprueba tu conexión e inténtalo de nuevo.',
} as const;

const MENSAJES: Record<string, { title: string; message: string }> = {
  ROUTINE_NOT_FOUND: {
    title: 'La rutina ya no existe',
    message:
      'Alguien la ha eliminado mientras la editabas, así que no hay dónde guardar los cambios. Puedes copiar los ejercicios y crear una rutina nueva.',
  },
  ROUTINE_PRIVADA_DE_OTRO: {
    title: 'No puedes editar esta rutina',
    message:
      'Es una rutina privada de otro fisioterapeuta: solo quien la creó puede modificarla. Si quieres partir de ella, duplícala desde el listado de rutinas y edita tu copia.',
  },
  ROUTINE_FUERA_DE_CLINICA: {
    title: 'No puedes editar esta rutina',
    message:
      'Pertenece a una clínica en la que no eres fisioterapeuta ni administrador. Si acabas de cambiar de clínica activa, vuelve a la clínica de la rutina e inténtalo otra vez.',
  },
  ROUTINE_NO_ES_TUYA: {
    title: 'No puedes realizar esta acción',
    message: 'Solo quien creó la rutina puede hacerlo.',
  },
  ROUTINE_VISIBILIDAD_SOLO_AUTOR: {
    title: 'No puedes cambiar la visibilidad',
    message:
      'Puedes editar el contenido de esta rutina porque está compartida con tu clínica, pero solo quien la creó puede hacerla privada o moverla a otra clínica.',
  },
  CLINIC_ID_REQUIRED: {
    title: 'Falta la clínica de destino',
    message:
      'Para compartir una rutina con la clínica necesitas tener una clínica activa seleccionada. Elige una y vuelve a guardar.',
  },
};

/** Motivo local (no viene del backend) presentado con el mismo formato. */
export function errorRutinaLocal(title: string, message: string): ErrorRutina {
  return { kind: 'mostrar', code: 'LOCAL', title, message };
}

export function describirErrorRutina(error: unknown): ErrorRutina {
  // `ConvexService.mutation` ya pasa este error por `SubscriptionGateService`,
  // que abre su propio diálogo y re-lanza. Mostrar otro apilaría dos modales.
  if (esErrorYaGestionado(error)) return { kind: 'ya-gestionado' };

  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  const conocido = code ? MENSAJES[code] : undefined;
  return { kind: 'mostrar', code: code ?? 'DESCONOCIDO', ...(conocido ?? GENERICO) };
}

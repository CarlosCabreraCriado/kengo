/**
 * Validación pura del formulario «Te llamamos» de la landing
 * (`POST /api/leads/send`). Sin dependencias de ctx para poder testearla con
 * `npx tsx convex/contact/_leadHelpers.test.ts`.
 *
 * Las listas de valores admitidos tienen su espejo en la landing
 * (`apps/landingpage/src/app/shared/site-config.ts`): si cambia una, cambia
 * la otra, o el servidor rechazará el envío con 400.
 */

export const NUM_FISIOS = ["1", "2-4", "5-9", "10+"] as const;
export type NumFisios = (typeof NUM_FISIOS)[number];

export const PREFERENCIAS_CONTACTO = ["telefono", "whatsapp", "email"] as const;
export type PreferenciaContacto = (typeof PREFERENCIAS_CONTACTO)[number];

export interface LeadInput {
  nombre: string;
  clinica: string;
  numFisios: NumFisios;
  ciudad: string;
  telefono: string;
  email: string;
  preferenciaContacto: PreferenciaContacto;
  privacidadVersion: string;
}

export type LeadValidation =
  | { ok: true; lead: LeadInput }
  | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Dígitos tras quitar espacios, guiones, puntos y paréntesis; `+` opcional. */
const TELEFONO_RE = /^\+?\d{9,15}$/;
const MAX_TEXTO = 120;

function texto(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, MAX_TEXTO) : "";
}

function enLista<T extends string>(lista: readonly T[], raw: unknown): T | null {
  return typeof raw === "string" && (lista as readonly string[]).includes(raw)
    ? (raw as T)
    : null;
}

/** Normaliza un teléfono a dígitos (con `+` inicial si lo traía). */
export function normalizarTelefono(raw: string): string {
  return raw.replace(/[\s\-.()]/g, "");
}

export function validarLead(body: Record<string, unknown>): LeadValidation {
  const nombre = texto(body["nombre"]);
  const clinica = texto(body["clinica"]);
  const ciudad = texto(body["ciudad"]);
  const email = texto(body["email"]).toLowerCase();
  const telefono = normalizarTelefono(texto(body["telefono"]));
  const privacidadVersion = texto(body["privacidadVersion"]);

  if (!nombre || !clinica || !ciudad || !email || !telefono) {
    return {
      ok: false,
      message: "Nombre, clínica, ciudad, teléfono y email son obligatorios",
    };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "El email proporcionado no es válido" };
  }
  if (!TELEFONO_RE.test(telefono)) {
    return { ok: false, message: "El teléfono proporcionado no es válido" };
  }

  const numFisios = enLista(NUM_FISIOS, body["numFisios"]);
  const preferenciaContacto = enLista(
    PREFERENCIAS_CONTACTO,
    body["preferenciaContacto"],
  );
  if (!numFisios || !preferenciaContacto) {
    return { ok: false, message: "Faltan datos del formulario" };
  }

  // Prueba del consentimiento: casilla marcada + versión de la política que
  // se mostró. Sin ambas no se guarda nada.
  if (body["aceptaPrivacidad"] !== true || !privacidadVersion) {
    return {
      ok: false,
      message: "Debes aceptar la política de privacidad",
    };
  }

  return {
    ok: true,
    lead: {
      nombre,
      clinica,
      numFisios,
      ciudad,
      telefono,
      email,
      preferenciaContacto,
      privacidadVersion,
    },
  };
}

/** Honeypot: un bot rellena el campo oculto `website`; una persona, no. */
export function esBot(body: Record<string, unknown>): boolean {
  const trampa = body["website"];
  return typeof trampa === "string" && trampa.trim() !== "";
}

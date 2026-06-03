/**
 * Punteros del carrito (último paciente / fisio seleccionado) con TTL 24h.
 *
 * Centraliza el acceso a `carrito:last_paciente_id` y `carrito:last_fisio_id`
 * para añadirles un timestamp compartido (`carrito:last_saved_at`). Si en la
 * lectura el timestamp tiene más de 24h, las tres claves se purgan en bloque
 * y la sesión arranca sin paciente preseleccionado.
 */
const KEY_PACIENTE = 'carrito:last_paciente_id';
const KEY_FISIO = 'carrito:last_fisio_id';
const KEY_TS = 'carrito:last_saved_at';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface CarritoPointersValue {
  pacienteId: string;
  fisioId: string;
}

/**
 * Actualización parcial: solo las claves presentes se tocan. `null` borra
 * esa clave concreta. Cualquier `set` refresca el timestamp compartido.
 */
export interface CarritoPointersPatch {
  pacienteId?: string | null;
  fisioId?: string | null;
}

export const CarritoPointers = {
  set(patch: CarritoPointersPatch): void {
    try {
      if ('pacienteId' in patch) {
        if (patch.pacienteId) {
          localStorage.setItem(KEY_PACIENTE, patch.pacienteId);
        } else {
          localStorage.removeItem(KEY_PACIENTE);
        }
      }
      if ('fisioId' in patch) {
        if (patch.fisioId) {
          localStorage.setItem(KEY_FISIO, patch.fisioId);
        } else {
          localStorage.removeItem(KEY_FISIO);
        }
      }
      localStorage.setItem(KEY_TS, Date.now().toString());
    } catch {
      // localStorage puede fallar en modo privado; ignorar.
    }
  },

  /**
   * Devuelve los punteros si existen y no han expirado. Si superan el TTL,
   * purga las 3 claves y devuelve `null`.
   */
  read(): CarritoPointersValue | null {
    try {
      const tsRaw = localStorage.getItem(KEY_TS);
      const ts = tsRaw ? Number(tsRaw) : NaN;
      if (!Number.isFinite(ts) || Date.now() - ts > TTL_MS) {
        this.clear();
        return null;
      }
      const pacienteId = localStorage.getItem(KEY_PACIENTE);
      const fisioId = localStorage.getItem(KEY_FISIO);
      if (!pacienteId || !fisioId) return null;
      return { pacienteId, fisioId };
    } catch {
      return null;
    }
  },

  /** Borra las 3 claves. Idempotente. */
  clear(): void {
    try {
      localStorage.removeItem(KEY_PACIENTE);
      localStorage.removeItem(KEY_FISIO);
      localStorage.removeItem(KEY_TS);
    } catch {
      // ignorar
    }
  },
};

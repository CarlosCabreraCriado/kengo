import { Injectable, signal } from '@angular/core';

const CLINICA_ACTIVA_STORAGE_KEY = 'kengo:clinica-activa';

/**
 * Mantiene el id de la "clínica activa" del usuario actual. Es el contexto
 * único que gobierna toda la app multiclinica:
 *   - listas (pacientes, planes, alertas) se filtran por él.
 *   - el modo fisio/paciente se deriva del puesto del usuario en esa clínica.
 *   - el ClinicaActivaGuard protege rutas operativas redirigiendo a
 *     /seleccionar-clinica cuando el signal es `null` y el usuario tiene >1
 *     membresía.
 *
 * Vive en `core/auth/services` para evitar dependencias circulares con
 * `SessionService` y `ClinicasService` — ambos lo consumen.
 */
@Injectable({ providedIn: 'root' })
export class ClinicaActivaService {
  readonly selectedClinicaId = signal<string | null>(
    typeof window !== 'undefined'
      ? localStorage.getItem(CLINICA_ACTIVA_STORAGE_KEY)
      : null,
  );

  set(id: string | null): void {
    this.selectedClinicaId.set(id);
    try {
      if (id) localStorage.setItem(CLINICA_ACTIVA_STORAGE_KEY, id);
      else localStorage.removeItem(CLINICA_ACTIVA_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  clear(): void {
    this.set(null);
  }
}

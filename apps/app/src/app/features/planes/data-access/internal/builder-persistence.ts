/**
 * Estructura mínima que debe cumplir cualquier estado persistido por
 * `BuilderPersistence`. El caller compone su tipo concreto extendiendo
 * esta interfaz con los campos del dominio.
 */
export interface PersistedEnvelope {
  v: number;
  updatedAt: string;
  expiresAt?: string | null;
}

export interface BuilderPersistenceOptions<TKey> {
  schemaVersion: number;
  ttlDays: number;
  makeKey: (args: TKey) => string;
}

/**
 * Persistencia genérica en localStorage para estados tipo "builder" con
 * versionado de esquema y TTL absoluto.
 *
 * - `save` serializa y escribe.
 * - `read` valida `v === schemaVersion` y `expiresAt`. Si expiró o
 *   parsea mal, limpia la entrada y devuelve `null`.
 * - `buildEnvelope` calcula `updatedAt` (now) y `expiresAt` (now + ttl).
 *
 * No usa Angular DI: cada builder service la instancia con `new`.
 */
export class BuilderPersistence<
  TState extends PersistedEnvelope,
  TKey,
> {
  constructor(private readonly opts: BuilderPersistenceOptions<TKey>) {}

  buildEnvelope(): PersistedEnvelope {
    const now = new Date();
    const expires = new Date(
      now.getTime() + this.opts.ttlDays * 864e5,
    );
    return {
      v: this.opts.schemaVersion,
      updatedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };
  }

  save(state: TState, args: TKey): void {
    try {
      localStorage.setItem(this.opts.makeKey(args), JSON.stringify(state));
    } catch {
      // localStorage puede fallar en modo privado; ignorar.
    }
  }

  read(args: TKey): TState | null {
    const key = this.opts.makeKey(args);
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const json = JSON.parse(raw) as TState;
      if (json.v !== this.opts.schemaVersion) return null;
      if (json.expiresAt && Date.now() > Date.parse(json.expiresAt)) {
        localStorage.removeItem(key);
        return null;
      }
      return json;
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
      return null;
    }
  }

  clear(args: TKey): void {
    try {
      localStorage.removeItem(this.opts.makeKey(args));
    } catch {
      // ignore
    }
  }
}
